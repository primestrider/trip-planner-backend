import { Logger } from "winston";
import { InvitesTasks } from "./invites.tasks";
import { InvitesRepository } from "./invites.repository";
import { AuthTasks } from "src/auth/auth.tasks";
import { AuthRepository } from "src/auth/auth.repository";

const logger = { info: jest.fn() } as unknown as Logger;
const DAY = 24 * 60 * 60 * 1000;

describe("cleanup tasks", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-12-31T03:23:00.000Z") });
  });

  afterEach(() => jest.useRealTimers());

  it("should delete invites inactive for more than 30 days", async () => {
    const repository = { deleteInactiveBefore: jest.fn().mockResolvedValue(4) };
    const tasks = new InvitesTasks(
      repository as unknown as InvitesRepository,
      logger
    );

    await expect(tasks.deleteStaleInvites()).resolves.toBe(4);
    expect(repository.deleteInactiveBefore).toHaveBeenCalledWith(
      new Date(Date.now() - 30 * DAY)
    );
  });

  it("should delete refresh tokens that already expired", async () => {
    const repository = { deleteExpired: jest.fn().mockResolvedValue(2) };
    const tasks = new AuthTasks(
      repository as unknown as AuthRepository,
      logger
    );

    await expect(tasks.deleteExpiredRefreshTokens()).resolves.toBe(2);
    expect(repository.deleteExpired).toHaveBeenCalledWith(new Date());
  });
});
