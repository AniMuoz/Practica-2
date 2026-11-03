const { leer, reemplazar, guardarCarga } = require("./supabaseTarea");

function interpretarProceso(resultado) {
  if (resultado.status !== 0) {
    const error = new Error((resultado.stderr || resultado.stdout || "Supabase no respondió.").trim());
    error.status = 502;
    throw error;
  }
  if (!resultado.stdout) return null;
  return JSON.parse(resultado.stdout);
}

function falloSupabase(error) {
  const fallo = new Error((error && error.message) || "Supabase no respondió.");
  fallo.status = (error && error.status) || 502;
  throw fallo;
}

// Antes usaba spawnSync y congelaba todo el API mientras hablaba con Supabase.
// Ahora corre en el mismo proceso con await: otras peticiones siguen atendidas.
async function ejecutar(operacion, carga) {
  try {
    if (operacion === "leer") return await leer(carga.tabla);
    if (operacion === "reemplazar") {
      await reemplazar(carga.tabla, carga.filas, carga.columna);
      return null;
    }
    if (operacion === "carga") {
      await guardarCarga(carga.fila);
      return null;
    }
    throw new Error("Operación desconocida.");
  } catch (error) {
    if (error && error.status) throw error;
    falloSupabase(error);
  }
}

module.exports = { ejecutar, interpretarProceso };
