process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";

const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { limpiarLogs, fechaCorte, generarExcelLog, leerTodo, RETENCION_DIAS } = require("../servicios/logsAuditoria");

test("la retención es 90 días para ventas/bitácora y 180 para usuarios/firmas", () => {
  assert.equal(RETENCION_DIAS.ventas_log.dias, 90);
  assert.equal(RETENCION_DIAS.bitacora_log.dias, 90);
  assert.equal(RETENCION_DIAS.usuarios_log.dias, 180);
  assert.equal(RETENCION_DIAS.bitacora_firmas_historial.dias, 180);
});

test("limpiarLogs borra cada tabla con su fecha de corte", async () => {
  const llamadas = [];
  const cliente = {
    from: (tabla) => ({
      delete: () => ({
        lt: async (columna, corte) => {
          llamadas.push({ tabla, columna, corte });
          return { error: null, count: 3 };
        },
      }),
    }),
  };
  const ahora = new Date("2026-11-05T12:00:00Z");
  const resultado = await limpiarLogs(cliente, ahora);
  const por = Object.fromEntries(llamadas.map((l) => [l.tabla, l]));
  assert.equal(por.ventas_log.corte, fechaCorte(90, ahora));
  assert.equal(por.bitacora_log.corte, fechaCorte(90, ahora));
  assert.equal(por.usuarios_log.corte, fechaCorte(180, ahora));
  assert.equal(por.bitacora_firmas_historial.corte, fechaCorte(180, ahora));
  assert.equal(por.bitacora_firmas_historial.columna, "quitada_en");
  assert.equal(resultado.ventas_log, 3);
});

test("un fallo en una tabla no impide limpiar las demás", async () => {
  const cliente = {
    from: (tabla) => ({
      delete: () => ({ lt: async () => (tabla === "ventas_log" ? { error: new Error("falla") } : { error: null, count: 1 }) }),
    }),
  };
  const original = console.error;
  console.error = () => {};
  const resultado = await limpiarLogs(cliente);
  console.error = original;
  assert.equal(resultado.ventas_log, null);
  assert.equal(resultado.usuarios_log, 1);
});

test("leerTodo pagina por tramos hasta agotar las filas", async () => {
  const total = 2300;
  const construir = () => ({
    range: async (desde, hasta) => ({ data: Array.from({ length: Math.max(0, Math.min(hasta + 1, total) - desde) }, (_, i) => ({ id: desde + i })), error: null }),
  });
  assert.equal((await leerTodo(construir, () => {})).length, total);
});

test("generarExcelLog escribe encabezados y filas", async () => {
  const buffer = await generarExcelLog("Log", [{ titulo: "Usuario", clave: "usuario" }, { titulo: "Acción", clave: "accion", formato: (v) => `A:${v}` }], [{ usuario: "ana", accion: "x" }]);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.getWorksheet("Log");
  assert.equal(hoja.getCell("A1").value, "Usuario");
  assert.equal(hoja.getCell("B2").value, "A:x");
});
