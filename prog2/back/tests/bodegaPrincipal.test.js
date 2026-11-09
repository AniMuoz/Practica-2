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

const { supabase } = require("../supabase/supabase");
supabase.from = () => ({ upsert: async () => ({ error: null }) });

const nucleo = require("../servicios/nucleoDatos");
const { stockDetallado } = require("../servicios/planillasStock");

const SEMILLA = [
  { codigo: "100", descripcion: "Perno", ubicacion: "0102-A", sub_ubicacion: "0102", stock: "10", inventario: "4", comentario: "ok", m502: "3", m503: "", ubicacion_m502: "0507-B", sub_ubicacion_m502: "0507", inventario_m502: "9", comentario_m502: "otra" },
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

test("otra bodega usa su stock, ubicación, sub-ubicación, inventario y comentario", () => {
  const tabla = en("M502", () => nucleo.leerTabla());
  const fila = tabla.filas.find((f) => f.Codigo === "100");
  assert.equal(fila.Stock, "3");
  assert.equal(fila.Ubicación, "0507-B");
  assert.equal(fila["Sub-ubicación"], "0507");
  assert.equal(fila.Inventario, "9");
  assert.equal(fila.Comentario, "otra");
  assert.equal(en("M503", () => nucleo.leerTabla()).filas.find((f) => f.Codigo === "200").Stock, "8");
  assert.equal(en("M503", () => nucleo.leerTabla()).filas.find((f) => f.Codigo === "200").Ubicación, "");
});

test("actualizarMaterial en otra bodega escribe sus columnas y no toca M501", async () => {
  await en("M502", () => nucleo.actualizarMaterial("100", { inventario: "12", comentario: "nuevo" }));
  const crudo = nucleo.materialesEnCache().porFilaBodega.get("100");
  assert.equal(crudo["Inventario M502"], 12);
  assert.equal(crudo["Comentario M502"], "nuevo");
  assert.equal(crudo.Inventario, "4");
});

test("buscarMaterial en otra bodega usa su stock y lista M501 entre las demás", () => {
  const { fila, bodegas } = en("M502", () => nucleo.buscarMaterial("100"));
  assert.equal(fila.Stock, "3");
  assert.deepEqual(bodegas.map((b) => b.bodega), ["M501"]);
});

test("stock detallado: la principal va aparte y las otras cuatro de menor a mayor", () => {
  const { columnas, filas } = en("M503", () => stockDetallado());
  assert.deepEqual(columnas.slice(3, 10), ["M503", "Precio x Unidad", "Caracteristica", "M501", "M502", "M504", "M505"]);
  const fila = filas.find((f) => f[1] === "200");
  assert.deepEqual([fila[3], fila[6], fila[7], fila[8], fila[9]], [8, 2, "", "", ""]);
  const m501 = stockDetallado();
  assert.deepEqual(m501.columnas.slice(3, 10), ["M501", "Precio x Unidad", "Caracteristica", "M502", "M503", "M504", "M505"]);
});

test("la carga de la planilla principal en otra bodega escribe en sus columnas y conserva M501", async () => {
  const { importarPlanilla } = require("../servicios/importaciones");
  const { columnas, filas } = en("M503", () => nucleo.leerTabla());
  const encabezado = columnas.filter((c) => c !== "Marcado");
  const fila = encabezado.map((c) => ({ Codigo: "200", Descripcion: "Tuerca", Stock: 5, "Ubicación": "0909-Z", "Sub-ubicación": "0909", Inventario: 7 }[c] ?? ""));
  const libro = nucleo.XLSX.utils.book_new();
  nucleo.XLSX.utils.book_append_sheet(libro, nucleo.XLSX.utils.aoa_to_sheet([encabezado, fila]), "Hoja1");
  const buffer = nucleo.XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
  const resultado = await en("M503", () => importarPlanilla(process.env.CLAVE_DATOS, buffer));
  assert.equal(resultado.actualizados, 1);
  const crudo = nucleo.materialesEnCache().porFilaBodega.get("200");
  assert.equal(String(crudo.M503), "5");
  assert.equal(crudo["Ubicación M503"], "0909-Z");
  assert.equal(crudo["Inventario M503"], 7);
  assert.equal(crudo.Stock, "2");
  assert.ok(filas.length > 0);
});
