const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function cargarEnv() {
  const archivo = path.join(__dirname, ".env");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const texto = linea.trim();
    if (!texto || texto.startsWith("#")) continue;
    const separador = texto.indexOf("=");
    if (separador < 0) continue;
    const clave = texto.slice(0, separador).trim();
    const valor = texto.slice(separador + 1).trim();
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

cargarEnv();

const url = process.env.SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en prog2/back/.env");
}

const supabase = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function interpretarSalida(resultado) {
  if (resultado.status !== 0) {
    const texto = resultado.stderr || resultado.stdout || "Supabase no respondiÃ³.";
    const faltanTablas = texto.includes("PGRST205");
    const error = new Error(
      faltanTablas
        ? "En Supabase faltan las tablas. Ejecuta prog2/back/esquema.sql en el SQL Editor y vuelve a intentar."
        : texto
    );
    error.status = faltanTablas ? 503 : 502;
    throw error;
  }
  if (!resultado.stdout) return null;
  return JSON.parse(resultado.stdout);
}

module.exports = { supabase, interpretarSalida };
