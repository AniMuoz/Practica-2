const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { ejecutar } = require("./supabaseTablas");
const { exigirClave } = require("./nucleoDatos");
const { aplicarExistencia, compactarPlanilla, filasConBodegas, filtrarPorCodigos, pintar, valorStock } = require("./planillasStock");

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

function agregarCodigoMovimiento(clave, codigoCrudo) {
  exigirClave(clave);
  const codigo = String(codigoCrudo ?? "").trim();
  if (!codigo) throw errorPeticion("Escribe un código.");
  const actuales = leerCodigosMovimientos();
  if (actuales.includes(codigo)) throw errorPeticion("Ese código ya está en la planilla.");
  const codigos = [...actuales, codigo];
  ejecutar("reemplazar", {
    tabla: "movimientos",
    columna: "codigo",
    filas: codigos.map((cod, pos) => ({ codigo: cod, pos })),
  });
  cacheCodigos = codigos;
  return { codigo };
}

const CODIGO_DESCONOCIDO = "Código desconocido en la base de datos";

function planillaMovimientos() {
  const porCodigo = new Map(filasConBodegas().map((fila) => [String(fila.Codigo ?? "").trim(), fila]));
  const filas = leerCodigosMovimientos()
    .map((codigo, indice) => {
      const fila = porCodigo.get(codigo);
      if (!fila) return [indice + 1, codigo, CODIGO_DESCONOCIDO, "", "", "", "", ""];
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

async function exportarMovimientos(colores = true, origenExistencia = "", filtros = null) {
  const { columnas, filas: todas } = planillaMovimientos();
  // Sin orden elegido se conserva el del archivo cargado; con uno elegido manda el de los filtros.
  const filas = filtrarPorCodigos(todas, 1, filtros, undefined, !(filtros && filtros.orden))
    .filas.map((fila, indice) => [indice + 1, ...fila.slice(1)]);
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
  agregarCodigoMovimiento,
  leerCodigosMovimientos,
  planillaMovimientos,
  exportarMovimientos,
};
