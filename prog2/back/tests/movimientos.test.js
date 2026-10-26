process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");

// Los módulos toman estas funciones al cargarse: se reemplazan antes por datos en memoria.
const tablas = require("../supabaseTablas");
let bd;
const operaciones = [];
tablas.ejecutar = (operacion, carga) => {
  operaciones.push({ operacion, ...carga });
  if (operacion === "leer") return bd[carga.tabla] ?? [];
  if (operacion === "reemplazar") {
    bd[carga.tabla] = carga.filas;
    return null;
  }
  throw new Error(`operación inesperada: ${operacion}`);
};

const nucleo = require("../nucleoDatos");
const MATERIALES = [
  { Codigo: "100", Descripcion: "Perno", Stock: "10", "Ubicación": "01-A", "Sub-ubicación": "01-A", Inventario: " 9 " },
  { Codigo: "200", Descripcion: "Tuerca", Stock: "0", "Ubicación": "", "Sub-ubicación": "" },
  { Codigo: "300", Descripcion: "Clavo", Stock: "4", "Ubicación": "02-B", "Sub-ubicación": "02-B" },
];
nucleo.cargarMateriales = () => ({ filasBodega: MATERIALES });
const CLAVE = nucleo.CLAVE_DATOS;

function cargar(inicial = {}) {
  bd = { movimientos: [], ...inicial };
  operaciones.length = 0;
  delete require.cache[require.resolve("../movimientos")];
  return require("../movimientos");
}

function excel(matriz) {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Hoja1");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}

async function leerLibro(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return libro.worksheets[0];
}

test("importarMovimientos exige la clave", () => {
  const { importarMovimientos } = cargar();
  assert.throws(() => importarMovimientos("mala", excel([["Codigo"], ["100"]])), { status: 403 });
  assert.equal(operaciones.length, 0);
});

test("importarMovimientos rechaza archivos sin encabezado o sin códigos", () => {
  const { importarMovimientos } = cargar();
  assert.throws(() => importarMovimientos(CLAVE, excel([["", ""], ["100"]])), { status: 400, message: /encabezado/ });
  assert.throws(() => importarMovimientos(CLAVE, excel([["Codigo"], [""]])), { status: 400, message: /códigos/ });
  assert.equal(operaciones.length, 0);
});

test("importarMovimientos reemplaza la carga anterior, conserva el orden y descarta repetidos", () => {
  const { importarMovimientos, leerCodigosMovimientos } = cargar({ movimientos: [{ codigo: "viejo", pos: 0 }] });
  const resultado = importarMovimientos(CLAVE, excel([["Codigo"], [300], ["100"], [" 300 "], [""], ["999"]]));
  assert.deepEqual(resultado, { agregados: 3, actualizados: 0, omitidos: 1 });
  assert.deepEqual(bd.movimientos, [{ codigo: "300", pos: 0 }, { codigo: "100", pos: 1 }, { codigo: "999", pos: 2 }]);
  const reemplazo = operaciones.find((operacion) => operacion.operacion === "reemplazar");
  assert.equal(reemplazo.columna, "codigo");
  assert.deepEqual(leerCodigosMovimientos(), ["300", "100", "999"]);
});

test("leerCodigosMovimientos ordena por posición y guarda el resultado", () => {
  const { leerCodigosMovimientos } = cargar({ movimientos: [{ codigo: "b", pos: 1 }, { codigo: "a", pos: 0 }] });
  const codigos = leerCodigosMovimientos();
  assert.deepEqual(codigos, ["a", "b"]);
  const consultas = operaciones.length;
  assert.equal(leerCodigosMovimientos(), codigos);
  assert.equal(operaciones.length, consultas);
});

test("planillaMovimientos rescata los datos por código, numera y marca códigos desconocidos", () => {
  const { planillaMovimientos } = cargar({ movimientos: [{ codigo: "300", pos: 0 }, { codigo: "999", pos: 1 }, { codigo: "100", pos: 2 }, { codigo: "200", pos: 3 }] });
  const { columnas, filas } = planillaMovimientos();
  assert.deepEqual(columnas, ["N°", "Código", "Descripción", "Ubicación", "Sub-Ubicación", "M501", "Físico"]);
  assert.deepEqual(filas, [
    [1, "300", "Clavo", "02-B", "02-B", 4, "", ""],
    [2, "999", "Código desconocido en la base de datos", "", "", "", "", ""],
    [3, "100", "Perno", "01-A", "01-A", 10, "", "9"],
    [4, "200", "Tuerca", "", "", 0, "", ""],
  ]);
});

test("exportarMovimientos escribe encabezados y rellena Físico según el origen", async () => {
  const { exportarMovimientos } = cargar({ movimientos: [{ codigo: "100", pos: 0 }] });
  const normal = await leerLibro(await exportarMovimientos(true, ""));
  assert.equal(normal.name, "Movimientos");
  assert.deepEqual([1, 2, 3, 6, 7].map((c) => normal.getCell(1, c).value), ["N°", "Código", "Descripción", "M501", "Físico"]);
  assert.equal(normal.getCell(2, 3).value, "Perno");
  assert.equal(normal.getCell(2, 7).value, "");
  assert.equal(normal.getCell(1, 1).fill?.fgColor?.argb, "FFA9E5E5");
  const libre = await leerLibro(await exportarMovimientos(true, "libre"));
  assert.equal(libre.getCell(2, 7).value, 10);
  const inventario = await leerLibro(await exportarMovimientos(false, "inventario"));
  assert.equal(inventario.getCell(2, 7).value, "9");
  assert.equal(inventario.getCell(1, 1).fill?.fgColor?.argb, undefined);
});
