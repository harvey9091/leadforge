/**
 * Seed script — Phase 2.
 *
 * Creates only the admin user. No mock companies — all company data must
 * come from real discovery jobs.
 *
 * Run with: `bun run db:seed`
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/utils/crypto";

const db = new PrismaClient();

async function main() {
  console.log("→ Seeding Leadforge database (Phase 2)…");

  // --- Admin user (demo) ---
  const adminEmail = "admin@leadforge.local";
  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Leadforge Admin",
        passwordHash: hashPassword("Leadforge123"),
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    console.log(`  ✓ Admin user created (${adminEmail} / Leadforge123)`);
  } else {
    console.log("  • Admin user already exists");
  }

  console.log("→ Seed complete.");
  console.log("  Note: No mock companies seeded. Run a discovery job to populate companies.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
