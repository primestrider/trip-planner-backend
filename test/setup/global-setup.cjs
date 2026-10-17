// Runs once before the e2e suite: create the test database, apply every
// migration and empty all tables, so each run starts from a clean state.
require("dotenv/config");
const { execSync } = require("child_process");
const mariadb = require("mariadb");

module.exports = async () => {
  const database = process.env.TEST_DATABASE_NAME || "trip_planner_test";

  // never wipe a database that is not meant for tests
  if (!/_test$/.test(database)) {
    throw new Error(`Refusing to reset "${database}": name must end with _test`);
  }

  const connection = {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD
  };

  const conn = await mariadb.createConnection(connection);
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();

  // DATABASE_URL is what prisma migrate uses; swap in the test database name
  const url = new URL(
    process.env.DATABASE_URL ||
      `mysql://${connection.user}:${connection.password}@${connection.host}:${connection.port}/x`
  );
  url.pathname = `/${database}`;
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url.toString() }
  });

  const db = await mariadb.createConnection({ ...connection, database });
  const tables = await db.query(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? AND table_name <> '_prisma_migrations'",
    [database]
  );
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const { name } of tables) {
    await db.query(`TRUNCATE TABLE \`${name}\``);
  }
  await db.query("SET FOREIGN_KEY_CHECKS = 1");
  await db.end();
};
