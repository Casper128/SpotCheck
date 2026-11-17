import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultLog = path.join(repositoryRoot, '.runtime', 'startup.jsonl');
const hints = {
  CONFIG_PORT: 'PORT debe ser un número de puerto válido asignado por el alojamiento.',
  CONFIG_PROXY_ORIGIN: 'PROXY_ORIGIN debe coincidir con FRONTEND_ORIGIN seguido de /proxy.',
  CONFIG_API_ORIGIN: 'PUBLIC_API_ORIGIN debe coincidir exactamente con FRONTEND_ORIGIN.',
  MIGRATION_FAILED: 'Prisma terminó con error sin un código P reconocido. Revisa el servicio y su configuración de migraciones.',
  P1000: 'PostgreSQL rechazó usuario o contraseña.',
  P1001: 'No se pudo alcanzar el host/puerto PostgreSQL.',
  P1002: 'La conexión PostgreSQL agotó el tiempo de espera.',
  P1003: 'No existe la base de datos configurada.',
  P1010: 'El usuario PostgreSQL no tiene acceso a la base.',
  P1011: 'Falló la negociación TLS con PostgreSQL.',
  P1012: 'La configuración o el esquema Prisma no son válidos.',
  P1013: 'La URL de conexión PostgreSQL no es válida.',
  P1014: 'Falta una tabla o relación esperada.',
  P1017: 'PostgreSQL cerró la conexión.',
  P3005: 'La base no está vacía: necesita un baseline o una base nueva.',
  P3009: 'Existe una migración fallida pendiente de resolver.',
  P3018: 'Una migración falló; revisar permisos y estado del esquema.',
  ENOENT: 'No se encontró un archivo, comando o artefacto del build.',
  MODULE_NOT_FOUND: 'Falta una dependencia o un archivo compilado.',
  ERR_MODULE_NOT_FOUND: 'Falta una dependencia o un archivo compilado.',
  EACCES: 'Permisos insuficientes para archivo, directorio o puerto.',
  EPERM: 'El alojamiento bloqueó una operación del proceso.',
  EADDRINUSE: 'El puerto asignado ya está ocupado.',
  EADDRNOTAVAIL: 'La dirección de escucha no está disponible.',
  ECONNREFUSED: 'El servicio de destino rechazó la conexión.',
  ETIMEDOUT: 'Se agotó el tiempo de espera de una operación.',
  MIGRATION_TIMEOUT: 'Las migraciones superaron el tiempo de espera de arranque.',
};

// Never serialize Error.message, stacks, Zod inputs, environment values or subprocess output.
export function safeError(error) {
  const code = typeof error?.code === 'string' && /^(?:P\d{4}|E[A-Z0-9_]+|MODULE_NOT_FOUND|MIGRATION_[A-Z_]+|CONFIG_[A-Z_]+)$/.test(error.code) ? error.code : undefined;
  const name = typeof error?.name === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name) ? error.name : 'Error';
  const fields = Array.isArray(error?.issues) ? [...new Set(error.issues.flatMap(issue => {
    const field = issue?.path?.[0];
    return typeof field === 'string' && /^[A-Z][A-Z_]*$/.test(field) ? [field] : [];
  }))] : undefined;
  return { errorName: name, ...(code ? { code } : {}), ...(fields?.length ? { fields } : {}), ...(hints[code] ? { hint: hints[code] } : {}) };
}

export function createStartupLog() {
  let filename = process.env.SPOTCHECK_LOG_FILE ? path.resolve(process.env.SPOTCHECK_LOG_FILE) : defaultLog;
  let warned = false;
  const output = (level, event, details = {}) => {
    const line = JSON.stringify({ time: new Date().toISOString(), pid: process.pid, level, event, ...details }) + '\n';
    (level === 'error' ? process.stderr : process.stdout).write(line);
    if (!filename) return;
    try {
      fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      if (fs.existsSync(filename) && fs.statSync(filename).size > 1024 * 1024) {
        fs.rmSync(filename + '.1', { force: true });
        fs.renameSync(filename, filename + '.1');
      }
      fs.appendFileSync(filename, line, { mode: 0o600 });
      fs.chmodSync(filename, 0o600);
    } catch (error) {
      filename = null;
      if (!warned) {
        warned = true;
        process.stderr.write(JSON.stringify({ time: new Date().toISOString(), level: 'error', event: 'logging.file-unavailable', ...safeError(error), hint: 'La salida de consola sigue activa. Configura SPOTCHECK_LOG_FILE con una ruta privada y escribible.' }) + '\n');
      }
    }
  };
  return { write: output, get filename() { return filename; } };
}
