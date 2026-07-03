import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const r = await p.$queryRawUnsafe("SELECT 1");
  console.log("DB OK", r);
} catch (e) {
  console.error("DB FAIL", e?.code, String(e?.message || e).slice(0, 200));
  process.exit(1);
} finally {
  await p.$disconnect();
}
