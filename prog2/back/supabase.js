const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
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
    const texto = resultado.stderr || resultado.stdout || "Supabase no respondió.";
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

function consultar(ruta, opciones = {}) {
  const archivo = path.join(__dirname, ".cuerpo-supabase.json");
  const hayCuerpo = opciones.body !== undefined;
  if (hayCuerpo) fs.writeFileSync(archivo, JSON.stringify(opciones.body));
  const script = `
    const fs = require("fs");
    const cuerpo = process.env.CUERPO_ARCHIVO ? fs.readFileSync(process.env.CUERPO_ARCHIVO, "utf8") : undefined;
    fetch(process.env.SUPABASE_URL + process.env.RUTA, {
      method: process.env.METODO || "GET",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        Prefer: process.env.PREFER || "return=representation",
      },
      body: cuerpo,
    }).then(async (respuesta) => {
      const texto = await respuesta.text();
      if (!respuesta.ok) {
        process.stderr.write(texto || respuesta.statusText);
        process.exit(1);
      }
      if (texto) process.stdout.write(texto);
    }).catch((error) => {
      process.stderr.write(error.message);
      process.exit(1);
    });
  `;
  const resultado = spawnSync(process.execPath, ["-e", script], {
    env: {
      ...process.env,
      RUTA: ruta,
      METODO: opciones.method || "GET",
      PREFER: opciones.prefer || "return=representation",
      CUERPO_ARCHIVO: hayCuerpo ? archivo : "",
    },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (hayCuerpo) fs.unlinkSync(archivo);
  return interpretarSalida(resultado);
}

module.exports = { supabase, consultar, interpretarSalida };
