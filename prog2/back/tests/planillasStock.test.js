process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

// planillasStock.js toma estas funciones al cargarse: se reemplazan por datos en memoria.
const nucleo = require("../nucleoDatos");

const MATERIALES = [
  { Codigo: "1", Descripcion: "Perno", Stock: "5", M502: "2", M503: "", M504: "x", M505: "1", "Ubicación": "01-A", Precio: "100", "Stock critico": "6", Marcado: "1" },
  { Codigo: "2", Descripcion: "NULO", Stock: "1" },
  { Codigo: "3", Descripcion: "Tuerca", Stock: "0", M502: "0", "Ubicación": "          ", Precio: "", Marcado: "" },
];
let TABLA = { columnas: [], filas: [] };
nucleo.cargarMateriales = () => ({ filasBodega: MATERIALES });
nucleo.leerTabla = () => TABLA;

const stock = require("../planillasStock");

const INVENTARIO = [
  { Codigo: "1", Descripcion: "Perno", Stock: "5", "Ubicación": "02-A", "Sub-ubicación": "02-A", Inventario: "5" },
  { Codigo: "2", Descripcion: "NULO", Stock: "9", "Ubicación": "01-A" },
  { Codigo: "3", Descripcion: "Tuerca", Stock: "", "Ubicación": "", "Sub-ubicación": "", Inventario: "" },
  { Codigo: "4", Descripcion: "Clavo", Stock: "0", "Ubicación": "01-B", "Sub-ubicación": "01-B", Inventario: " 7 " },
  { Codigo: "5", Descripcion: "Arandela", Stock: "3", "Ubicación": "AB-1" },
];

function usarTabla(filas, columnas = []) {
  TABLA = { columnas, filas };
}

async function leerLibro(buffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return libro.worksheets[0];
}

const relleno = (hoja, fila, columna) => hoja.getCell(fila, columna).fill?.fgColor?.argb;
const valor = (hoja, fila, columna) => hoja.getCell(fila, columna).value;

// ---------- utilidades ----------

test("valorStock deja números canónicos como número y conserva lo demás", () => {
  assert.equal(stock.valorStock("5"), 5);
  assert.equal(stock.valorStock(" 7 "), 7);
  assert.equal(stock.valorStock("0"), 0);
  assert.equal(stock.valorStock(""), null);
  assert.equal(stock.valorStock(undefined), null);
  assert.equal(stock.valorStock("5.0"), "5.0");
  assert.equal(stock.valorStock("abc"), "abc");
});

test("claveUbicacion ordena las ubicaciones vacías al final y las no numéricas después de las numéricas", () => {
  assert.deepEqual(stock.claveUbicacion(""), [1, 0]);
  assert.deepEqual(stock.claveUbicacion(null), [1, 0]);
  assert.deepEqual(stock.claveUbicacion("   "), [1, 0]);
  assert.deepEqual(stock.claveUbicacion("05-A"), [0, 5]);
  assert.deepEqual(stock.claveUbicacion(" 12"), [0, 12]);
  assert.deepEqual(stock.claveUbicacion("AB-1"), [0, 999]);
  assert.deepEqual(stock.claveUbicacion("5"), [0, 999]);
});

test("codigoBodega toma los dos primeros dígitos o 'Sin bodega'", () => {
  assert.equal(stock.codigoBodega("02-A"), "02");
  assert.equal(stock.codigoBodega(" 03"), "03");
  assert.equal(stock.codigoBodega("AB"), "Sin bodega");
  assert.equal(stock.codigoBodega(""), "Sin bodega");
  assert.equal(stock.codigoBodega(undefined), "Sin bodega");
});

test("textoVisible convierte cada tipo de valor de celda al texto que se verá", () => {
  assert.equal(stock.textoVisible(null), "");
  assert.equal(stock.textoVisible(undefined), "");
  assert.equal(stock.textoVisible(5), "5");
  assert.equal(stock.textoVisible("hola"), "hola");
  assert.equal(stock.textoVisible(new Date(2026, 0, 5)), "5/1/2026");
  assert.equal(stock.textoVisible({ richText: [{ text: "ho" }, { text: "la" }, {}] }), "hola");
  assert.equal(stock.textoVisible({ text: "enlace" }), "enlace");
  assert.equal(stock.textoVisible({ formula: "A1", result: 42 }), "42");
  assert.equal(stock.textoVisible({ formula: "A1" }), "0000000000");
  assert.equal(stock.textoVisible({ formula: "A1", result: "" }), "0000000000");
  assert.equal(stock.textoVisible({}), "");
});

