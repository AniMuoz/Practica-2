import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarFilaRecibida,
  bodegasDe,
  colorCantidad,
  colorCelda,
  colorInventario,
  colorLibre,
  colorStockDetallado,
  consultaExcel,
  estadoInventario,
  filasInventarioVisibles,
  numerarFilas,
  POSICIONES_MOVIMIENTOS,
  filtrarFilas,
  normalizarBusqueda,
  rangoPagina,
  rutaExcelInventario,
  subUbicacionesDe,
} from "../src/reglasPlanilla.js";

const A = {
  Codigo: "10", Descripcion: "Codo PVC", Stock: "4", Precio: "100", "Ubicación": "01-A", "Sub-ubicación": "01-A",
  "Stock critico": "5", Inventario: "", Comentario: "", Marcado: "1",
};
const B = {
  Codigo: "2", Descripcion: "Tubo", Stock: "0", Precio: "", "Ubicación": "02-B", "Sub-ubicación": "02-B",
  "Stock critico": "", Inventario: "3", Comentario: "", Marcado: "",
};
const C = {
  Codigo: "33", Descripcion: "Válvula", Stock: "20", Precio: "50", "Ubicación": "", "Sub-ubicación": "",
  "Stock critico": "10", Inventario: "", Comentario: "revisar", Marcado: "",
};
const FILAS = [A, B, C];
const codigos = (lista) => lista.map((fila) => fila.Codigo);

// ---------- filtrarFilas ----------

test("sin filtros solo quedan las filas con stock", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, {})), ["10", "2", "33"]);
  assert.deepEqual(codigos(filtrarFilas([...FILAS, { ...A, Codigo: "9", Stock: "  " }], {})), ["10", "2", "33"]);
});

test("filtra por bodega y sub-ubicación", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, { bodega: "01" })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { subUbicacion: "02-B" })), ["2"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { bodega: "01", subUbicacion: "02-B" })), []);
});

test("el stock mínimo incluye el valor exacto y acepta cero", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, { stockMinimo: "4" })), ["10", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { stockMinimo: 5 })), ["33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { stockMinimo: "0" })), ["10", "2", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { stockMinimo: "  " })), ["10", "2", "33"]);
});

test("los filtros de precio, ubicación, crítico, inventario y marcados", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloConPrecio: true })), ["10", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloConUbicacion: true })), ["10", "2"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloStockCritico: true })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloInventarioOComentario: true })), ["2", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloMarcados: true })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloStockCero: true })), ["2"]);
});

test("stock crítico incluye el caso en que el stock es igual al crítico", () => {
  const igual = { ...A, Stock: "5" };
  assert.deepEqual(codigos(filtrarFilas([igual], { soloStockCritico: true })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas([{ ...A, Stock: "6" }], { soloStockCritico: true })), []);
});

test("la búsqueda de texto ignora acentos y mayúsculas, mira código y descripción y exige 2 letras", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "VÁLV" })), ["33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "valvula" })), ["33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "33" })), ["33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "pvc" })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "v" })), ["10", "2", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { texto: "zzz" })), []);
});

test("el orden por código es numérico (2 antes que 10) y el de descripción respeta el idioma", () => {
  assert.deepEqual(codigos(filtrarFilas(FILAS, { orden: "codigo-asc" })), ["2", "10", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { orden: "codigo" })), ["33", "10", "2"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { orden: "descripcion" })), ["10", "2", "33"]);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { orden: "descripcion-desc" })), ["33", "2", "10"]);
});

test("el orden por código acepta códigos no numéricos", () => {
  const mezcla = [{ ...A, Codigo: "B2" }, { ...A, Codigo: "A10" }, { ...A, Codigo: "A9" }];
  assert.deepEqual(codigos(filtrarFilas(mezcla, { orden: "codigo-asc" })), ["A9", "A10", "B2"]);
});

test("filtrar no modifica la lista original y combina filtros", () => {
  const copia = [...FILAS];
  filtrarFilas(FILAS, { orden: "codigo-asc" });
  assert.deepEqual(FILAS, copia);
  assert.deepEqual(codigos(filtrarFilas(FILAS, { soloConPrecio: true, stockMinimo: "10", texto: "va" })), ["33"]);
  assert.deepEqual(codigos(filtrarFilas([], { orden: "codigo" })), []);
});

test("ignorarNulo oculta NULO sin importar mayúsculas ni espacios", () => {
  const nulo = { ...A, Codigo: "7", Descripcion: " nulo " };
  assert.deepEqual(codigos(filtrarFilas([A, nulo], { ignorarNulo: true })), ["10"]);
  assert.deepEqual(codigos(filtrarFilas([A, nulo], {})), ["10", "7"]);
});

// ---------- normalizarBusqueda ----------

