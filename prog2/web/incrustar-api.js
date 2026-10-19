import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const api = String(process.env.API || "").trim();
const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "api-build.js");
fs.writeFileSync(destino, `export const API_BUILD = ${JSON.stringify(api)};\n`);
console.log(api ? "API de build incrustada en el Worker" : "Sin API en el build; se usara la variable de ejecucion");