test("pintar solo aplica el relleno cuando los colores están activos", () => {
  const estilo = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123456" } };
  const con = {};
  const sin = {};
  stock.pintar(con, estilo, true);
  stock.pintar(sin, estilo, false);
  assert.equal(con.fill, estilo);
  assert.equal(sin.fill, undefined);
});

test("compactarPlanilla ajusta el ancho al texto más largo de cada columna y fija el zoom", () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("x");
  hoja.getCell("A1").value = "abc";
  hoja.getCell("A2").value = "abcdefgh";
  hoja.getCell("B1").value = "uno\ndos tres cuatro";
  hoja.getCell("C1").value = 12345;
  stock.compactarPlanilla(hoja);
  assert.equal(hoja.getColumn(1).width, 9);
  assert.equal(hoja.getColumn(2).width, "dos tres cuatro".length + 1);
  assert.equal(hoja.getColumn(3).width, 6);
  assert.equal(hoja.views[0].zoomScale, 80);
});

test("compactarPlanilla no ensancha columnas por títulos combinados en horizontal", () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("x");
  hoja.mergeCells("A1:D1");
  hoja.getCell("A1").value = "Un título larguísimo que ocupa varias columnas";
  hoja.getCell("A2").value = "ab";
  stock.compactarPlanilla(hoja);
  assert.equal(hoja.getColumn(1).width, 3);
});

test("columnaExcel pasa de Z a AA y de ZZ a AAA", () => {
  assert.equal(stock.columnaExcel(25), "Z");
  assert.equal(stock.columnaExcel(26), "AA");
  assert.equal(stock.columnaExcel(701), "ZZ");
  assert.equal(stock.columnaExcel(702), "AAA");
});

// ---------- datos de las planillas ----------

test("stockEnBodega omite NULO y deja vacío el stock vacío", () => {
  usarTabla(INVENTARIO);
  const { columnas, filas } = stock.stockEnBodega();
  assert.deepEqual(columnas, ["Código", "Descripción", "Libre utilización"]);
  assert.deepEqual(filas, [["1", "Perno", 5], ["3", "Tuerca", ""], ["4", "Clavo", 0], ["5", "Arandela", 3]]);
});

test("stockRegional suma las bodegas numéricas, omite NULO y conserva texto", () => {
  const { columnas, filas } = stock.stockRegional();
  assert.equal(columnas.length, 8);
  assert.deepEqual(filas[0], ["1", "Perno", 5, 2, "", "x", 1, 8]);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[1], ["3", "Tuerca", 0, 0, "", "", "", 0]);
});

test("stockDetallado arma 16 columnas, precio con signo o 'Sin precio' y la lista de marcados", () => {
  const { columnas, filas, marcados } = stock.stockDetallado();
  assert.equal(columnas.length, 16);
  assert.deepEqual(marcados, [true, false]);
  assert.equal(filas[0].length, 16);
  assert.equal(filas[0][0], "01-A");
  assert.equal(filas[0][1], "1");
  assert.equal(filas[0][3], 5);
  assert.equal(filas[0][4], "$100");
  assert.equal(filas[0][10], 8);
  assert.equal(filas[0][12], "6");
  assert.equal(filas[1][0], "");
  assert.equal(filas[1][4], "Sin precio");
});

test("planillaInventario ordena por bodega, deja sin ubicación al final y copia el inventario", () => {
  usarTabla(INVENTARIO);
  const { columnas, filas } = stock.planillaInventario();
  assert.equal(columnas.length, 6);
  assert.deepEqual(filas.map((fila) => fila[0]), ["4", "1", "5", "3"]);
  assert.deepEqual(filas[0], ["4", "Clavo", "01-B", "01-B", 0, "", "7"]);
  assert.equal(filas.some((fila) => fila[1] === "NULO"), false);
});

