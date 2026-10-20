process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { TOPICOS, validarGasto, armarDetalle, guardarDatos, recuperarDatos } = require("../gastos");

const GASTOS = [
  { topico: "COMBUSTIBLE", proveedor: "Copec", nboleta: "123", fecha: "2024-12-01", monto: "15000" },
  { topico: "COMBUSTIBLE", proveedor: "Shell", nboleta: "124", fecha: "2024-12-02", monto: 5000 },
  { topico: "OTROS", proveedor: "Ferretería", nboleta: "9", fecha: "2024-12-03", monto: "700" },
];

test("validarGasto exige campos y monto entero", () => {
  assert.throws(() => validarGasto({ ...GASTOS[0], proveedor: "" }), /completar/);
  assert.throws(() => validarGasto({ ...GASTOS[0], monto: "12,5" }), /entero/);
  assert.throws(() => validarGasto({ ...GASTOS[0], topico: "NADA" }), /Tópico/);
  assert.throws(() => validarGasto({ ...GASTOS[0], fecha: "2024-02-31" }), /fecha/);
  assert.equal(validarGasto({ ...GASTOS[0], fecha: "05/12/2024" }).fecha, "2024-12-05");
  assert.equal(validarGasto(GASTOS[0]).monto, 15000);
});

test("armarDetalle genera resumen, detalle y fórmulas por tópico", async () => {
  const buffer = await armarDetalle(GASTOS, "diciembre", 2024);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.name, "GASTOS DICIEMBRE 2024");
  assert.equal(hoja.getCell("B3").value, "EMPRESA: BERFRE LTDA.");
  assert.equal(hoja.getCell("B8").value, "CLASIFICACION DEL GASTO");
  const filaCombustible = 9 + TOPICOS.indexOf("COMBUSTIBLE");
  assert.equal(hoja.getCell(filaCombustible, 2).value, "COMBUSTIBLE");
  assert.ok(hoja.getCell(filaCombustible, 5).value.formula);
  assert.equal(hoja.getCell(9, 5).value, 0);
  const total = hoja.getCell(9 + TOPICOS.length, 5).value;
  assert.equal(total.formula, `SUM(E9:E${8 + TOPICOS.length})`);
  const textos = [];
  hoja.eachRow((fila) => fila.eachCell((c) => textos.push(c.value)));
  assert.ok(textos.includes("Copec"));
  assert.ok(textos.includes("DETALLE GASTOS EN OTROS MES DICIEMBRE DEL AÑO 2024"));
});

test("armarDetalle rechaza mes vacío", async () => {
  await assert.rejects(() => armarDetalle(GASTOS, " "), /mes/);
});

test("guardarDatos y recuperarDatos son inversos", async () => {
  const buffer = await guardarDatos(GASTOS);
  const recuperados = await recuperarDatos(buffer);
  assert.equal(recuperados.length, 3);
  assert.deepEqual(recuperados[0], { topico: "COMBUSTIBLE", proveedor: "Copec", nboleta: "123", fecha: "2024-12-01", monto: 15000 });
});

test("recuperarDatos lee el formato antiguo de programa_3 y corta en fila incompleta", async () => {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Sheet");
  hoja.addRow(["ALIMENTACIÓN", "Casino", 55, "2024-12-05", 4500]);
  hoja.addRow(["ALIMENTACIÓN", "Casino", 56, "2024-12-06", null]);
  hoja.addRow(["OTROS", "X", 1, "2024-12-07", 10]);
  const recuperados = await recuperarDatos(Buffer.from(await libro.xlsx.writeBuffer()));
  assert.equal(recuperados.length, 1);
  assert.equal(recuperados[0].nboleta, "55");
});

test("recuperarDatos rechaza archivos inválidos", async () => {
  await assert.rejects(() => recuperarDatos(Buffer.from("no es excel")), /recuperación/);
});
