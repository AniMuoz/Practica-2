process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// server.js toma las funciones de datos al cargarse: se reemplazan antes por dobles que registran
// cada llamada y devuelven lo que cada prueba indique.
const fuente = require("../fuenteDatos");
let llamadas = [];
let respuestas = {};
for (const nombre of Object.keys(fuente)) {
  fuente[nombre] = (...args) => {
    llamadas.push({ nombre, args });
    const respuesta = respuestas[nombre];
    if (respuesta === undefined) throw new Error(`Sin respuesta preparada para ${nombre}`);
    return typeof respuesta === "function" ? respuesta(...args) : respuesta;
  };
}

const imagenes = require("../imagenesSupabase");
let remotas = new Map();
let erroresBajada = null;
const subidas = [];
imagenes.subirImagen = async (nombre, buffer, tipo) => {
  subidas.push({ nombre, contenido: buffer.toString(), tipo });
};
imagenes.bajarImagen = async (nombre) => {
  if (erroresBajada) throw erroresBajada;
  return remotas.get(nombre) ?? null;
};
imagenes.quitarImagen = async () => {};
imagenes.asegurarCubo = async () => {};

const { supabase } = require("../supabase");
let errorConexion = null;
supabase.from = () => ({ select: () => ({ limit: async () => ({ error: errorConexion }) }) });

const { app } = require("../server");

test.mock.method(console, "error", () => {});

let servidor;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    servidor = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
test.after(() => {
  servidor.closeAllConnections?.();
  servidor.close();
});
test.beforeEach(() => {
  llamadas = [];
  respuestas = {};
  remotas = new Map();
  erroresBajada = null;
  errorConexion = null;
  subidas.length = 0;
});

function responder(datos) {
  respuestas = datos;
}

function fallar(status, mensaje) {
  return () => {
    const error = new Error(mensaje);
    if (status) error.status = status;
    throw error;
  };
}

const llamadasA = (nombre) => llamadas.filter((llamada) => llamada.nombre === nombre);

async function pedir(metodo, ruta, { json, form } = {}) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : form,
  });
  const cuerpo = Buffer.from(await respuesta.arrayBuffer());
  let parseado = null;
  try {
    parseado = JSON.parse(cuerpo.toString());
  } catch {
    parseado = null;
  }
  return { status: respuesta.status, headers: respuesta.headers, json: parseado, cuerpo };
}

const FIRMA_XLSX = "PK\x03\x04" + "\0".repeat(20);

function formulario(campos = {}, archivos = {}) {
  const form = new FormData();
  for (const [nombre, valor] of Object.entries(campos)) form.append(nombre, valor);
  for (const [nombre, { contenido, archivo, tipo }] of Object.entries(archivos)) {
    // El servidor revisa los bytes iniciales: se antepone la firma real del formato.
    const firma = /\.xlsx$/i.test(archivo) ? FIRMA_XLSX : /\.pdf$/i.test(archivo) ? "%PDF-" : "";
    form.append(nombre, new Blob([firma, contenido], { type: tipo || "application/octet-stream" }), archivo);
  }
  return form;
}

const XLSX_TIPO = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ---------- lecturas en JSON ----------

const LECTURAS = [
  ["/api/tabla", "leerTabla", "No se pudo leer la tabla."],
  ["/api/tabla/ultimas-cargas", "leerUltimasCargas", "No se pudieron leer las últimas cargas."],
  ["/api/bodega", "stockEnBodega", "No se pudo leer el stock de bodega."],
  ["/api/regional", "stockRegional", "No se pudo leer el stock regional."],
  ["/api/inventario", "planillaInventario", "No se pudo leer la planilla de inventario."],
  ["/api/movimientos", "planillaMovimientos", "No se pudo leer la planilla de movimientos."],
  ["/api/stock-detallado", "stockDetallado", "No se pudo leer el stock detallado."],
  ["/api/contratistas", "leerContratistas", "No se pudieron leer los contratistas."],
];

test("GET /api/tabla no reenvía el cuerpo si el ETag coincide", async () => {
  responder({ leerTabla: { dato: 1 } });
  const primera = await pedir("GET", "/api/tabla");
  const etag = primera.headers.get("etag");
  assert.ok(etag);
  const segunda = await fetch(base + "/api/tabla", { headers: { "If-None-Match": etag } });
  assert.equal(segunda.status, 304);
  assert.equal(await segunda.text(), "");
});

for (const [ruta, funcion, mensajeGenerico] of LECTURAS) {
  test(`GET ${ruta} entrega lo que lee y no deja cachear`, async () => {
    responder({ [funcion]: { dato: 1 } });
    const respuesta = await pedir("GET", ruta);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.ok(respuesta.json);
  });

  test(`GET ${ruta} responde 500 si la lectura falla`, async () => {
    responder({ [funcion]: fallar(0, "boom") });
    const respuesta = await pedir("GET", ruta);
    assert.equal(respuesta.status, 500);
    assert.ok(respuesta.json.error);
    assert.ok(respuesta.json.error === mensajeGenerico || respuesta.json.error === "boom");
  });
}