test("planillaInventarioPorBodega agrupa por bodega con 'Sin bodega' al final", () => {
  usarTabla(INVENTARIO);
  const { bodegas, grupos } = stock.planillaInventarioPorBodega();
  assert.deepEqual(bodegas, [
    { codigo: "01", cantidad: 1 },
    { codigo: "02", cantidad: 1 },
    { codigo: "Sin bodega", cantidad: 2 },
  ]);
  assert.deepEqual(grupos.get("Sin bodega").map((fila) => fila[0]), ["5", "3"]);
});

test("aplicarExistencia decide qué va en la columna Existencia sin modificar el original", () => {
  const filas = [["c", "d", "u", "s", 4, "orig", "inv"]];
  assert.deepEqual(stock.aplicarExistencia(filas, "libre")[0], ["c", "d", "u", "s", 4, 4]);
  assert.deepEqual(stock.aplicarExistencia(filas, "inventario")[0], ["c", "d", "u", "s", 4, "inv"]);
  assert.deepEqual(stock.aplicarExistencia(filas, "")[0], ["c", "d", "u", "s", 4, "orig"]);
  assert.deepEqual(stock.aplicarExistencia([["c", "d", "u", "s", 4]], "inventario")[0][5], "");
  assert.equal(filas[0].length, 7);
});

test("colorStockDetallado distingue cero, vacío y normal", () => {
  assert.equal(stock.colorStockDetallado(0), "FFD3D3D3");
  assert.equal(stock.colorStockDetallado("0"), "FFD3D3D3");
  assert.equal(stock.colorStockDetallado(""), "FFF9E37C");
  assert.equal(stock.colorStockDetallado(null), "FFF9E37C");
  assert.equal(stock.colorStockDetallado("Sin precio"), "FFF9E37C");
  assert.equal(stock.colorStockDetallado(7), "FF73C883");
  assert.deepEqual([...stock.COLUMNAS_MARCA_DETALLADO].sort((a, b) => a - b), [3, 6, 7, 8, 9, 10]);
});

// ---------- exportaciones a Excel ----------

test("exportarStockBodega escribe título, encabezados, filas y colores de stock", async () => {
  usarTabla(INVENTARIO);
  const hoja = await leerLibro(await stock.exportarStockBodega(true));
  assert.equal(hoja.name, "M501");
  assert.equal(valor(hoja, 1, 1), "Bodega");
  assert.equal(valor(hoja, 1, 2), "M501");
  assert.deepEqual([1, 2, 3].map((c) => valor(hoja, 3, c)), ["Código", "Descripción", "Libre utilización"]);
  assert.equal(valor(hoja, 4, 2), "Perno");
  assert.equal(relleno(hoja, 4, 3), "FF73C883");
  assert.equal(valor(hoja, 6, 3), 0);
  assert.equal(relleno(hoja, 6, 3), "FFD3D3D3");
  assert.equal(relleno(hoja, 3, 1), "FFA9E5E5");
});

test("exportarStockBodega con colores=false no pinta nada", async () => {
  usarTabla(INVENTARIO);
  const hoja = await leerLibro(await stock.exportarStockBodega(false));
  assert.equal(relleno(hoja, 4, 3), undefined);
  assert.equal(relleno(hoja, 3, 1), undefined);
});

test("exportarStockRegional escribe el total y pinta ceros y vacíos", async () => {
  const hoja = await leerLibro(await stock.exportarStockRegional(true));
  assert.equal(hoja.name, "Stock regional");
  assert.equal(valor(hoja, 3, 8), "Total");
  assert.equal(valor(hoja, 4, 8), 8);
  assert.equal(hoja.getCell(4, 8).font.bold, true);
  assert.equal(relleno(hoja, 4, 3), "FF73C883");
  assert.equal(relleno(hoja, 4, 5), "FFF9E37C");
  assert.equal(relleno(hoja, 5, 3), "FFD3D3D3");
  assert.equal(relleno(hoja, 4, 1), undefined);
});

