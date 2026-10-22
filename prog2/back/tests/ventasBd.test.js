process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

const tablasRemotas = require("../supabaseTablas");
tablasRemotas.ejecutar = (operacion, carga) => {
  if (operacion === "leer" && carga.tabla === "contratistas") return [{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Luis" }];
  if (operacion === "leer") return [];
  return null;
};

const MATERIALES = [
  { Codigo: "100", Descripcion: "Perno", Stock: "10", M502: "1", M503: "0", M504: "0", M505: "0", "Ubicación": "0102-A", Peso: "0,5", Precio: "100" },
  { Codigo: "200", Descripcion: "Cañería PVC", Stock: "0", M502: "0", M503: "0", M504: "0", M505: "50", "Ubicación": "          ", Peso: "2", Precio: "" },
];
const nucleo = require("../nucleoDatos");
nucleo.cargarMateriales = () => ({ filasBodega: MATERIALES });

// ---------- Supabase falso: tablas en memoria ----------
const { supabase } = require("../supabase");
let tablas;
let ids;

function reiniciar() {
  tablas = { ventas_planillas: [], ventas_filas: [], ventas_log: [] };
  ids = { ventas_planillas: 1, ventas_filas: 1, ventas_log: 1 };
}

supabase.from = (tabla) => {
  const e = { op: "select", filtros: [], orden: [], limite: null, rango: null, valores: null, unico: null, devolver: false };
  const b = {
    select() { if (e.op === "insert") e.devolver = true; return b; },
    insert(v) { e.op = "insert"; e.valores = v; return b; },
    update(v) { e.op = "update"; e.valores = v; return b; },
    delete() { e.op = "delete"; return b; },
    eq(campo, valor) { e.filtros.push((f) => f[campo] === valor); return b; },
    order(campo, { ascending = true } = {}) { e.orden.push({ campo, ascending }); return b; },
    limit(n) { e.limite = n; return b; },
    range(d, h) { e.rango = [d, h]; return b; },
    maybeSingle() { e.unico = "maybe"; return b; },
    single() { e.unico = "single"; return b; },
    then(ok, no) { return Promise.resolve(ejecutar()).then(ok, no); },
  };
  function ejecutar() {
    const filas = tablas[tabla];
    const coincide = (f) => e.filtros.every((x) => x(f));
    if (e.op === "insert") {
      const nuevas = [].concat(e.valores).map((v) => {
        const fila = { ...v, id: ids[tabla]++, creado_en: new Date().toISOString() };
        if (tabla === "ventas_planillas" && filas.some((f) => f.anio === fila.anio && f.mes === fila.mes)) throw new Error("duplicada");
        return fila;
      });
      filas.push(...nuevas);
      return { data: e.devolver ? (e.unico ? nuevas[0] : nuevas) : null, error: null };
    }
    if (e.op === "update") {
      filas.filter(coincide).forEach((f) => Object.assign(f, e.valores));
      return { data: null, error: null };
    }
    if (e.op === "delete") {
      tablas[tabla] = filas.filter((f) => !coincide(f));
      return { data: null, error: null };
    }
    let r = filas.filter(coincide);
    for (const { campo, ascending } of [...e.orden].reverse()) {
      r = [...r].sort((a, c) => (a[campo] < c[campo] ? -1 : a[campo] > c[campo] ? 1 : 0) * (ascending ? 1 : -1));
    }
    if (e.rango) r = r.slice(e.rango[0], e.rango[1] + 1);
    if (e.limite != null) r = r.slice(0, e.limite);
    if (e.unico) return { data: r[0] ? { ...r[0] } : null, error: null };
    return { data: r.map((f) => ({ ...f })), count: r.length, error: null };
  }
  return b;
};

const ventasBd = require("../ventasBd");

test.beforeEach(reiniciar);

const ITEMS = [{ codigo: "100", cantidad: 4 }, { codigo: "200", cantidad: 12 }, { codigo: "999", cantidad: 1 }];

test("anadirVenta crea la planilla del mes y guarda las filas ordenadas por descripción", async () => {
  const hoy = ventasBd.mesActual();
  const r = await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, codVenta: "55", itemsManuales: ITEMS, usuario: "ana" });
  assert.deepEqual([r.anio, r.mes, r.agregadas], [hoy.anio, hoy.mes, 3]);
  assert.equal(tablas.ventas_planillas.length, 1);
  const filas = tablas.ventas_filas;
  assert.deepEqual(filas.map((f) => f.codigo), ["999", "200", "100"]);
  assert.deepEqual(filas.map((f) => f.pos), [10, 20, 30]);
  const perno = filas.find((f) => f.codigo === "100");
  assert.equal(perno.entregar, 4);
  assert.equal(perno.dif, 6);
  assert.equal(perno.precio_total, 400);
  assert.equal(perno.contratista, "Ana");
  assert.equal(perno.n_venta, "55");
  assert.equal(perno.movimiento, "VENTA");
  const caneria = filas.find((f) => f.codigo === "200");
  assert.equal(caneria.ubicacion, "CONCON");
  assert.equal(caneria.rojo, true);
  assert.equal(caneria.tiras, 2);
  assert.equal(caneria.entregar, 0);
  assert.deepEqual(tablas.ventas_log.map((l) => [l.accion, l.usuario]), [["crear_planilla", "ana"], ["anadir_venta", "ana"]]);
});

