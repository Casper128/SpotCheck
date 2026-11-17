import "dotenv/config";
import { readConfig } from "../infrastructure/config/environment";
import { createApp } from "./createApp";

async function main() {
  const config = readConfig();
  const app = await createApp({ config, logger: true });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
  await app.listen({ port: config.port, host: "0.0.0.0" });
}
if (require.main === module) void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