test("exportarStockDetallado pinta de verde fuerte las columnas de un material marcado", async () => {
  const hoja = await leerLibro(await stock.exportarStockDetallado(true));
  assert.equal(hoja.name, "Stock detallado");
  assert.equal(valor(hoja, 3, 2), "Código");
  assert.equal(valor(hoja, 4, 5), "$100");
  assert.equal(relleno(hoja, 4, 4), "FF00FF00");
  assert.equal(relleno(hoja, 4, 11), "FF00FF00");
  assert.equal(relleno(hoja, 4, 1), "FF73C883");
  assert.equal(relleno(hoja, 5, 5), "FFF9E37C");
  assert.equal(relleno(hoja, 5, 4), "FFD3D3D3");
  assert.equal(hoja.getCell(4, 11).font.bold, true);
});

test("exportarPlanillaInventario respeta el origen de la columna Existencia y marca las celdas vacías", async () => {
  usarTabla(INVENTARIO);
  const normal = await leerLibro(await stock.exportarPlanillaInventario(true, ""));
  assert.equal(valor(normal, 1, 2), "M501");
  assert.equal(valor(normal, 4, 1), "4");
  assert.equal(relleno(normal, 7, 3), "FFF9E37C");
  assert.equal(relleno(normal, 7, 4), "FFF9E37C");
  assert.equal(relleno(normal, 4, 3), undefined);

  const libre = await leerLibro(await stock.exportarPlanillaInventario(true, "libre"));
  assert.equal(valor(libre, 4, 6), 0);
  const inventario = await leerLibro(await stock.exportarPlanillaInventario(true, "inventario"));
  assert.equal(valor(inventario, 4, 6), "7");
  const sinColor = await leerLibro(await stock.exportarPlanillaInventario(false, ""));
  assert.equal(relleno(sinColor, 7, 3), undefined);
});

test("exportarInventarioBodega exporta una bodega y responde 404 si no existe", async () => {
  usarTabla(INVENTARIO);
  const hoja = await leerLibro(await stock.exportarInventarioBodega("02", true, ""));
  assert.equal(valor(hoja, 1, 2), "02");
  assert.equal(valor(hoja, 4, 1), "1");
  assert.equal(valor(hoja, 5, 1), null);
  await assert.rejects(stock.exportarInventarioBodega("99"), { status: 404, message: /No hay materiales/ });
});

// ---------- filtros y exportación de la tabla ----------

const FILAS_TABLA = [
  { Codigo: "10", Descripcion: "Codo", Stock: "4", Precio: "100", "Ubicación": "01-A", "Sub-ubicación": "01-A", "Stock critico": "5", Inventario: "", Comentario: "", Marcado: "1" },
  { Codigo: "2", Descripcion: "Tubo", Stock: "0", Precio: "", "Ubicación": "02-B", "Sub-ubicación": "02-B", "Stock critico": "", Inventario: "3", Comentario: "", Marcado: "" },
  { Codigo: "33", Descripcion: "Válvula", Stock: "20", Precio: "50", "Ubicación": "", "Sub-ubicación": "", "Stock critico": "10", Inventario: "", Comentario: "revisar", Marcado: "" },
  { Codigo: "7", Descripcion: "nulo", Stock: "3", Precio: "1", "Ubicación": "01-A", "Sub-ubicación": "01-A", "Stock critico": "", Inventario: "", Comentario: "", Marcado: "" },
  { Codigo: "8", Descripcion: "Sin stock informado", Stock: "", Precio: "", "Ubicación": "", "Sub-ubicación": "", "Stock critico": "", Inventario: "", Comentario: "", Marcado: "" },
];
const codigos = (lista) => lista.map((fila) => fila.Codigo);

test("aplicarFiltrosTabla sin filtros descarta solo las filas sin stock", () => {
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA)), ["10", "2", "33", "7"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, {})), ["10", "2", "33", "7"]);
});

test("aplicarFiltrosTabla filtra por bodega, sub-ubicación y stock mínimo", () => {
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { bodega: "01" })), ["10", "7"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { subUbicacion: "02-B" })), ["2"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { stockMinimo: "4" })), ["10", "33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { stockMinimo: 0 })), ["10", "2", "33", "7"]);
});