test("GET /api/tabla/ultimas-cargas envuelve el resultado en { cargas }", async () => {
  responder({ leerUltimasCargas: { sap: "2026-10-01" } });
  assert.deepEqual((await pedir("GET", "/api/tabla/ultimas-cargas")).json, { cargas: { sap: "2026-10-01" } });
});

// ---------- descargas de Excel ----------

test("GET /api/tabla/excel traduce el query a filtros y nombra el archivo", async () => {
  responder({ exportarTabla: Buffer.from("excel-tabla") });
  const query = "colores=0&orden=codigo&bodega=01&subUbicacion=01-A&stockMinimo=2&precio=1&ubicacion=1&critico=1&stockCero=1&inventario=1&marcado=1&ignorarNulo=1&q=codo&nombre=" + encodeURIComponent('Inv:*2026?"');
  const respuesta = await pedir("GET", `/api/tabla/excel?${query}`);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("content-type"), XLSX_TIPO);
  assert.equal(respuesta.headers.get("content-disposition"), "attachment; filename=Inv2026.xlsx");
  assert.equal(respuesta.cuerpo.toString(), "excel-tabla");
  assert.deepEqual(llamadasA("exportarTabla")[0].args, [false, {
    orden: "codigo", bodega: "01", subUbicacion: "01-A", stockMinimo: "2", soloConPrecio: true, soloConUbicacion: true,
    soloStockCritico: true, soloStockCero: true, soloInventarioOComentario: true, soloMarcados: true, soloConRombo: false, ignorarNulo: true, texto: "codo",
  }]);
});

test("GET /api/tabla/excel sin filtros usa colores y el nombre con fecha", async () => {
  responder({ exportarTabla: Buffer.from("x") });
  const respuesta = await pedir("GET", "/api/tabla/excel");
  const [colores, filtros] = llamadasA("exportarTabla")[0].args;
  assert.equal(colores, true);
  assert.equal(filtros.soloMarcados, false);
  assert.equal(filtros.orden, undefined);
  assert.match(respuesta.headers.get("content-disposition"), /^attachment; filename=INVENTARIO%20\d{2}-\d{2}-\d{4}\.xlsx$/);
});

test("GET /api/tabla/excel responde 500 si falla la generación", async () => {
  responder({ exportarTabla: fallar(0, "x") });
  const respuesta = await pedir("GET", "/api/tabla/excel");
  assert.equal(respuesta.status, 500);
  assert.equal(respuesta.json.error, "No se pudo generar la planilla.");
});

const DESCARGAS = [
  ["/api/bodega/excel", "exportarStockBodega", /^attachment; filename=PLANILLA%20M501%20/],
  ["/api/regional/excel", "exportarStockRegional", /^attachment; filename=PLANILLA%20STOCK%20REGIONAL%20/],
  ["/api/inventario/excel", "exportarPlanillaInventario", /^attachment; filename=PLANILLA%20DE%20INVENTARIO%20M501%20/],
  ["/api/movimientos/excel", "exportarMovimientos", /^attachment; filename=PLANILLA%20DE%20MOVIMIENTOS%20/],
  ["/api/stock-detallado/excel", "exportarStockDetallado", /^attachment; filename=Prueba_de_stock_detallado%20/],
];

for (const [ruta, funcion, nombre] of DESCARGAS) {
  test(`GET ${ruta} entrega el Excel y respeta colores=0`, async () => {
    responder({ [funcion]: Buffer.from("datos") });
    const con = await pedir("GET", ruta);
    assert.equal(con.status, 200);
    assert.equal(con.headers.get("content-type"), XLSX_TIPO);
    assert.match(con.headers.get("content-disposition"), nombre);
    assert.equal(con.cuerpo.toString(), "datos");
    await pedir("GET", `${ruta}?colores=0`);
    assert.equal(llamadasA(funcion)[0].args[0], true);
    assert.equal(llamadasA(funcion)[1].args[0], false);
  });

  test(`GET ${ruta} responde 500 si falla`, async () => {
    responder({ [funcion]: fallar(0, "x") });
    assert.equal((await pedir("GET", ruta)).status, 500);
  });
}

test("el Excel de inventario pasa el origen de la columna Existencia", async () => {
  responder({ exportarPlanillaInventario: Buffer.from("x"), exportarMovimientos: Buffer.from("y") });
  await pedir("GET", "/api/inventario/excel?inventario=1");
  await pedir("GET", "/api/inventario/excel?existencia=1");
  await pedir("GET", "/api/inventario/excel");
  assert.deepEqual(llamadasA("exportarPlanillaInventario").map((llamada) => llamada.args[1]), ["inventario", "libre", ""]);
  await pedir("GET", "/api/movimientos/excel?inventario=1&colores=0");
  assert.deepEqual(llamadasA("exportarMovimientos")[0].args, [false, "inventario", null]);
});

