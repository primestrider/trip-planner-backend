import { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  ApiClient,
  PASSWORD,
  createTestApp,
  registerUser
} from "./utils/test-app";

describe("Authentication (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("wraps successful responses and returns tokens on register", async () => {
    const user = await registerUser(app, "reg");

    const res = await user.client.get("/users/profile").expect(200);

    expect(res.body).toMatchObject({
      statusCode: 200,
      message: "Success",
      data: { id: user.id, username: user.username, role: "USER" }
    });
    expect(res.body.data).not.toHaveProperty("password");
    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("returns field errors in the shared error shape", async () => {
    const res = await new ApiClient(app)
      .post("/authentication/register", {
        username: "x",
        password: "short",
        confirmPassword: "other"
      })
      .expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      message: "validation_failed",
      error: "BAD_REQUEST",
      path: "/authentication/register",
      requestId: expect.any(String)
    });
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(["password", "confirmPassword"])
    );
  });

  it("requires a token on protected routes and a device id", async () => {
    await new ApiClient(app).get("/users/profile").expect(401);
    await request(app.getHttpServer())
      .post("/authentication/login")
      .send({ username: "a", password: "b" })
      .expect(400);
  });

  it("rotates refresh tokens: an old refresh token cannot be reused", async () => {
    const user = await registerUser(app, "refresh");
    const anonymous = new ApiClient(app);

    const first = await anonymous
      .post("/authentication/refresh-token", {
        refreshToken: user.refreshToken
      })
      .expect(200);
    expect(first.body.data.refreshToken).not.toBe(user.refreshToken);

    await anonymous
      .post("/authentication/refresh-token", {
        refreshToken: user.refreshToken
      })
      .expect(401);
  });

  it("signs out every session when the password changes", async () => {
    const phone = await registerUser(app, "pwd", "phone");
    const login = await new ApiClient(app, undefined, "laptop")
      .post("/authentication/login", {
        username: phone.username,
        password: PASSWORD
      })
      .expect(201);
    const laptop = new ApiClient(app, login.body.data.accessToken, "laptop");

    // tokens carry second-precision iat; make the change happen later
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const changed = await phone.client
      .post("/authentication/change-password", {
        currentPassword: PASSWORD,
        newPassword: "N3w-Passw0rd!",
        confirmPassword: "N3w-Passw0rd!"
      })
      .expect(200);

    await phone.client.get("/users/profile").expect(401);
    await laptop.get("/users/profile").expect(401);

    const fresh = new ApiClient(app, changed.body.data.accessToken, "phone");
    await fresh.get("/users/profile").expect(200);

    await new ApiClient(app)
      .post("/authentication/login", {
        username: phone.username,
        password: PASSWORD
      })
      .expect(401);
  });

  it("deletes an account so it can no longer sign in", async () => {
    const user = await registerUser(app, "del");

    await user.client
      .delete("/users/profile", { password: "wrong" })
      .expect(400);
    await user.client
      .delete("/users/profile", { password: PASSWORD })
      .expect(200);

    await user.client.get("/users/profile").expect(401);
    await new ApiClient(app)
      .post("/authentication/login", {
        username: user.username,
        password: PASSWORD
      })
      .expect(401);
  });
});
