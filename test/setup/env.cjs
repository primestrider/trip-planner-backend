// Loaded before every e2e test file: point the app at the test database.
// Values set here win over .env (dotenv never overrides existing variables).
process.env.NODE_ENV = "test";
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME || "trip_planner_test";