test("las planillas de admin pasan los filtros solo si filtrar=1", async () => {
  responder({ exportarStockBodega: Buffer.from("x") });
  await pedir("GET", "/api/bodega/excel?filtrar=1&bodega=M5&critico=1&orden=codigo");
  const filtros = llamadasA("exportarStockBodega")[0].args[1];
  assert.equal(filtros.bodega, "M5");
  assert.equal(filtros.soloStockCritico, true);
  assert.equal(filtros.soloStockCero, false);
  assert.equal(filtros.orden, "codigo");
});

// ---------- reservas ----------

test("GET /api/reservas pasa reserva, página y tamaño", async () => {
  responder({ buscarReservas: { filas: [] } });
  await pedir("GET", "/api/reservas?reserva=9001&pagina=1&tamano=5");
  assert.deepEqual(llamadasA("buscarReservas")[0].args, ["9001", "1", "5"]);
  responder({ buscarReservas: fallar(0, "x") });
  const falla = await pedir("GET", "/api/reservas");
  assert.equal(falla.status, 500);
  assert.equal(falla.json.error, "No se pudieron leer las reservas.");
});

test("GET /api/reservas/excel usa el estado del error y respeta colores", async () => {
  responder({ exportarRevisionPorReserva: Buffer.from("r") });
  const bien = await pedir("GET", "/api/reservas/excel?reserva=9001&colores=0");
  assert.equal(bien.status, 200);
  assert.equal(bien.headers.get("content-disposition"), "attachment; filename=Revision%20stock%20en%20reserva.xlsx");
  assert.deepEqual(llamadasA("exportarRevisionPorReserva")[0].args, ["9001", false]);
  responder({ exportarRevisionPorReserva: fallar(404, "No hay reservas con ese número de reserva.") });
  const falla = await pedir("GET", "/api/reservas/excel?reserva=1");
  assert.equal(falla.status, 404);
});

test("POST /api/reserva y /api/reserva/excel exigen un PDF", async () => {
  for (const ruta of ["/api/reserva", "/api/reserva/excel"]) {
    const sinArchivo = await pedir("POST", ruta, { form: formulario() });
    assert.equal(sinArchivo.status, 400);
    assert.equal(sinArchivo.json.error, "Falta el PDF de la reserva.");
    const otroFormato = await pedir("POST", ruta, { form: formulario({}, { archivo: { contenido: "x", archivo: "reserva.txt" } }) });
    assert.equal(otroFormato.status, 400);
    assert.equal(otroFormato.json.error, "Solo se aceptan archivos PDF.");
  }
  assert.equal(llamadas.length, 0);
});

test("POST /api/reserva lee el PDF y POST /api/reserva/excel devuelve la planilla", async () => {
  responder({ revisarReserva: { columnas: ["a"], filas: [] }, exportarRevisionReserva: Buffer.from("xl") });
  const pdf = { archivo: { contenido: "pdf-falso", archivo: "Reserva.PDF" } };
  const lectura = await pedir("POST", "/api/reserva", { form: formulario({}, pdf) });
  assert.deepEqual(lectura.json, { columnas: ["a"], filas: [] });
  assert.equal(llamadasA("revisarReserva")[0].args[0].toString().replace(/^%PDF-/, ""), "pdf-falso");
  const excel = await pedir("POST", "/api/reserva/excel", { form: formulario({ colores: "0" }, pdf) });
  assert.equal(excel.status, 200);
  assert.equal(excel.headers.get("content-type"), XLSX_TIPO);
  assert.equal(llamadasA("exportarRevisionReserva")[0].args[1], false);
});

test("los errores al procesar la reserva responden 500 con un mensaje claro", async () => {
  responder({ revisarReserva: fallar(0, "pdf roto"), exportarRevisionReserva: fallar(0, "pdf roto") });
  const pdf = { archivo: { contenido: "x", archivo: "r.pdf" } };
  const lectura = await pedir("POST", "/api/reserva", { form: formulario({}, pdf) });
  assert.deepEqual([lectura.status, lectura.json.error], [500, "No se pudo leer la reserva."]);
  const excel = await pedir("POST", "/api/reserva/excel", { form: formulario({}, pdf) });
  assert.deepEqual([excel.status, excel.json.error], [500, "No se pudo generar la revisión de reserva."]);
});

// ---------- ventas ----------