test("una segunda carga del mismo mes reutiliza la planilla y reinicia la numeración de Pos", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS });
  await ventasBd.anadirVenta({ contratistaIdx: 2, movTipo: 2, almacen: "M503", itemsManuales: [{ codigo: "100", cantidad: 1 }] });
  assert.equal(tablas.ventas_planillas.length, 1);
  const ultima = tablas.ventas_filas[3];
  assert.deepEqual([ultima.pos, ultima.movimiento, ultima.almacen, ultima.contratista, ultima.n_venta], [10, "TRASPASO", "M503", "Luis", "n/a"]);
  assert.equal(tablas.ventas_log.filter((l) => l.accion === "crear_planilla").length, 1);
});

test("obtenerPlanilla distingue meses: un mes sin planilla vuelve vacío y no se crea", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS });
  const { anio, mes } = ventasBd.mesActual();
  const actual = await ventasBd.obtenerPlanilla(anio, mes);
  assert.equal(actual.existe, true);
  assert.equal(actual.filas.length, 3);
  assert.equal(actual.filas[0].comp, "FALSO");
  const otra = await ventasBd.obtenerPlanilla(2020, 1);
  assert.deepEqual([otra.existe, otra.filas.length], [false, 0]);
  assert.equal(tablas.ventas_planillas.length, 1);
  await assert.rejects(ventasBd.obtenerPlanilla(2020, 13), { status: 400 });
  assert.equal((await ventasBd.listarMeses()).length, 1);
});

test("anadirVenta rechaza peticiones sin productos", async () => {
  await assert.rejects(ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1 }), { status: 400, message: /Falta el archivo/ });
  await assert.rejects(ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [] }), { status: 400, message: /No se encontraron productos/ });
  assert.equal(tablas.ventas_planillas.length, 0);
});

test("editarFila guarda solo campos permitidos y registra cada cambio", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [{ codigo: "100", cantidad: 4 }] });
  const fila = tablas.ventas_filas[0];
  const r = await ventasBd.editarFila(fila.id, { estado: "Entregado", entregar: "3,5", codigo: "X" }, "luis");
  assert.equal(r.fila.estado, "Entregado");
  assert.equal(tablas.ventas_filas[0].entregar, 3.5);
  assert.equal(tablas.ventas_filas[0].codigo, "100");
  const cambios = tablas.ventas_log.filter((l) => l.accion === "editar_celda");
  assert.deepEqual(cambios.map((c) => [c.campo, c.valor_anterior, c.valor_nuevo, c.usuario]), [
    ["estado", "", "Entregado", "luis"],
    ["entregar", "4", "3.5", "luis"],
  ]);
  await assert.rejects(ventasBd.editarFila(fila.id, { codigo: "X" }, "luis"), { status: 400 });
  await assert.rejects(ventasBd.editarFila(fila.id, { entregar: "abc" }, "luis"), { status: 400 });
  await assert.rejects(ventasBd.editarFila(999, { estado: "x" }, "luis"), { status: 404 });
});

