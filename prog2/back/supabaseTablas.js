const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function interpretarProceso(resultado) {
  if (resultado.status !== 0) {
    const error = new Error((resultado.stderr || resultado.stdout || "Supabase no respondió.").trim());
    error.status = 502;
    throw error;
  }
  if (!resultado.stdout) return null;
  return JSON.parse(resultado.stdout);
}

function ejecutar(operacion, carga) {
  const archivo = path.join(__dirname, ".cuerpo-supabase.json");
  fs.writeFileSync(archivo, JSON.stringify({ operacion, ...carga }));
  const resultado = spawnSync(process.execPath, [path.join(__dirname, "supabaseTarea.js"), archivo], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.unlinkSync(archivo);
  return interpretarProceso(resultado);
}

module.exports = { ejecutar, interpretarProceso };