const ventasBd = require("../ventasBd");
let respuestasVentas = {};
let llamadasVentas = [];
for (const nombre of ["anadirVenta", "obtenerPlanilla", "listarMeses", "exportarPlanilla", "editarFila", "quitarFila", "quitarOrden", "exportarAnual"]) {
  ventasBd[nombre] = async (...args) => {
    llamadasVentas.push({ nombre, args });
    const r = respuestasVentas[nombre];
    if (r === undefined) throw new Error(`Sin respuesta preparada para ${nombre}`);
    return typeof r === "function" ? r(...args) : r;
  };
}
test.beforeEach(() => {
  respuestasVentas = {};
  llamadasVentas = [];
});

test("POST /api/ventas en modo manual guarda la venta con los productos y los datos del formulario", async () => {
  respuestasVentas = { anadirVenta: { anio: 2026, mes: 10, agregadas: 1 } };
  const items = [{ codigo: "100", cantidad: 3 }];
  const respuesta = await pedir("POST", "/api/ventas", {
    form: formulario({ modo: "manual", items: JSON.stringify(items), contratista: "2", movimiento: "2", almacen: "M503", codVenta: "55" }),
  });
  assert.equal(respuesta.status, 201);
  assert.deepEqual(respuesta.json, { anio: 2026, mes: 10, agregadas: 1 });
  const args = { ...llamadasVentas[0].args[0] };
  delete args.usuario;
  assert.deepEqual(args, { ordenBuffer: undefined, hoja: "", contratistaIdx: 2, movTipo: 2, almacen: "M503", codVenta: "55", itemsManuales: items });
});

test("POST /api/ventas valida la lista manual y exige archivo en modo orden", async () => {
  const mala = await pedir("POST", "/api/ventas", { form: formulario({ modo: "manual", items: "{no es json" }) });
  assert.equal(mala.status, 400);
  assert.equal(mala.json.error, "La lista de productos no es válida.");
  const sinArchivo = await pedir("POST", "/api/ventas", { form: formulario({ modo: "orden" }) });
  assert.equal(sinArchivo.status, 400);
  assert.equal(sinArchivo.json.error, "Falta el archivo.");
  const otroFormato = await pedir("POST", "/api/ventas", { form: formulario({}, { orden: { contenido: "x", archivo: "orden.csv" } }) });
  assert.equal(otroFormato.status, 400);
  assert.equal(llamadasVentas.length, 0);
});

test("POST /api/ventas en modo orden entrega el archivo y traduce errores", async () => {
  respuestasVentas = { anadirVenta: { anio: 2026, mes: 10, agregadas: 2 } };
  await pedir("POST", "/api/ventas", {
    form: formulario({ contratista: "1", movimiento: "1" }, { orden: { contenido: "ORDEN", archivo: "orden.xlsx" } }),
  });
  const { ordenBuffer, itemsManuales } = llamadasVentas[0].args[0];
  assert.equal(ordenBuffer.toString().slice(FIRMA_XLSX.length), "ORDEN");
  assert.equal(itemsManuales, null);

  const orden = { orden: { contenido: "x", archivo: "orden.xlsx" } };
  respuestasVentas = { anadirVenta: fallar(400, "No se encontraron productos para cargar.") };
  const conEstado = await pedir("POST", "/api/ventas", { form: formulario({}, orden) });
  assert.deepEqual([conEstado.status, conEstado.json.error], [400, "No se encontraron productos para cargar."]);
  respuestasVentas = { anadirVenta: fallar(0, "detalle interno") };
  const sinEstado = await pedir("POST", "/api/ventas", { form: formulario({}, orden) });
  assert.deepEqual([sinEstado.status, sinEstado.json.error], [500, "No se pudo guardar la venta."]);
});

test("GET /api/ventas/planilla y /meses leen la planilla del mes pedido", async () => {
  respuestasVentas = { obtenerPlanilla: { existe: false, filas: [] }, listarMeses: [{ id: 1, anio: 2026, mes: 10 }] };
  const planilla = await pedir("GET", "/api/ventas/planilla?anio=2026&mes=9");
  assert.equal(planilla.status, 200);
  assert.deepEqual(llamadasVentas[0].args, ["2026", "9"]);
  const meses = await pedir("GET", "/api/ventas/meses");
  assert.deepEqual(meses.json, { meses: [{ id: 1, anio: 2026, mes: 10 }] });
});

test("GET /api/ventas/descargar entrega el Excel con el nombre VENTAS dd-mm-aaaa", async () => {
  respuestasVentas = { exportarPlanilla: { buffer: Buffer.from("xlsx"), nombre: "VENTAS 05-10-2026.xlsx" } };
  const r = await pedir("GET", "/api/ventas/descargar?anio=2026&mes=10&colores=0");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-disposition"), "attachment; filename=VENTAS%2005-10-2026.xlsx");
  assert.equal(r.cuerpo.toString(), "xlsx");
  assert.equal(llamadasVentas[0].args[3], false);
  respuestasVentas = { exportarPlanilla: fallar(404, "No hay planilla de ventas para ese mes.") };
  const falta = await pedir("GET", "/api/ventas/descargar?anio=2020&mes=1");
  assert.deepEqual([falta.status, falta.json.error], [404, "No hay planilla de ventas para ese mes."]);
});