test("normalizarBusqueda quita acentos, pasa a minúsculas y recorta", () => {
  assert.equal(normalizarBusqueda("  ÁÉÍ Ñu "), "aei nu");
  assert.equal(normalizarBusqueda(null), "");
  assert.equal(normalizarBusqueda(undefined), "");
  assert.equal(normalizarBusqueda(42), "42");
});

// ---------- consultaExcel ----------

test("consultaExcel envía todos los filtros activos y recorta el texto", () => {
  const url = consultaExcel({
    colores: false, orden: "codigo", bodega: "01", subUbicacion: "01-A", stockMinimo: 3,
    soloConPrecio: true, soloConUbicacion: true, soloStockCritico: true, soloStockCero: true,
    soloInventarioOComentario: true, soloMarcados: true, ignorarNulo: true, texto: "  codo ",
  });
  const params = new URL(url, "http://x").searchParams;
  assert.equal(new URL(url, "http://x").pathname, "/api/tabla/excel");
  assert.deepEqual(Object.fromEntries(params), {
    colores: "0", orden: "codigo", bodega: "01", subUbicacion: "01-A", stockMinimo: "3",
    precio: "1", ubicacion: "1", critico: "1", stockCero: "1", inventario: "1", marcado: "1",
    ignorarNulo: "1", q: "codo",
  });
});

test("consultaExcel no envía filtros vacíos ni búsquedas de una letra", () => {
  assert.equal(consultaExcel({ colores: true, texto: "a", stockMinimo: " ", orden: "" }), "/api/tabla/excel");
  assert.equal(consultaExcel({ colores: true, stockMinimo: 0 }), "/api/tabla/excel?stockMinimo=0");
});

// ---------- colores e inventario ----------

test("colorInventario compara numéricamente y trata lo no numérico como diferente", () => {
  assert.equal(colorInventario("Inventario", { Stock: "4.0", Inventario: "4" }), "#5DBB63");
  assert.equal(colorInventario("Inventario", { Stock: "4", Inventario: "abc" }), "#FF0000");
  assert.equal(colorInventario("Inventario", { Stock: "", Inventario: "4" }), "#FF0000");
  assert.equal(colorInventario("Inventario", { Stock: "4", Inventario: "" }), undefined);
  assert.equal(colorInventario("Inventario", { Stock: "4", Inventario: "4", Comentario: " x " }), "#EFA94A");
  assert.equal(colorInventario("Stock", { Stock: "4", Inventario: "4" }), undefined);
});

test("estadoInventario le da prioridad al comentario y distingue igual de distinto", () => {
  assert.deepEqual(estadoInventario({ Stock: "4", Inventario: "4", Comentario: "x" }), { color: "#EFA94A", texto: "Hay comentario" });
  assert.equal(estadoInventario({ Stock: "4.0", Inventario: "4" }).texto, "Inventario igual al stock");
  assert.equal(estadoInventario({ Stock: "", Inventario: "4" }).texto, "Inventario distinto al stock");
  assert.equal(estadoInventario({ Stock: "4", Inventario: "x" }).texto, "Inventario distinto al stock");
});

test("colorCelda marca el stock crítico (incluido el igual) y respeta el marcado", () => {
  assert.equal(colorCelda("Codigo", { Stock: "5", "Stock critico": "5" }, false), "#FFFF00");
  assert.equal(colorCelda("Codigo", { Stock: "6", "Stock critico": "5" }, false), undefined);
  assert.equal(colorCelda("Codigo", { Stock: "abc", "Stock critico": "5" }, false), undefined);
  assert.equal(colorCelda("Codigo", { Stock: "5", "Stock critico": "x" }, false), undefined);
  assert.equal(colorCelda("Stock", { Stock: "1", Marcado: "1" }, false), "#88DC65");
  assert.equal(colorCelda("Descripcion", { Stock: "1", Marcado: "1", "Stock critico": "" }, false), undefined);
  assert.equal(colorCelda("Inventario", { Stock: "4", Inventario: "4" }, false), "#5DBB63");
});

test("los colores de stock cubren cero, vacío, sin precio y columnas no coloreadas", () => {
  assert.equal(colorLibre("0"), "#d3d3d3");
  assert.equal(colorLibre(""), "#73c883");
  assert.equal(colorCantidad(0), "#d3d3d3");
  assert.equal(colorCantidad(null), "#f9e37c");
  assert.equal(colorCantidad("          "), "#f9e37c");
  assert.equal(colorCantidad(5), "#73c883");
  assert.equal(colorStockDetallado(0, 0, false), "#d3d3d3");
  assert.equal(colorStockDetallado(5, "Sin precio", false), "#f9e37c");
  assert.equal(colorStockDetallado(5, 7, false), "#73c883");
  assert.equal(colorStockDetallado(1, 0, false), "var(--superficie)");
  assert.equal(colorStockDetallado(11, 5, true), "var(--superficie)");
  assert.equal(colorStockDetallado(3, 5, true), "#00FF00");
  assert.equal(colorStockDetallado(2, 5, true), "#73c883");
});

