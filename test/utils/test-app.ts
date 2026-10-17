import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "src/app.module";
import { configureApp } from "src/app.setup";

/**
 * Boot the full application (real database, guards, interceptors,
 * filters) exactly as main.ts does, without listening on a port.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

let sequence = 0;

/**
 * Username unique across runs, so tests never collide on unique constraints
 */
export function uniqueName(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now().toString(36)}${sequence}`;
}

export const PASSWORD = "Passw0rd!";

/**
 * Small HTTP client acting as one signed-in user on one device
 */
export class ApiClient {
  constructor(
    private readonly app: INestApplication,
    public token?: string,
    public readonly deviceId = "e2e-device"
  ) {}

  private request(
    method: "get" | "post" | "patch" | "put" | "delete",
    url: string
  ) {
    const req = request(this.app.getHttpServer() as App)
      [method](url)
      .set("x-device-id", this.deviceId);
    return this.token ? req.set("Authorization", `Bearer ${this.token}`) : req;
  }

  get(url: string) {
    return this.request("get", url);
  }
  post(url: string, body?: object) {
    return this.request("post", url).send(body);
  }
  patch(url: string, body?: object) {
    return this.request("patch", url).send(body);
  }
  put(url: string, body?: object) {
    return this.request("put", url).send(body);
  }
  delete(url: string, body?: object) {
    return this.request("delete", url).send(body);
  }
}

export type TestUser = {
  id: string;
  username: string;
  client: ApiClient;
  refreshToken: string;
};

/**
 * Register a new user and return a client signed in as that user
 */
export async function registerUser(
  app: INestApplication,
  prefix = "user",
  deviceId = "e2e-device"
): Promise<TestUser> {
  const username = uniqueName(prefix);
  const res = await new ApiClient(app, undefined, deviceId)
    .post("/authentication/register", {
      username,
      password: PASSWORD,
      confirmPassword: PASSWORD
    })
    .expect(201);

  const body = res.body as {
    data: {
      user: { id: string };
      accessToken: string;
      refreshToken: string;
    };
  };

  return {
    id: body.data.user.id,
    username,
    client: new ApiClient(app, body.data.accessToken, deviceId),
    refreshToken: body.data.refreshToken
  };
}

/**
 * Retry an assertion until it passes, for effects that happen
 * asynchronously (e.g. event listeners)
 */
export async function eventually<T>(
  check: () => Promise<T>,
  timeoutMs = 3000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
