const { ejecutar } = require("./supabaseTablas");
const { exigirClave, matrizGuardada } = require("./nucleoDatos");

let cacheContratistas = null;

function leerContratistas() {
  if (cacheContratistas) return cacheContratistas.datos;
  let filasDb = ejecutar("leer", { tabla: "contratistas" }) || [];
  if (filasDb.length === 0) {
    const previa = matrizGuardada("contratistas");
    if (previa && previa.length > 1) {
      filasDb = previa.slice(1).map((fila) => ({
        id: Number(fila[0]),
        nombre: String(fila[1] ?? ""),
      })).filter((fila) => Number.isInteger(fila.id) && fila.nombre);
      if (filasDb.length > 0) {
        ejecutar("reemplazar", { tabla: "contratistas", columna: "id", filas: filasDb });
      }
    }
  }
  const matriz = [["id", "Nombre"], ...filasDb.map((fila) => [fila.id, fila.nombre])];
  const columnas = (matriz[0] || ["id", "Nombre"]).map((nombre) => String(nombre));
  const filas = matriz.slice(1)
    .filter((fila) => (fila || []).some((celda) => String(celda ?? "").trim() !== ""))
    .map((fila) => ({
      id: fila[0] ?? "",
      nombre: fila[1] ?? "",
    }));
  const datos = { columnas, filas };
  cacheContratistas = { datos };
  return datos;
}

function guardarContratistas(clave, filas) {
  exigirClave(clave);
  if (!Array.isArray(filas)) {
    const error = new Error("No hay contratistas para guardar.");
    error.status = 400;
    throw error;
  }

  const vistos = new Set();
  const matriz = [["id", "Nombre"]];
  filas.forEach((fila, indice) => {
    const id = String(fila.id ?? "").trim();
    const nombre = String(fila.nombre ?? "").trim();
    if (!id && !nombre) return;
    if (!id || !/^\d+$/.test(id)) {
      const error = new Error(`La fila ${indice + 1} necesita un id numérico.`);
      error.status = 400;
      throw error;
    }
    if (!nombre) {
      const error = new Error(`La fila ${indice + 1} necesita un nombre.`);
      error.status = 400;
      throw error;
    }
    if (vistos.has(id)) {
      const error = new Error(`El id ${id} está repetido.`);
      error.status = 400;
      throw error;
    }
    vistos.add(id);
    matriz.push([Number(id), nombre]);
  });

  ejecutar("reemplazar", {
    tabla: "contratistas",
    columna: "id",
    filas: matriz.slice(1).map((fila) => ({ id: Number(fila[0]), nombre: String(fila[1] ?? "") })),
  });
  cacheContratistas = null;
  return leerContratistas();
}

module.exports = {
  leerContratistas,
  guardarContratistas,
};