test("GET /api/ventas/descargar-anual entrega el Excel anual", async () => {
  respuestasVentas = { exportarAnual: { buffer: Buffer.from("anual"), nombre: "VENTAS ANUAL 2026 05-10-2026.xlsx" } };
  const r = await pedir("GET", "/api/ventas/descargar-anual?anio=2026");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-disposition"), "attachment; filename=VENTAS%20ANUAL%202026%2005-10-2026.xlsx");
  assert.equal(llamadasVentas[0].args[0], "2026");
});

test("PATCH y DELETE /api/ventas/filas/:id editan y quitan filas", async () => {
  respuestasVentas = { editarFila: { fila: { id: 5, estado: "ok" } }, quitarFila: { id: 5, eliminada: true } };
  const editada = await pedir("PATCH", "/api/ventas/filas/5", { json: { estado: "ok" } });
  assert.deepEqual([editada.status, editada.json.fila.estado], [200, "ok"]);
  assert.deepEqual(llamadasVentas[0].args.slice(0, 2), ["5", { estado: "ok" }]);
  const quitada = await pedir("DELETE", "/api/ventas/filas/5");
  assert.deepEqual(quitada.json, { id: 5, eliminada: true });
});

// ---------- contratistas ----------

test("PUT /api/contratistas guarda con la clave y devuelve el estado del error", async () => {
  responder({ guardarContratistas: { filas: [] } });
  await pedir("PUT", "/api/contratistas", { json: { clave: "k", filas: [{ id: 1, nombre: "Ana" }] } });
  assert.deepEqual(llamadasA("guardarContratistas")[0].args, ["k", [{ id: 1, nombre: "Ana" }]]);
  responder({ guardarContratistas: fallar(403, "Contraseña incorrecta.") });
  const respuesta = await pedir("PUT", "/api/contratistas", { json: { clave: "x", filas: [] } });
  assert.deepEqual([respuesta.status, respuesta.json.error], [403, "Contraseña incorrecta."]);
});

// ---------- importación de planillas ----------

const MODOS = [
  ["completa", "importarPlanilla"],
  ["sap", "importarSap"],
  ["precios", "importarPrecios"],
  ["ubicaciones", "importarUbicaciones"],
  ["dos-columnas", "importarDosColumnas"],
  ["reservas", "importarReservas"],
  ["movimientos", "importarMovimientos"],
];

for (const [modo, funcion] of MODOS) {
  test(`POST /api/tabla/excel en modo ${modo} usa ${funcion} y registra la carga`, async () => {
    responder({ [funcion]: { agregados: 1 }, registrarCarga: {} });
    const respuesta = await pedir("POST", "/api/tabla/excel", {
      form: formulario({ modo, clave: "k", columna: "Precio" }, { archivo: { contenido: "datos", archivo: "a.XLSX" } }),
    });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.json, { agregados: 1 });
    const { args } = llamadasA(funcion)[0];
    assert.equal(args[0], "k");
    assert.equal(args[1].toString().slice(FIRMA_XLSX.length), "datos");
    if (modo === "dos-columnas") assert.equal(args[2], "Precio");
    assert.deepEqual(llamadasA("registrarCarga")[0].args, [modo, "Precio"]);
    assert.equal(llamadas.filter((llamada) => llamada.nombre.startsWith("importar")).length, 1);
  });
}

test("POST /api/tabla/excel sin modo usa la importación completa", async () => {
  responder({ importarPlanilla: { agregados: 0 }, registrarCarga: {} });
  await pedir("POST", "/api/tabla/excel", { form: formulario({ clave: "k" }, { archivo: { contenido: "d", archivo: "a.xlsx" } }) });
  assert.equal(llamadasA("importarPlanilla").length, 1);
  assert.equal(llamadasA("registrarCarga")[0].args[0], "completa");
});

test("POST /api/tabla/excel rechaza peticiones inválidas antes de importar", async () => {
  const sinArchivo = await pedir("POST", "/api/tabla/excel", { form: formulario({ modo: "completa" }) });
  assert.deepEqual([sinArchivo.status, sinArchivo.json.error], [400, "Falta el archivo .xlsx."]);
  const otroFormato = await pedir("POST", "/api/tabla/excel", { form: formulario({}, { archivo: { contenido: "x", archivo: "a.csv" } }) });
  assert.deepEqual([otroFormato.status, otroFormato.json.error], [400, "Solo se aceptan archivos .xlsx."]);
  const modoRaro = await pedir("POST", "/api/tabla/excel", { form: formulario({ modo: "inventada" }, { archivo: { contenido: "x", archivo: "a.xlsx" } }) });
  assert.deepEqual([modoRaro.status, modoRaro.json.error], [400, "Ese formato de planilla todavía no está definido."]);
  assert.equal(llamadas.length, 0);
});

