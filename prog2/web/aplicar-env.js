import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const archivo = path.join(raiz, ".env");
if (!fs.existsSync(archivo)) {
  console.error("Falta prog2/web/.env con API=https://...");
  process.exit(1);
}

let api = "";
for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
  const texto = linea.trim();
  if (!texto || texto.startsWith("#")) continue;
  const separador = texto.indexOf("=");
  if (separador < 0) continue;
  if (texto.slice(0, separador).trim() !== "API") continue;
  api = texto.slice(separador + 1).trim().replace(/^["']|["']$/g, "");
}

if (!api) {
  console.error("En .env falta API=https://tu-backend.onrender.com");
  process.exit(1);
}

const worker = path.join(raiz, "worker.js");
const fuente = fs.readFileSync(worker, "utf8");
const actualizado = fuente.replace(/const API_POR_DEFECTO = ".*";/, `const API_POR_DEFECTO = ${JSON.stringify(api)};`);
if (actualizado === fuente) {
  console.error("worker.js no tiene la linea API_POR_DEFECTO");
  process.exit(1);
}
fs.writeFileSync(worker, actualizado);

console.log("API aplicada:", api);