test("quitarFila borra la fila y deja constancia en el log", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS });
  const id = tablas.ventas_filas[0].id;
  await ventasBd.quitarFila(id, "ana");
  assert.equal(tablas.ventas_filas.length, 2);
  const log = tablas.ventas_log.at(-1);
  assert.deepEqual([log.accion, log.fila_id, log.usuario], ["quitar_fila", id, "ana"]);
});

test("obtenerPlanilla reinicia Pos en cada orden aunque lo guardado sea otro", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS });
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS });
  tablas.ventas_filas.slice(3).forEach((f, i) => { f.lote += 1; f.pos = 100 + i; });
  const { anio, mes } = ventasBd.mesActual();
  const { filas } = await ventasBd.obtenerPlanilla(anio, mes);
  assert.deepEqual(filas.map((f) => f.pos), [10, 20, 30, 10, 20, 30]);
  assert.equal(new Set(filas.map((f) => f.lote)).size, 2);
});

test("quitarOrden borra solo las filas de esa orden y deja constancia", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, codVenta: "1", itemsManuales: ITEMS, usuario: "ana" });
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, codVenta: "2", itemsManuales: [{ codigo: "100", cantidad: 1 }] });
  tablas.ventas_filas.slice(3).forEach((f) => { f.lote += 1; });
  const { planilla_id: planilla, lote } = { planilla_id: tablas.ventas_filas[0].planilla_id, lote: tablas.ventas_filas[0].lote };
  const r = await ventasBd.quitarOrden(planilla, lote, "luis");
  assert.equal(r.eliminadas, 3);
  assert.equal(tablas.ventas_filas.length, 1);
  const log = tablas.ventas_log.at(-1);
  assert.deepEqual([log.accion, log.usuario, log.detalle.filas, log.detalle.n_venta], ["quitar_orden", "luis", 3, "1"]);
  await assert.rejects(ventasBd.quitarOrden(planilla, lote, "luis"), { status: 404 });
});

test("nombreDescarga usa VENTAS dd-mm-aaaa.xlsx", () => {
  assert.equal(ventasBd.nombreDescarga(new Date(2026, 9, 5)), "VENTAS 05-10-2026.xlsx");
});

test("exportarPlanilla arma el Excel desde la BD, con totales y registra la descarga", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, codVenta: "7", itemsManuales: ITEMS });
  const { anio, mes } = ventasBd.mesActual();
  const { buffer, nombre } = await ventasBd.exportarPlanilla(anio, mes, "ana");
  assert.match(nombre, /^VENTAS \d{2}-\d{2}-\d{4}\.xlsx$/);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell(1, 1).value, "Pos");
  assert.deepEqual([2, 3, 4].map((f) => hoja.getCell(f, 2).value), ["999", "200", "100"]);
  assert.equal(hoja.getCell(4, 20).value, "Ana");
  assert.equal(hoja.getCell(4, 17).value.formula, "P4*K4");
  assert.equal(hoja.getCell(5, 17).value.formula, "SUM(Q2:Q4)");
  assert.equal(tablas.ventas_log.at(-1).accion, "descargar_excel");
  await assert.rejects(ventasBd.exportarPlanilla(2020, 1, "ana"), { status: 404 });
});

test("cada carga del mes se exporta como una orden con su total y sus encabezados", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [{ codigo: "100", cantidad: 1 }] });
  await new Promise((r) => setTimeout(r, 5));
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: [{ codigo: "100", cantidad: 2 }] });
  const { anio, mes } = ventasBd.mesActual();
  const { buffer } = await ventasBd.exportarPlanilla(anio, mes, "ana");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell(3, 16).value, "total");
  assert.equal(hoja.getCell(4, 1).value, "Pos");
  assert.equal(hoja.getCell(5, 2).value, "100");
  assert.equal(hoja.getCell(6, 17).value.formula, "SUM(Q5:Q5)");
  assert.equal(hoja.getCell(7, 1).value, "Pos");
});

test("leerAuditoria devuelve filas y log de la planilla", async () => {
  await ventasBd.anadirVenta({ contratistaIdx: 1, movTipo: 1, itemsManuales: ITEMS, usuario: "ana" });
  const id = tablas.ventas_planillas[0].id;
  const a = await ventasBd.leerAuditoria(id);
  assert.equal(a.filas.length, 3);
  assert.equal(a.log.length, 2);
  await assert.rejects(ventasBd.leerAuditoria(99), { status: 404 });
});