test("POST /api/tabla/excel devuelve el error de la importación y no registra la carga", async () => {
  const archivo = { archivo: { contenido: "x", archivo: "a.xlsx" } };
  responder({ importarSap: fallar(403, "Contraseña incorrecta.") });
  const prohibido = await pedir("POST", "/api/tabla/excel", { form: formulario({ modo: "sap", clave: "mala" }, archivo) });
  assert.deepEqual([prohibido.status, prohibido.json.error], [403, "Contraseña incorrecta."]);
  responder({ importarSap: fallar(0, "falló algo") });
  const interno = await pedir("POST", "/api/tabla/excel", { form: formulario({ modo: "sap" }, archivo) });
  assert.deepEqual([interno.status, interno.json.error], [500, "falló algo"]);
  assert.equal(llamadasA("registrarCarga").length, 0);
});

// ---------- materiales ----------

test("GET /api/material/:codigo responde 404 si no existe", async () => {
  responder({ buscarMaterial: { columnas: [], fila: null, bodegas: [] } });
  const respuesta = await pedir("GET", "/api/material/999");
  assert.deepEqual([respuesta.status, respuesta.json.error], [404, "Material no encontrado."]);
  responder({ buscarMaterial: { columnas: ["Codigo"], fila: { Codigo: "1" }, bodegas: [{ bodega: "M502", stock: "1" }] } });
  assert.deepEqual((await pedir("GET", "/api/material/1")).json, { columnas: ["Codigo"], fila: { Codigo: "1" }, bodegas: [{ bodega: "M502", stock: "1" }] });
  responder({ buscarMaterial: fallar(0, "x") });
  assert.equal((await pedir("GET", "/api/material/1")).status, 500);
});

test("GET /api/buscar entrega el texto buscado a la búsqueda", async () => {
  responder({ buscarMateriales: [{ codigo: "1", descripcion: "A" }] });
  const respuesta = await pedir("GET", "/api/buscar?q=perno");
  assert.deepEqual(respuesta.json, { resultados: [{ codigo: "1", descripcion: "A" }] });
  assert.equal(llamadasA("buscarMateriales")[0].args[0], "perno");
});

test("POST /api/acceso valida la clave", async () => {
  responder({ claveCorrecta: (clave) => clave === "buena" });
  assert.deepEqual((await pedir("POST", "/api/acceso", { json: { clave: "buena" } })).json, { ok: true });
  assert.equal((await pedir("POST", "/api/acceso", { json: { clave: "mala" } })).status, 403);
  assert.equal((await pedir("POST", "/api/acceso", { json: {} })).status, 403);
});

test("PUT /api/material/:codigo guarda inventario y comentario o responde 404", async () => {
  responder({ actualizarMaterial: { fila: { Codigo: "1" } } });
  const bien = await pedir("PUT", "/api/material/1", { json: { inventario: "4", comentario: "ok" } });
  assert.equal(bien.status, 200);
  assert.deepEqual(llamadasA("actualizarMaterial")[0].args, ["1", { inventario: "4", comentario: "ok" }]);
  responder({ actualizarMaterial: null });
  assert.equal((await pedir("PUT", "/api/material/9", { json: {} })).status, 404);
  responder({ actualizarMaterial: fallar(400, "Inventario debe ser un número entero.") });
  const malo = await pedir("PUT", "/api/material/1", { json: { inventario: "x" } });
  assert.deepEqual([malo.status, malo.json.error], [400, "Inventario debe ser un número entero."]);
});

test("PUT /api/material/:codigo/marcado solo marca con true booleano", async () => {
  responder({ marcarMaterial: { fila: { Codigo: "1" } } });
  await pedir("PUT", "/api/material/1/marcado", { json: { marcado: true } });
  await pedir("PUT", "/api/material/1/marcado", { json: { marcado: "true" } });
  await pedir("PUT", "/api/material/1/marcado", { json: {} });
  assert.deepEqual(llamadasA("marcarMaterial").map((llamada) => llamada.args), [["1", true], ["1", false], ["1", false]]);
  responder({ marcarMaterial: null });
  assert.equal((await pedir("PUT", "/api/material/9/marcado", { json: { marcado: true } })).status, 404);
});

