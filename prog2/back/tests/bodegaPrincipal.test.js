process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");

const tablas = require("../supabase/supabaseTablas");
let bd;
tablas.ejecutar = (operacion, carga) => {
  if (operacion === "leer") return bd[carga.tabla] ?? [];
  if (operacion === "reemplazar") {
    bd[carga.tabla] = carga.filas;
    return null;
  }
  throw new Error(`operación inesperada: ${operacion}`);
};

const nucleo = require("../servicios/nucleoDatos");
const { stockDetallado } = require("../servicios/planillasStock");

const SEMILLA = [
  { codigo: "100", descripcion: "Perno", ubicacion: "0102-A", sub_ubicacion: "0102", stock: "10", inventario: "4", comentario: "ok", m502: "3", m503: "" },
  { codigo: "200", descripcion: "Tuerca", stock: "2", m502: "", m503: "8" },
];

test.before(async () => {
  bd = { materiales: SEMILLA.map((fila) => ({ ...fila })), planillas: [] };
  await nucleo.cargarMateriales();
});

const en = (bodega, fn) => nucleo.contextoBodega.run({ bodega }, fn);

test("bodegaValida acepta M501-M505 y cae a M501 con cualquier otro valor", () => {
  assert.equal(nucleo.bodegaValida("m503"), "M503");
  assert.equal(nucleo.bodegaValida("M999"), "M501");
  assert.equal(nucleo.bodegaValida(undefined), "M501");
});

test("M501 (o sin contexto) deja la tabla igual", () => {
  const tabla = nucleo.leerTabla();
  assert.ok(tabla.columnas.includes("Ubicación"));
  assert.equal(tabla.filas.find((f) => f.Codigo === "100").Stock, "10");
  assert.equal(en("M501", () => nucleo.leerTabla()), tabla);
});

test("otra bodega muestra su stock y oculta ubicación, sub-ubicación, inventario y comentario", () => {
  const tabla = en("M502", () => nucleo.leerTabla());
  ["Ubicación", "Sub-ubicación", "Inventario", "Comentario"].forEach((c) => assert.ok(!tabla.columnas.includes(c)));
  const fila = tabla.filas.find((f) => f.Codigo === "100");
  assert.equal(fila.Stock, "3");
  assert.equal(fila.Ubicación, undefined);
  assert.equal(en("M503", () => nucleo.leerTabla()).filas.find((f) => f.Codigo === "200").Stock, "8");
});

test("buscarMaterial en otra bodega usa su stock y lista M501 entre las demás", () => {
  const { fila, bodegas } = en("M502", () => nucleo.buscarMaterial("100"));
  assert.equal(fila.Stock, "3");
  assert.deepEqual(bodegas.map((b) => b.bodega), ["M501"]);
});

test("stock detallado intercambia M501 con la bodega principal", () => {
  const { columnas, filas } = en("M502", () => stockDetallado());
  assert.equal(columnas[3], "M502");
  assert.equal(columnas[columnas.indexOf("M501")], "M501");
  assert.equal(filas.find((f) => f[1] === "100")[3], 3);
  assert.equal(filas.find((f) => f[1] === "100")[columnas.indexOf("M501")], 10);
});