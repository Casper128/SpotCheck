import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Integration tests require an explicitly configured, disposable PostgreSQL database.
// Never fall back to the application's DATABASE_URL.
export async function postgresFixture(queries?: string[]) {
  const source = process.env.TEST_DATABASE_URL;
  if (!source || !/^postgres(?:ql)?:\/\//.test(source)) throw new Error("Configura TEST_DATABASE_URL con una base PostgreSQL exclusiva para pruebas.");
  const schema = `spotcheck_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new PrismaClient({ datasources: { db: { url: source } } });
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const url = new URL(source);
  url.searchParams.set("schema", schema);
  const database = new PrismaClient({ log: [{ level: "query", emit: "event" }], datasources: { db: { url: url.href } } });
  database.$on("query", event => queries?.push(event.query));
  const cleanup = async () => {
    await database.$disconnect();
    try { await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); } finally { await admin.$disconnect(); }
  };
  try {
    const migrations = path.join(process.cwd(), "prisma", "migrations");
    for (const name of (await readdir(migrations)).filter(name => /^\d/.test(name)).sort()) {
      const sql = await readFile(path.join(migrations, name, "migration.sql"), "utf8");
      for (const statement of sql.split(";").map(part => part.trim()).filter(Boolean)) await database.$executeRawUnsafe(statement);
    }
  } catch (error) { await cleanup(); throw error; }
  return { database, databaseUrl: url.href, cleanup };
}