test("PUT /api/material/:codigo/datos pasa la clave, los datos y reemplazar solo si es true", async () => {
  responder({ actualizarDatos: { fila: { Codigo: "2" } } });
  await pedir("PUT", "/api/material/1/datos", { json: { clave: "k", datos: { Codigo: "2" }, reemplazar: true } });
  await pedir("PUT", "/api/material/1/datos", { json: { clave: "k", datos: { Codigo: "2" }, reemplazar: "si" } });
  assert.deepEqual(llamadasA("actualizarDatos")[0].args, ["1", "k", { Codigo: "2" }, true]);
  assert.equal(llamadasA("actualizarDatos")[1].args[3], false);
  responder({ actualizarDatos: fallar(409, "Ya existe un material con ese código.") });
  assert.equal((await pedir("PUT", "/api/material/1/datos", { json: { clave: "k", datos: {} } })).status, 409);
  responder({ actualizarDatos: null });
  assert.equal((await pedir("PUT", "/api/material/1/datos", { json: { clave: "k", datos: {} } })).status, 404);
});

test("POST /api/material responde 201 y traduce los errores", async () => {
  responder({ agregarMaterial: { fila: { Codigo: "5" } } });
  const creado = await pedir("POST", "/api/material", { json: { clave: "k", datos: { Codigo: "5" } } });
  assert.equal(creado.status, 201);
  assert.deepEqual(llamadasA("agregarMaterial")[0].args, ["k", { Codigo: "5" }]);
  responder({ agregarMaterial: fallar(400, "El código no puede quedar vacío.") });
  assert.equal((await pedir("POST", "/api/material", { json: { clave: "k", datos: {} } })).status, 400);
});

test("DELETE /api/material/:codigo elimina, responde 404 o devuelve el error", async () => {
  responder({ eliminarMaterial: { codigo: "1" } });
  const bien = await pedir("DELETE", "/api/material/1", { json: { clave: "k" } });
  assert.deepEqual(bien.json, { codigo: "1" });
  assert.deepEqual(llamadasA("eliminarMaterial")[0].args, ["1", "k"]);
  responder({ eliminarMaterial: null });
  assert.equal((await pedir("DELETE", "/api/material/9", { json: { clave: "k" } })).status, 404);
  responder({ eliminarMaterial: fallar(403, "Contraseña incorrecta.") });
  assert.equal((await pedir("DELETE", "/api/material/1", { json: { clave: "x" } })).status, 403);
});

test("POST /api/tabla/limpiar-inventario entrega la tabla o el error", async () => {
  responder({ limpiarInventarioComentarios: { columnas: [], filas: [] } });
  assert.equal((await pedir("POST", "/api/tabla/limpiar-inventario", { json: { clave: "k" } })).status, 200);
  assert.equal(llamadasA("limpiarInventarioComentarios")[0].args[0], "k");
  responder({ limpiarInventarioComentarios: fallar(403, "Contraseña incorrecta.") });
  assert.equal((await pedir("POST", "/api/tabla/limpiar-inventario", { json: { clave: "x" } })).status, 403);
});

test("DELETE /api/material/:codigo/imagen quita la imagen del campo indicado", async () => {
  responder({ guardarImagen: { fila: { Codigo: "1" } } });
  await pedir("DELETE", "/api/material/1/imagen", { json: { clave: "k", campo: "QR" } });
  assert.deepEqual(llamadasA("guardarImagen")[0].args, ["1", "QR", "", "k"]);
  responder({ guardarImagen: null });
  assert.equal((await pedir("DELETE", "/api/material/9/imagen", { json: { campo: "QR" } })).status, 404);
  responder({ guardarImagen: fallar(400, "La imagen debe ser Rombo, QR o Foto.") });
  assert.equal((await pedir("DELETE", "/api/material/1/imagen", { json: { campo: "X" } })).status, 400);
});

test("POST /api/material/:codigo/imagen valida el archivo, lo sube y lo asocia al material", async () => {
  const sinArchivo = await pedir("POST", "/api/material/1/imagen", { form: formulario({ campo: "QR" }) });
  assert.deepEqual([sinArchivo.status, sinArchivo.json.error], [400, "Falta la imagen."]);
  const noImagen = await pedir("POST", "/api/material/1/imagen", { form: formulario({ campo: "QR" }, { archivo: { contenido: "x", archivo: "a.txt", tipo: "text/plain" } }) });
  assert.deepEqual([noImagen.status, noImagen.json.error], [400, "Solo se aceptan imágenes PNG, JPG, WEBP o GIF."]);

  const nombre = `zz${process.pid}-foto.png`;
  const local = path.join(__dirname, "..", "imagenes", nombre);
  try {
    responder({ guardarImagen: { fila: { Codigo: `zz${process.pid}` } } });
    const bien = await pedir("POST", `/api/material/zz${process.pid}/imagen`, {
      form: formulario({ campo: "Foto", clave: "k" }, { archivo: { contenido: "GIF89a-DATOS", archivo: "Cualquiera.PNG", tipo: "image/png" } }),
    });
    assert.equal(bien.status, 200);
    assert.deepEqual(subidas, [{ nombre, contenido: "GIF89a-DATOS", tipo: "image/png" }]);

    const falsa = await pedir("POST", `/api/material/zz${process.pid}/imagen`, {
      form: formulario({ campo: "Foto", clave: "k" }, { archivo: { contenido: "no soy una imagen", archivo: "x.png", tipo: "image/png" } }),
    });
    assert.deepEqual([falsa.status, falsa.json.error], [400, "El archivo no es una imagen válida."]);
    assert.equal(subidas.length, 1);
    assert.deepEqual(llamadasA("guardarImagen")[0].args, [`zz${process.pid}`, "Foto", nombre, "k"]);
    assert.equal(fs.existsSync(local), false);
  } finally {
    fs.rmSync(local, { force: true });
  }
});