// ---------- listas y paginación ----------

test("bodegasDe quita repetidos, ignora ubicaciones cortas y ordena numéricamente", () => {
  const filas = [
    { "Ubicación": "10-A" }, { "Ubicación": "09-B" }, { "Ubicación": "09-C" }, { "Ubicación": "5" }, { "Ubicación": " 02-X" }, {},
  ];
  assert.deepEqual(bodegasDe(filas), ["02", "09", "10"]);
  assert.deepEqual(bodegasDe([]), []);
});

test("subUbicacionesDe sin bodega junta todas, sin repetidos ni vacías", () => {
  const filas = [
    { "Ubicación": "01-A", "Sub-ubicación": "01-B" },
    { "Ubicación": "01-A", "Sub-ubicación": "01-A" },
    { "Ubicación": "02-A", "Sub-ubicación": "01-A" },
    { "Ubicación": "02-A", "Sub-ubicación": "" },
  ];
  assert.deepEqual(subUbicacionesDe(filas, ""), ["01-A", "01-B"]);
  assert.deepEqual(subUbicacionesDe(filas, "02"), ["01-A"]);
  assert.deepEqual(subUbicacionesDe(filas, "99"), []);
});

test("aplicarFilaRecibida no modifica la lista y al renombrar elimina el duplicado", () => {
  const actuales = [{ Codigo: "1" }, { Codigo: "2" }, { Codigo: "3" }];
  const copia = JSON.parse(JSON.stringify(actuales));
  const resultado = aplicarFilaRecibida(actuales, { fila: { Codigo: "3", nota: "nueva" }, codigoAnterior: "1" });
  assert.deepEqual(actuales, copia);
  assert.deepEqual(resultado, [{ Codigo: "3", nota: "nueva" }, { Codigo: "2" }]);
  assert.deepEqual(aplicarFilaRecibida([{ Codigo: 5 }], { fila: { Codigo: "5", x: 1 } }), [{ Codigo: "5", x: 1 }]);
  assert.deepEqual(aplicarFilaRecibida(actuales, { fila: { Codigo: "9" }, codigoAnterior: "77" }).length, 4);
});

test("rangoPagina muestra la última página parcial y la primera completa", () => {
  assert.equal(rangoPagina(0, 100, 250), "1–100 de 250");
  assert.equal(rangoPagina(2, 100, 250), "201–250 de 250");
  assert.equal(rangoPagina(0, 100, 7), "1–7 de 7");
});

test("rutaExcelInventario prioriza copiar inventario y respeta los parámetros ya presentes", () => {
  assert.equal(rutaExcelInventario("/x", true, true, true), "/x?inventario=1");
  assert.equal(rutaExcelInventario("/x", true, false, true), "/x?existencia=1");
  assert.equal(rutaExcelInventario("/x", true, false, false), "/x");
  assert.equal(rutaExcelInventario("/x?a=1", false, false, true), "/x?a=1&colores=0&existencia=1");
});

test("filasInventarioVisibles recorta a 6 columnas y copia inventario o existencia en la última", () => {
  const origen = [["c", "d", "u", "s", 4, "orig", "inv"], ["c2", "d2", "u2", "s2", 8, "orig2"]];
  assert.deepEqual(filasInventarioVisibles(origen, false, false), [["c", "d", "u", "s", 4, "orig"], ["c2", "d2", "u2", "s2", 8, "orig2"]]);
  assert.deepEqual(filasInventarioVisibles(origen, true, false).map((fila) => fila[5]), ["inv", ""]);
  assert.deepEqual(filasInventarioVisibles(origen, false, true).map((fila) => fila[5]), [4, 8]);
  assert.equal(origen[0][5], "orig");
});

test("filasInventarioVisibles con las posiciones de movimientos rellena Físico y numerarFilas renumera", () => {
  const origen = [[1, "c", "d", "u", "s", 4, "", "inv"], [2, "c2", "d2", "u2", "s2", 8, "", ""]];
  assert.deepEqual(filasInventarioVisibles(origen, false, true, POSICIONES_MOVIMIENTOS).map((fila) => fila[6]), [4, 8]);
  assert.deepEqual(filasInventarioVisibles(origen, true, false, POSICIONES_MOVIMIENTOS).map((fila) => fila[6]), ["inv", ""]);
  assert.deepEqual(numerarFilas([[7, "a"], [9, "b"]]), [[1, "a"], [2, "b"]]);
});
