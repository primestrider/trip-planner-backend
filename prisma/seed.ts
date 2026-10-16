import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const { DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } =
  process.env;

if (!DATABASE_HOST || !DATABASE_USER || !DATABASE_NAME) {
  throw new Error("Database env is not set");
}

const adapter = new PrismaMariaDb({
  host: DATABASE_HOST,
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  connectionLimit: 5
});

const prisma = new PrismaClient({
  adapter
});

async function main() {
  const avatars = [
    { url: "https://avatar.iran.liara.run/public/32", order: 1 },
    { url: "https://avatar.iran.liara.run/public/74", order: 2 },
    { url: "https://avatar.iran.liara.run/public/46", order: 3 },
    { url: "https://avatar.iran.liara.run/public/81", order: 4 },
    { url: "https://avatar.iran.liara.run/public/44", order: 5 },
    { url: "https://avatar.iran.liara.run/public/21", order: 6 },
    { url: "https://avatar.iran.liara.run/public/66", order: 7 },
    { url: "https://avatar.iran.liara.run/public/39", order: 8 },
    { url: "https://avatar.iran.liara.run/public/59", order: 9 },
    { url: "https://avatar.iran.liara.run/public/62", order: 10 }
  ];

  for (const avatar of avatars) {
    await prisma.avatar.upsert({
      where: { url: avatar.url },
      update: {
        order: avatar.order,
        isActive: true
      },
      create: avatar
    });
  }

  console.log("✅ seeding avatar completed");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
