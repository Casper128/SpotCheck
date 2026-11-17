import "dotenv/config";
import { createDatabase } from "../../infrastructure/database/prisma";
import { readConfig } from "../../infrastructure/config/environment";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const value = (flag: string) => { const index = args.indexOf(flag); const found = index >= 0 ? args[index + 1] : undefined; if (!found || found.startsWith("--")) throw new Error(`Falta ${flag}`); return found; };
  const database = createDatabase(readConfig().databaseUrl);
  try {
    if (command === "users") {
      const users = await database.user.findMany({ select: { googleSub: true, email: true, displayName: true, membership: { select: { organizationId: true } } }, orderBy: { createdAt: "desc" } });
      console.log(JSON.stringify(users, null, 2));
      return;
    } else if (command === "organization") {
      const id = value("--id"), name = value("--name");
      await database.organization.upsert({ where: { id }, create: { id, name }, update: { name } });
    } else if (command === "membership") {
      if (args.includes("--status")) throw new Error("La aprobación manual ya no existe. Este comando solo asigna un equipo.");
      const googleSub = value("--google-sub"), organizationId = value("--organization");
      const user = await database.user.findUniqueOrThrow({ where: { googleSub } });
      await database.organization.findUniqueOrThrow({ where: { id: organizationId } });
      await database.organizationMembership.upsert({ where: { userId: user.id }, create: { userId: user.id, organizationId, status: "approved" }, update: { organizationId, status: "approved" } });
    } else if (command === "assign-project") {
      const identifier = value("--project"), organizationId = value("--organization");
      await database.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const canvas = await database.canvas.findFirstOrThrow({ where: { OR: [{ id: identifier }, { shareId: identifier }] } });
      if (canvas.organizationId && canvas.organizationId !== organizationId && !args.includes("--allow-reassign")) throw new Error("El proyecto ya pertenece a otro equipo; requiere --allow-reassign explícito.");
      await database.canvas.update({ where: { id: canvas.id }, data: { organizationId } });
    } else throw new Error("Comandos: users | organization --id ID --name NAME | membership --google-sub SUB --organization ID | assign-project --project ID --organization ID");
    console.log("Acceso administrativo actualizado.");
  } finally { await database.$disconnect(); }
}
if (require.main === module) void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "No se pudo actualizar el acceso."); process.exitCode = 1; });
