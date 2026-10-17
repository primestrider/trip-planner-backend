import { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  TestUser,
  createTestApp,
  eventually,
  registerUser
} from "./utils/test-app";

describe("Trips with collaborators (e2e)", () => {
  let app: INestApplication;
  let owner: TestUser;
  let friend: TestUser;
  let outsider: TestUser;
  let tripId: string;

  beforeAll(async () => {
    app = await createTestApp();
    [owner, friend, outsider] = await Promise.all([
      registerUser(app, "owner"),
      registerUser(app, "friend"),
      registerUser(app, "outsider")
    ]);

    const res = await owner.client
      .post("/trips", {
        title: "Bali",
        destination: "Bali",
        startDate: "2026-11-30",
        endDate: "2026-12-02",
        budgetAmount: 1000
      })
      .expect(201);
    tripId = res.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("hides the trip from users who are not on it", async () => {
    const res = await outsider.client.get(`/trips/${tripId}`).expect(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("lets a friend join through an invite link", async () => {
    const invite = await owner.client
      .post(`/trips/${tripId}/invites`, { role: "EDITOR", maxUses: 1 })
      .expect(201);
    const token: string = invite.body.data.token;

    const preview = await friend.client.get(`/invites/${token}`).expect(200);
    expect(preview.body.data).toMatchObject({
      trip: { title: "Bali" },
      role: "EDITOR",
      currentRole: null
    });

    await friend.client.post(`/invites/${token}/accept`).expect(200);

    // single-use link is now used up
    await outsider.client.post(`/invites/${token}/accept`).expect(404);

    const trip = await friend.client.get(`/trips/${tripId}`).expect(200);
    expect(trip.body.data.role).toBe("EDITOR");
  });

  it("lets an editor plan but not delete the trip", async () => {
    await friend.client
      .post(`/trips/${tripId}/itinerary`, { dayNumber: 1, title: "Beach" })
      .expect(201);
    await friend.client.delete(`/trips/${tripId}`).expect(403);
  });

  it("splits expenses and settles up", async () => {
    // owner pays 100 for both, friend pays 30 for themselves only
    await owner.client
      .post(`/trips/${tripId}/expenses`, {
        category: "ACCOMMODATION",
        title: "Villa",
        amount: 100
      })
      .expect(201);
    await friend.client
      .post(`/trips/${tripId}/expenses`, {
        category: "FOOD",
        title: "Snacks",
        amount: 30,
        splitAmong: [friend.id]
      })
      .expect(201);

    const budget = await friend.client
      .get(`/trips/${tripId}/budget`)
      .expect(200);
    expect(budget.body.data).toMatchObject({
      budgetAmount: 1000,
      totalSpent: 130,
      remaining: 870
    });

    const settlement = await friend.client
      .get(`/trips/${tripId}/settlement`)
      .expect(200);
    expect(settlement.body.data.transfers).toEqual([
      {
        from: expect.objectContaining({ userId: friend.id }),
        to: expect.objectContaining({ userId: owner.id }),
        amount: 50
      }
    ]);
  });

  it("rejects a stale edit with 412 (optimistic locking)", async () => {
    const created = await owner.client
      .post(`/trips/${tripId}/itinerary`, { dayNumber: 2, title: "Temple" })
      .expect(201);
    const itemId: string = created.body.data.id;

    await owner.client
      .patch(`/trips/${tripId}/itinerary/${itemId}`, { title: "Uluwatu" })
      .set("If-Match", '"1"')
      .expect(200);

    const stale = await friend.client
      .patch(`/trips/${tripId}/itinerary/${itemId}`, { title: "Tanah Lot" })
      .set("If-Match", '"1"')
      .expect(412);
    expect(stale.body.error).toBe("PRECONDITION_FAILED");
  });

  it("records what happened in the activity feed", async () => {
    const actions = await eventually(async () => {
      const res = await owner.client
        .get(`/trips/${tripId}/activity?limit=50`)
        .expect(200);
      const list = (res.body.data.items as { action: string }[]).map(
        (item) => item.action
      );
      expect(list).toEqual(
        expect.arrayContaining([
          "member.joined_via_invite",
          "itinerary.item_added",
          "expense.added"
        ])
      );
      return list;
    });

    // newest first
    expect(actions[actions.length - 1]).toBe("member.joined_via_invite");
  });

  it("shares a read-only page without login, hiding private data", async () => {
    const share = await owner.client.post(`/trips/${tripId}/share`).expect(200);

    const res = await request(app.getHttpServer())
      .get(`/shared/${share.body.data.token}`)
      .expect(200);

    expect(res.body.data.trip.title).toBe("Bali");
    expect(JSON.stringify(res.body)).not.toMatch(/Villa|budget|username/);
  });

  it("removes access for everyone when the owner deletes the trip", async () => {
    await owner.client.delete(`/trips/${tripId}`).expect(200);
    await friend.client.get(`/trips/${tripId}`).expect(404);
  });
});

describe("Public endpoints (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the health check without token or device id", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.data).toEqual({ status: "ok", database: "up" });
  });

  it("publishes the OpenAPI document", async () => {
    const res = await request(app.getHttpServer())
      .get("/docs-json")
      .expect(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toContain("/trips");
  });
});