test("el nombre de la imagen subida limpia caracteres peligrosos del código y usa rombo por defecto", async () => {
  const esperado = "a_b-rombo.jpg";
  const local = path.join(__dirname, "..", "imagenes", esperado);
  try {
    responder({ guardarImagen: null });
    const respuesta = await pedir("POST", "/api/material/a%2Fb/imagen", {
      form: formulario({ campo: "Otro" }, { archivo: { contenido: "GIF89a-xxxxxx", archivo: "foto.JPG", tipo: "image/jpeg" } }),
    });
    assert.equal(respuesta.status, 404);
    assert.equal(subidas[0].nombre, esperado);
  } finally {
    fs.rmSync(local, { force: true });
  }
});

// ---------- imágenes, conexión y eventos ----------

test("GET /api/imagenes/:nombre sirve la imagen de Supabase con su tipo", async () => {
  remotas.set("logo.png", Buffer.from("PNGDATA"));
  const respuesta = await pedir("GET", "/api/imagenes/logo.png");
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get("content-type"), "image/png");
  assert.equal(respuesta.cuerpo.toString(), "PNGDATA");
});

test("GET /api/imagenes/:nombre usa el archivo local si Supabase no lo tiene, y 404 si no existe en ningún lado", async () => {
  const nombre = `zz-local-${process.pid}.png`;
  const local = path.join(__dirname, "..", "imagenes", nombre);
  try {
    fs.writeFileSync(local, "LOCAL");
    const respuesta = await pedir("GET", `/api/imagenes/${nombre}`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cuerpo.toString(), "LOCAL");
  } finally {
    fs.rmSync(local, { force: true });
  }
  assert.equal((await pedir("GET", "/api/imagenes/no-existe.png")).status, 404);
});

test("GET /api/imagenes/:nombre no sale de la carpeta de imágenes", async () => {
  assert.equal((await pedir("GET", "/api/imagenes/..%2F..%2Fpackage.json")).status, 404);
  assert.equal((await pedir("GET", "/api/imagenes/..")).status, 404);
});

test("GET /api/imagenes/:nombre informa un fallo de Supabase", async () => {
  erroresBajada = Object.assign(new Error("storage caído"), { status: 502 });
  const respuesta = await pedir("GET", "/api/imagenes/logo.png");
  assert.deepEqual([respuesta.status, respuesta.json.error], [502, "storage caído"]);
});

test("GET /api/supabase informa si hay conexión", async () => {
  assert.deepEqual((await pedir("GET", "/api/supabase")).json, { conectado: true });
  errorConexion = { code: "PGRST205", message: "falta tabla" };
  assert.equal((await pedir("GET", "/api/supabase")).status, 200);
  errorConexion = { code: "XX", message: "sin red" };
  const caida = await pedir("GET", "/api/supabase");
  assert.deepEqual([caida.status, caida.json], [502, { conectado: false, error: "No se pudo consultar la base de datos." }]);
});

test("/api/eventos avisa a los clientes conectados cuando cambia un material", async () => {
  const control = new AbortController();
  const respuesta = await fetch(`${base}/api/eventos`, { signal: control.signal });
  assert.equal(respuesta.headers.get("content-type"), "text/event-stream");
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let texto = "";
  const leerHasta = async (patron) => {
    while (!patron.test(texto)) {
      const { value, done } = await lector.read();
      if (done) break;
      texto += decodificador.decode(value);
    }
  };
  try {
    await leerHasta(/: conectado/);
    responder({ eliminarMaterial: { codigo: "1" }, marcarMaterial: { fila: { Codigo: "1", Marcado: "1" } } });
    await pedir("DELETE", "/api/material/1", { json: { clave: "k" } });
    await leerHasta(/"tipo":"recarga"/);
    await pedir("PUT", "/api/material/1/marcado", { json: { marcado: true } });
    await leerHasta(/"tipo":"fila"/);
    assert.match(texto, /data: \{"tipo":"recarga"\}/);
    assert.match(texto, /data: \{"tipo":"fila","fila":\{"Codigo":"1","Marcado":"1"\}\}/);
  } finally {
    control.abort();
  }
});
