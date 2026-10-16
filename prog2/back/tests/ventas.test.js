process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

// Los módulos toman estas funciones al cargarse: se reemplazan antes por datos en memoria.
const tablas = require("../supabaseTablas");
tablas.ejecutar = (operacion, carga) => {
  if (operacion === "leer" && carga.tabla === "contratistas") return [{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Luis" }];
  if (operacion === "leer") return [];
  return null;
};

const MATERIALES = [
  { Codigo: "100", Descripcion: "Perno", Stock: "10", M502: "1", M503: "0", M504: "0", M505: "0", "Ubicación": "0102-A", Peso: "0,5", Precio: "100" },
  { Codigo: "200", Descripcion: "Cañería PVC", Stock: "0", M502: "0", M503: "0", M504: "0", M505: "50", "Ubicación": "          ", Peso: "2", Precio: "" },
  { Codigo: "300", Descripcion: "Pegamento", Stock: "2", "Ubicación": "          " },
];
const nucleo = require("../nucleoDatos");
nucleo.cargarMateriales = () => ({ filasBodega: MATERIALES });

const { armarReserva, columnaPorTitulo, añadirVenta } = require("../ventas");

const COLUMNAS_RESERVA = ["N°", "N° Orden", "Código", "Descripción", "Reserva", "Stock", "Ubicación", "Estado"];
const SIN_UBICACION = "No se encontro ubicación";

// ---------- armarReserva ----------

test("armarReserva lee el formato vertical (Orden / Material) y cruza con el stock", () => {
  const texto = [
    "Orden   6000123   Mantención",
    "Material 100 5",
    "Material 200 4",
    "Material 999 1",
    "Material 100 10",
  ].join("\n");
  const { columnas, filas } = armarReserva(texto);
  assert.deepEqual(columnas, COLUMNAS_RESERVA);
  assert.deepEqual(filas, [
    [1, "6000123", "100", "Perno", 5, 10, "0102-A", "Disponible"],
    [2, "6000123", "200", "Cañería PVC", 4, 0, SIN_UBICACION, "No disponible"],
    [3, "6000123", "999", "Sin descripción", 1, 0, SIN_UBICACION, "No disponible"],
    [4, "6000123", "100", "Perno", 10, 10, "0102-A", "Disponible"],
  ]);
});

test("armarReserva marca No disponible cuando se reserva más que el stock", () => {
  const { filas } = armarReserva("Orden   1   x\nMaterial 100 11");
  assert.equal(filas[0][7], "No disponible");
});

test("armarReserva lee el formato horizontal (Reserva No.) con una orden por página", () => {
  const texto = [
    "Reserva No. 12345 Fecha",
    "0010 100 Perno",
    "5,000",
    "Reserva No. 67890 Fecha",
    "0010 300 Pegamento",
    "3,000",
  ].join("\n");
  const { filas } = armarReserva(texto);
  assert.deepEqual(filas, [
    [1, "12345", "100", "Perno", 5, 10, "0102-A", "Disponible"],
    [2, "67890", "300", "Pegamento", 3, 2, SIN_UBICACION, "No disponible"],
  ]);
});

test("armarReserva con texto vacío o sin materiales devuelve solo las columnas", () => {
  for (const texto of ["", null, undefined, "\n\n  \n", "Nada que ver\notra línea"]) {
    const { columnas, filas } = armarReserva(texto);
    assert.deepEqual(columnas, COLUMNAS_RESERVA);
    assert.deepEqual(filas, []);
  }
});

test("armarReserva acepta saltos de línea de Windows", () => {
  const { filas } = armarReserva("Orden   77   x\r\nMaterial 100 1\r\n");
  assert.equal(filas.length, 1);
  assert.equal(filas[0][1], "77");
});

// ---------- columnaPorTitulo ----------

test("columnaPorTitulo prueba las opciones en orden y acepta funciones", () => {
  const claves = ["codigo", "med", "solicitado"];
  assert.equal(columnaPorTitulo(claves, "un", "med"), 1);
  assert.equal(columnaPorTitulo(claves, "med", "codigo"), 1);
  assert.equal(columnaPorTitulo(claves, (clave) => clave.startsWith("solic")), 2);
  assert.equal(columnaPorTitulo(claves, "nada", (clave) => clave === "tampoco"), -1);
  assert.equal(columnaPorTitulo([], "codigo"), -1);
});

// ---------- añadirVenta ----------

async function generar(opciones) {
  const { buffer, nombre } = await añadirVenta({ contratistaIdx: 1, movTipo: 1, almacen: "", codVenta: "", ...opciones });
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return { hoja: libro.worksheets[0], nombre, libro };
}

const valor = (hoja, fila, columna) => hoja.getCell(fila, columna).value;
const ITEMS = [{ codigo: "100", cantidad: 4 }, { codigo: "200", cantidad: 12 }, { codigo: "999", cantidad: 1 }];

test("añadirVenta crea la planilla con encabezado, filas ordenadas por descripción y totales", async () => {
  const { hoja, nombre } = await generar({ itemsManuales: ITEMS, codVenta: "55" });
  assert.equal(nombre, `VENTAS ${new Date().getFullYear()}.xlsx`);
  assert.equal(hoja.name, "Ventas");
  assert.equal(valor(hoja, 1, 1), "Pos");
  assert.equal(valor(hoja, 1, 20), "Contratistas");

  // Orden: sin descripción (999), Cañería (200), Perno (100).
  assert.deepEqual([2, 3, 4].map((fila) => valor(hoja, fila, 2)), ["999", "200", "100"]);
  assert.deepEqual([2, 3, 4].map((fila) => valor(hoja, fila, 1)), [10, 20, 30]);

  assert.equal(valor(hoja, 5, 16), "total");
  assert.equal(valor(hoja, 5, 17).formula, "SUM(Q2:Q4)");
  assert.equal(valor(hoja, 5, 19).formula, "SUM(S2:S4)");
  assert.equal(valor(hoja, 6, 1), "Pos");
});

test("añadirVenta calcula entrega, saldo, peso y valores del material con stock", async () => {
  const { hoja } = await generar({ itemsManuales: ITEMS, codVenta: "55" });
  const fila = 4; // código 100
  assert.equal(valor(hoja, fila, 3), "Perno");
  assert.equal(valor(hoja, fila, 4), "0102-A");
  assert.equal(valor(hoja, fila, 5), 10);
  assert.equal(valor(hoja, fila, 6), 1);
  assert.equal(valor(hoja, fila, 10), 4);
  assert.equal(valor(hoja, fila, 11), 4);
  assert.equal(valor(hoja, fila, 14), 6);
  assert.equal(valor(hoja, fila, 15), "VERDADERO");
  assert.equal(valor(hoja, fila, 16), 0.5);
  assert.equal(valor(hoja, fila, 17).formula, "P4*K4");
  assert.equal(valor(hoja, fila, 18), 100);
  assert.equal(valor(hoja, fila, 19), 400);
  assert.equal(valor(hoja, fila, 20), "Ana");
  assert.equal(valor(hoja, fila, 21), "VENTA");
  assert.equal(valor(hoja, fila, 22), "M501");
  assert.equal(valor(hoja, fila, 23), "55");
  assert.match(String(valor(hoja, fila, 27)), /^\d{1,2}\/\d{1,2}\/\d{4}$/);
});

test("añadirVenta marca CONCON, no entrega y calcula tiras cuando falta stock en M501 pero hay en M505", async () => {
  const { hoja } = await generar({ itemsManuales: ITEMS });
  const fila = 3; // código 200, Cañería
  assert.equal(valor(hoja, fila, 4), "CONCON");
  assert.equal(valor(hoja, fila, 11), 0);
  assert.equal(valor(hoja, fila, 15), "FALSO");
  assert.equal(valor(hoja, fila, 13), 2);
  assert.equal(valor(hoja, fila, 14), -12);
});

test("añadirVenta con un código desconocido deja ceros y no inventa ubicación", async () => {
  const { hoja } = await generar({ itemsManuales: ITEMS });
  const fila = 2; // código 999
  assert.equal(valor(hoja, fila, 5), 0);
  assert.equal(valor(hoja, fila, 11), 0);
  assert.equal(valor(hoja, fila, 14), -1);
  assert.equal(valor(hoja, fila, 18), 0);
  assert.equal(valor(hoja, fila, 19), 0);
});

test("añadirVenta usa 'n/a' si no hay número de venta y busca el contratista por posición", async () => {
  const sinNumero = await generar({ itemsManuales: [ITEMS[0]], codVenta: "" });
  assert.equal(valor(sinNumero.hoja, 2, 23), "n/a");
  const segundo = await generar({ itemsManuales: [ITEMS[0]], contratistaIdx: 2 });
  assert.equal(valor(segundo.hoja, 2, 20), "Luis");
  const fuera = await generar({ itemsManuales: [ITEMS[0]], contratistaIdx: 3 });
  assert.equal(valor(fuera.hoja, 2, 20), "n/a");
});

test("un traspaso respeta la bodega elegida solo si es válida; una venta siempre sale de M501", async () => {
  const valida = await generar({ itemsManuales: [ITEMS[0]], movTipo: 2, almacen: "M503" });
  assert.equal(valor(valida.hoja, 2, 21), "TRASPASO");
  assert.equal(valor(valida.hoja, 2, 22), "M503");
  const invalida = await generar({ itemsManuales: [ITEMS[0]], movTipo: 2, almacen: "XYZ" });
  assert.equal(valor(invalida.hoja, 2, 22), "M501");
  const venta = await generar({ itemsManuales: [ITEMS[0]], movTipo: 1, almacen: "M503" });
  assert.equal(valor(venta.hoja, 2, 21), "VENTA");
  assert.equal(valor(venta.hoja, 2, 22), "M501");
});

test("colores=false no pinta el stock", async () => {
  const con = await generar({ itemsManuales: [ITEMS[0]], colores: true });
  const sin = await generar({ itemsManuales: [ITEMS[0]], colores: false });
  assert.equal(con.hoja.getCell(2, 5).font.color.argb, "FF7CC8FF");
  assert.equal(sin.hoja.getCell(2, 5).font.color, undefined);
});

test("añadirVenta rechaza peticiones sin productos", async () => {
  await assert.rejects(añadirVenta({ contratistaIdx: 1, movTipo: 1 }), { status: 400, message: /Falta el archivo/ });
  await assert.rejects(añadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [] }), { status: 400, message: /No se encontraron productos/ });
  await assert.rejects(
    añadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [{ codigo: "", cantidad: 3 }, { codigo: "100", cantidad: 0 }] }),
    { status: 400, message: /No se encontraron productos/ }
  );
});

test("añadirVenta agrega al final de una planilla existente y renombra Comprador", async () => {
  const primera = await añadirVenta({ contratistaIdx: 1, movTipo: 1, almacen: "", codVenta: "1", itemsManuales: ITEMS });
  const previo = new ExcelJS.Workbook();
  await previo.xlsx.load(primera.buffer);
  previo.worksheets[0].getCell(1, 20).value = "Comprador";
  const ventasBuffer = await previo.xlsx.writeBuffer();

  const { hoja } = await generar({ itemsManuales: [{ codigo: "300", cantidad: 1 }], ventasBuffer, codVenta: "2" });
  assert.equal(valor(hoja, 1, 20), "Contratistas");
  assert.equal(valor(hoja, 2, 2), "999");
  assert.equal(valor(hoja, 7, 2), "300");
  assert.equal(valor(hoja, 7, 1), 10);
  assert.equal(valor(hoja, 7, 23), "2");
  assert.equal(valor(hoja, 8, 17).formula, "SUM(Q7:Q7)");
});
