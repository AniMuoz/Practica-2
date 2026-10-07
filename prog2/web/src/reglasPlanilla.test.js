import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarFilaRecibida,
  bodegasDe,
  claveUltimaCarga,
  colorCantidad,
  colorCelda,
  colorInventario,
  colorLibre,
  colorStockDetallado,
  columnasSinImagen,
  consultaExcel,
  estadoInventario,
  filasInventarioVisibles,
  filtrarFilas,
  rangoPagina,
  rutaExcel,
  rutaExcelInventario,
  subUbicacionesDe,
  textoCampo,
  validarContratistas,
} from "./reglasPlanilla.js";

const fila = {
  Codigo: "10",
  Descripcion: "Codo",
  Stock: "4",
  Inventario: "4",
  Comentario: "",
  Marcado: "",
  "Stock critico": "5",
  "Ubicación": "01-A",
  "Sub-ubicación": "01-A",
  Precio: "100",
};

test("el inventario verde coincide con el stock y el rojo no", () => {
  assert.equal(colorInventario("Inventario", fila), "#5DBB63");
  assert.equal(colorInventario("Inventario", { ...fila, Inventario: "1" }), "#FF0000");
  assert.equal(colorInventario("Codigo", fila), undefined);
  assert.equal(colorInventario("Comentario", { ...fila, Comentario: "falta" }), "#EFA94A");
});

test("la celda marcada pinta el stock y el crítico cambia en modo oscuro", () => {
  assert.equal(colorCelda("Stock", { ...fila, Marcado: "1" }, false), "#88DC65");
  assert.equal(colorCelda("Descripcion", fila, false), "#FFFF00");
  assert.equal(colorCelda("Descripcion", fila, true), "#A711D0");
  assert.equal(colorCelda("Descripcion", { ...fila, "Stock critico": "" }, false), undefined);
});

test("el detalle explica si el inventario coincide, difiere o tiene comentario", () => {
  assert.equal(estadoInventario(null), null);
  assert.equal(estadoInventario(fila).texto, "Inventario igual al stock");
  assert.equal(estadoInventario({ ...fila, Inventario: "2" }).texto, "Inventario distinto al stock");
  assert.equal(estadoInventario({ ...fila, Comentario: "ok" }).texto, "Hay comentario");
  assert.equal(estadoInventario({ ...fila, Inventario: "" }), null);
});

test("bodegas y sub-ubicaciones salen de los dos primeros caracteres", () => {
  const filas = [
    { "Ubicación": "02-B", "Sub-ubicación": "02" },
    { "Ubicación": "01-A", "Sub-ubicación": "01-A" },
    { "Ubicación": "1", "Sub-ubicación": "" },
  ];
  assert.deepEqual(bodegasDe(filas), ["01", "02"]);
  assert.deepEqual(subUbicacionesDe(filas, "01"), ["01-A"]);
});

test("los filtros de la planilla descartan stock vacío y nulos", () => {
  const filas = [
    fila,
    { ...fila, Codigo: "3", Descripcion: "NULO", Stock: "9" },
    { ...fila, Codigo: "8", Stock: "" },
  ];
  const visibles = filtrarFilas(filas, { ignorarNulo: true, orden: "codigo-asc" });
  assert.deepEqual(visibles.map((item) => item.Codigo), ["10"]);
});

test("la descarga lleva los filtros activos", () => {
  assert.equal(consultaExcel({ colores: true }), "/api/tabla/excel");
  assert.equal(
    consultaExcel({ colores: false, bodega: "01", soloMarcados: true, stockMinimo: " 2 " }),
    "/api/tabla/excel?colores=0&bodega=01&stockMinimo=2&marcado=1"
  );
});

test("una fila recibida reemplaza, agrega o cambia de código", () => {
  const actuales = [{ Codigo: "1" }, { Codigo: "2" }];
  assert.equal(aplicarFilaRecibida(actuales, { fila: { Codigo: "3" } }).length, 3);
  assert.equal(aplicarFilaRecibida(actuales, { fila: { Codigo: "2", Stock: "1" } })[1].Stock, "1");
  const cambiada = aplicarFilaRecibida(actuales, { fila: { Codigo: "2" }, codigoAnterior: "1" });
  assert.deepEqual(cambiada.map((item) => item.Codigo), ["2"]);
});

test("el rango de página y las columnas de imagen", () => {
  assert.equal(rangoPagina(0, 100, 0), "0 de 0");
  assert.equal(rangoPagina(1, 100, 150), "101–150 de 150");
  assert.deepEqual(columnasSinImagen(["Codigo", "Rombo", "QR", "Foto"]), ["Codigo"]);
  assert.equal(textoCampo(null), "");
  assert.equal(textoCampo(4), "4");
});

test("las rutas de Excel agregan colores y existencia", () => {
  assert.equal(rutaExcel("/api/bodega/excel", true), "/api/bodega/excel");
  assert.equal(rutaExcel("/api/bodega/excel?x=1", false), "/api/bodega/excel?x=1&colores=0");
  assert.equal(
    rutaExcelInventario("/api/inventario/excel", false, true, false),
    "/api/inventario/excel?colores=0&inventario=1"
  );
  const vista = filasInventarioVisibles([["c", "d", "u", "s", 4, "", "9"]], true, false);
  assert.equal(vista[0][5], "9");
});

test("los colores de stock distinguen cero, vacío y marcado", () => {
  assert.equal(colorLibre(0), "#d3d3d3");
  assert.equal(colorLibre("          "), "#f9e37c");
  assert.equal(colorLibre(3), "#73c883");
  assert.equal(colorCantidad(""), "#f9e37c");
  assert.equal(colorStockDetallado(3, 2, true), "#00FF00");
  assert.equal(colorStockDetallado(1, 2, true), "var(--superficie)");
  assert.equal(colorStockDetallado(4, "Sin precio", false), "#f9e37c");
});

test("los contratistas necesitan nombre e id único", () => {
  assert.match(validarContratistas([{ id: "1", nombre: " " }]), /nombre/);
  assert.match(validarContratistas([{ id: "1", nombre: "A" }, { id: "1", nombre: "B" }]), /repetido/);
  assert.equal(validarContratistas([{ id: "1", nombre: "A" }]), "");
  assert.equal(claveUltimaCarga("dos-columnas", "Precio"), "dos-columnas:Precio");
  assert.equal(claveUltimaCarga("sap", ""), "sap");
});
