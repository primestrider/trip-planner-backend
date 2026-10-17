import { validateEnv } from "./env.validation";

const valid = {
  DATABASE_HOST: "localhost",
  DATABASE_USER: "root",
  DATABASE_NAME: "trip_planner",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ACCESS_EXPIRES_IN: "1h",
  JWT_REFRESH_EXPIRES_IN: "30d"
};

describe("validateEnv", () => {
  it("should apply defaults", () => {
    expect(validateEnv(valid)).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      DATABASE_PORT: 3306,
      DATABASE_PASSWORD: "",
      CORS_ORIGINS: []
    });
  });

  it("should parse CORS origins and numbers", () => {
    expect(
      validateEnv({
        ...valid,
        PORT: "8080",
        CORS_ORIGINS: "http://localhost:5173, https://app.example.com"
      })
    ).toMatchObject({
      PORT: 8080,
      CORS_ORIGINS: ["http://localhost:5173", "https://app.example.com"]
    });
  });

  it.each([
    ["missing database host", { DATABASE_HOST: undefined }, "DATABASE_HOST"],
    ["short secret", { JWT_ACCESS_SECRET: "short" }, "JWT_ACCESS_SECRET"],
    [
      "same secrets",
      { JWT_REFRESH_SECRET: "a".repeat(32) },
      "JWT_REFRESH_SECRET"
    ],
    [
      "bad duration",
      { JWT_ACCESS_EXPIRES_IN: "soon" },
      "JWT_ACCESS_EXPIRES_IN"
    ],
    ["bad origin", { CORS_ORIGINS: "*" }, "CORS_ORIGINS"],
    ["bad port", { PORT: "99999" }, "PORT"]
  ])("should reject %s", (_, override, field) => {
    expect(() => validateEnv({ ...valid, ...override })).toThrow(field);
  });
});
