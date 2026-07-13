/**
 * Leadforge — Production bootstrap / first-boot initializer.
 *
 * Responsibilities:
 *   1. Wait for PostgreSQL to become available.
 *   2. Apply the Prisma schema if the database is empty.
 *   3. Seed the admin user if missing.
 *   4. Exit once initialized so the real server/worker can start.
 *
 * This script is intentionally idempotent:
 *   - On subsequent boots the tables already exist and the seed is a no-op.
 *   - It never drops or mutates existing production data.
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ Missing DATABASE_URL — cannot bootstrap database");
  process.exit(1);
}

const MAX_RETRIES = 60;
const RETRY_INTERVAL_MS = 2_000;

async function waitForDatabase(): Promise<PrismaClient> {
  const prisma = new PrismaClient({ log: ["error"] });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✓ Database reachable (attempt ${attempt})`);
      return prisma;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_RETRIES) {
        console.error(`❌ Database not reachable after ${MAX_RETRIES} attempts: ${msg}`);
        await prisma.$disconnect();
        process.exit(1);
      }
      console.warn(`⏳ Waiting for PostgreSQL (${msg})… retry ${attempt}/${MAX_RETRIES}`);
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  return prisma;
}

async function ensureSchema(prisma: PrismaClient) {
  try {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    `;
    if (tables.length > 0) {
      console.log("✓ Schema already present — skipping db push");
      return;
    }
  } catch {
    // If the metadata query itself fails we still attempt db push below.
  }

  console.log("→ Applying Prisma schema to empty database…");
  try {
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("✓ Schema applied");
  } catch (err) {
    console.error("❌ Failed to apply Prisma schema");
    console.error(err);
    process.exit(1);
  }
}

async function seedAdminIfMissing(prisma: PrismaClient) {
  const adminEmail = "admin@leadforge.local";
  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existing) {
    console.log("✓ Admin user already exists — skipping seed");
    return;
  }

  console.log("→ Seeding admin user…");
  try {
    const { hashPassword } = await import("../src/server/utils/crypto");
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Leadforge Admin",
        passwordHash: hashPassword("Leadforge123"),
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    console.log(`✓ Admin user created (${adminEmail} / Leadforge123)`);
  } catch (err) {
    console.error("❌ Seed failed");
    console.error(err);
    process.exit(1);
  }
}

async function main() {
  console.log("🚀 Leadforge bootstrap starting…");
  const prisma = await waitForDatabase();
  await ensureSchema(prisma);
  await seedAdminIfMissing(prisma);
  await prisma.$disconnect();
  console.log("✅ Bootstrap complete — database is ready");
}

main().catch((err) => {
  console.error("❌ Bootstrap failed");
  console.error(err);
  process.exit(1);
});
