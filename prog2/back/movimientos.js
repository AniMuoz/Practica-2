const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { ejecutar } = require("./supabaseTablas");
const { exigirClave } = require("./nucleoDatos");
const { aplicarExistencia, compactarPlanilla, filasConBodegas, pintar, valorStock } = require("./planillasStock");

const COLUMNAS_MOVIMIENTOS = ["N°", "Código", "Descripción", "Ubicación", "Sub-Ubicación", "M501", "Físico"];
// Cada fila trae además, al final, el inventario: solo sirve para rellenar "Físico".
const POSICIONES_MOVIMIENTOS = { libre: 5, destino: 6, inventario: 7 };

let cacheCodigos = null;

function errorPeticion(mensaje) {
  const error = new Error(mensaje);
  error.status = 400;
  return error;
}

function leerCodigosMovimientos() {
  if (cacheCodigos) return cacheCodigos;
  const filas = ejecutar("leer", { tabla: "movimientos" }) || [];
  cacheCodigos = [...filas].sort((a, b) => a.pos - b.pos).map((fila) => String(fila.codigo));
  return cacheCodigos;
}

function importarMovimientos(clave, buffer) {
  exigirClave(clave);
  const libro = XLSX.read(buffer, { type: "buffer" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) throw errorPeticion("El archivo no tiene hojas.");
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  if (String(matriz[0]?.[0] ?? "").trim() === "") throw errorPeticion("La planilla no tiene encabezado.");
  const leidos = matriz.slice(1).map((fila) => String(fila[0] ?? "").trim()).filter(Boolean);
  const codigos = [...new Set(leidos)];
  if (codigos.length === 0) throw errorPeticion("La planilla no tiene códigos de material.");
  ejecutar("reemplazar", {
    tabla: "movimientos",
    columna: "codigo",
    filas: codigos.map((codigo, pos) => ({ codigo, pos })),
  });
  cacheCodigos = codigos;
  return { agregados: codigos.length, actualizados: 0, omitidos: leidos.length - codigos.length };
}

function planillaMovimientos() {
  const porCodigo = new Map(filasConBodegas().map((fila) => [String(fila.Codigo ?? "").trim(), fila]));
  const filas = leerCodigosMovimientos()
    .filter((codigo) => porCodigo.has(codigo))
    .map((codigo, indice) => {
      const fila = porCodigo.get(codigo);
      return [
        indice + 1,
        codigo,
        fila.Descripcion ?? "",
        fila["Ubicación"] ?? "",
        fila["Sub-ubicación"] ?? "",
        valorStock(fila.Stock) ?? "",
        "",
        String(fila.Inventario ?? "").trim(),
      ];
    });
  return { columnas: COLUMNAS_MOVIMIENTOS, filas };
}

async function exportarMovimientos(colores = true, origenExistencia = "") {
  const { columnas, filas } = planillaMovimientos();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Movimientos");
  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA9E5E5" } };

  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(1, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });
  aplicarExistencia(filas, origenExistencia, POSICIONES_MOVIMIENTOS).forEach((fila, indice) => {
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(indice + 2, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
    });
  });
  hoja.autoFilter = `A1:G${Math.max(filas.length + 1, 1)}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

module.exports = {
  importarMovimientos,
  leerCodigosMovimientos,
  planillaMovimientos,
  exportarMovimientos,
};