test("aplicarFiltrosTabla aplica los filtros de precio, ubicación, crítico, cero, inventario y marcados", () => {
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloConPrecio: true })), ["10", "33", "7"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloConUbicacion: true })), ["10", "2", "7"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloStockCritico: true })), ["10"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloStockCero: true })), ["2"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloInventarioOComentario: true })), ["2", "33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { soloMarcados: true })), ["10"]);
});

test("aplicarFiltrosTabla oculta NULO sin importar mayúsculas y busca sin acentos", () => {
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { ignorarNulo: true })), ["10", "2", "33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { texto: "VALVULA" })), ["33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { texto: "3" })), ["10", "2", "33", "7"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { texto: "33" })), ["33"]);
});

test("aplicarFiltrosTabla ordena el código de forma numérica y la descripción según el idioma", () => {
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { orden: "codigo-asc" })), ["2", "7", "10", "33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { orden: "codigo" })), ["33", "10", "7", "2"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { orden: "descripcion" })), ["10", "7", "2", "33"]);
  assert.deepEqual(codigos(stock.aplicarFiltrosTabla(FILAS_TABLA, { orden: "descripcion-desc" })), ["33", "2", "7", "10"]);
  assert.equal(FILAS_TABLA[0].Codigo, "10");
});

test("exportarTabla excluye las columnas de imagen, aplica filtros y pinta crítico, marcado e inventario", async () => {
  const columnas = ["Codigo", "Descripcion", "Stock", "Stock critico", "Rombo", "Inventario", "Comentario"];
  usarTabla([
    { Codigo: "10", Descripcion: "Codo", Stock: "4", "Stock critico": "5", Rombo: "r.png", Inventario: "", Comentario: "", Marcado: "1" },
    { Codigo: "11", Descripcion: "Tubo", Stock: "2", "Stock critico": "5", Rombo: "", Inventario: "2", Comentario: "", Marcado: "" },
    { Codigo: "12", Descripcion: "Valvula", Stock: "9", "Stock critico": "", Rombo: "", Inventario: "4", Comentario: "", Marcado: "" },
    { Codigo: "13", Descripcion: "Llave", Stock: "9", "Stock critico": "", Rombo: "", Inventario: "", Comentario: "ojo", Marcado: "" },
  ], columnas);
  const hoja = await leerLibro(await stock.exportarTabla(true, {}));
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((c) => valor(hoja, 1, c)), ["Codigo", "Descripcion", "Stock", "Stock critico", "Inventario", "Comentario"]);
  assert.equal(valor(hoja, 7, 1), null);
  assert.equal(relleno(hoja, 1, 1), "FFA9E5E5");

  // Fila 2 (código 10): crítico pero marcado → el Stock queda verde de marcado, el resto amarillo.
  assert.equal(relleno(hoja, 2, 1), "FFFFFF00");
  assert.equal(relleno(hoja, 2, 3), "FF88DC65");
  // Fila 3 (código 11): crítico, inventario igual al stock → amarillo y celdas de inventario verdes.
  assert.equal(relleno(hoja, 3, 1), "FFFFFF00");
  assert.equal(relleno(hoja, 3, 5), "FF5DBB63");
  assert.equal(relleno(hoja, 3, 6), "FF5DBB63");
  // Fila 4 (código 12): inventario distinto → rojo. Fila 5 (código 13): comentario → naranja.
  assert.equal(relleno(hoja, 4, 5), "FFFF0000");
  assert.equal(relleno(hoja, 5, 5), "FFEFA94A");
  assert.equal(relleno(hoja, 5, 6), "FFEFA94A");
  assert.equal(relleno(hoja, 4, 1), undefined);

  const filtrada = await leerLibro(await stock.exportarTabla(true, { soloMarcados: true }));
  assert.equal(valor(filtrada, 2, 1), "10");
  assert.equal(valor(filtrada, 3, 1), null);

  const sinColores = await leerLibro(await stock.exportarTabla(false, {}));
  assert.equal(relleno(sinColores, 2, 3), undefined);
  assert.equal(relleno(sinColores, 4, 5), undefined);
});
