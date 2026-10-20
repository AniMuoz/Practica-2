// Planilla de gastos mensual (portada de programa_3, Planilla_gastos_final.py).
const ExcelJS = require("exceljs");

const TOPICOS = [
  "CONSUMOS BASICOS", "TELEFONO E INTERNET", "GASTOS COMUNES", "ARRIENDO DE OFICINA", "COMBUSTIBLE",
  "ESCRITORIO Y OFICINA", "ESTACIONAMIENTO", "ARTICULOS DE ASEO", "GASTOS DE REPRESENTACIÓN",
  "VESTUARIO Y CALZADO", "PASAJES, PEAJES Y CORREOS", "MANTENIMIENTO, REPARACIÓN Y SEGURIDAD",
  "EQUIPAMIENTO", "ALIMENTACIÓN", "OTROS",
];

const EMPRESA = {
  nombre: "PRETORIANOS SEGURIDAD",
  direccion: "MANUEL BULNES Nº 920, OFICINA 208, QUILPUÉ",
  gerente: "FREDDY ANDRES MUÑOZ OLIVARES",
  cargo: "GERENTE GENERAL",
};

const FORMATO_PESOS = '_-[$$-340A]* #,##0_-;-[$$-340A]* #,##0_-;_-[$$-340A]* "-"??_-;_-@_-';
const FUENTE = "Calibri";
const RELLENO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
const LADO = { style: "thin" };
const BORDE = { left: LADO, right: LADO, top: LADO, bottom: LADO };

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function fuente(negrita = false, size = 12) {
  return { name: FUENTE, bold: negrita, size };
}

// Valida y normaliza una boleta. Devuelve { topico, proveedor, nboleta, fecha, monto }.
function validarGasto(gasto) {
  const g = gasto || {};
  const topico = String(g.topico ?? "").trim();
  const proveedor = String(g.proveedor ?? "").trim();
  const nboleta = String(g.nboleta ?? "").trim();
  const fecha = String(g.fecha ?? "").trim();
  const montoTxt = String(g.monto ?? "").trim();
  if (!topico || !proveedor || !nboleta || !fecha || !montoTxt) throw errorHttp(400, "Debe completar todos los campos.");
  if (!TOPICOS.includes(topico)) throw errorHttp(400, `Tópico no válido: ${topico}.`);
  if (!/^-?\d+$/.test(montoTxt)) throw errorHttp(400, "El monto debe ser un número entero.");
  return { topico, proveedor, nboleta, fecha, monto: Number(montoTxt) };
}

function validarGastos(gastos) {
  if (!Array.isArray(gastos)) throw errorHttp(400, "La lista de gastos no es válida.");
  return gastos.map(validarGasto);
}

function etiqueta(hoja, fila, texto, negrita, centrado, relleno = false) {
  hoja.mergeCells(fila, 2, fila, 4);
  const celda = hoja.getCell(fila, 2);
  celda.value = texto;
  celda.font = fuente(negrita);
  celda.alignment = { horizontal: centrado ? "center" : "left" };
  if (relleno) celda.fill = RELLENO;
  for (let c = 2; c <= 4; c += 1) hoja.getCell(fila, c).border = BORDE;
}

function monto(hoja, fila, valor, negrita = false, relleno = false) {
  const celda = hoja.getCell(fila, 5);
  celda.value = valor;
  celda.font = fuente(negrita);
  celda.numFmt = FORMATO_PESOS;
  celda.alignment = { horizontal: "right" };
  celda.border = BORDE;
  if (relleno) celda.fill = RELLENO;
}

function celda(hoja, fila, columna, valor, opciones = {}) {
  const c = hoja.getCell(fila, columna);
  c.value = valor;
  c.font = fuente(opciones.negrita);
  if (opciones.alinear) c.alignment = { horizontal: opciones.alinear };
  if (opciones.borde) c.border = BORDE;
  if (opciones.relleno) c.fill = RELLENO;
  return c;
}

// Hoja de detalle mensual (equivale a armar_detalle).
async function armarDetalle(gastos, mes, anio = new Date().getFullYear()) {
  const datos = validarGastos(gastos);
  const mesTxt = String(mes ?? "").trim().toUpperCase();
  if (!mesTxt) throw errorHttp(400, "Debe indicar el mes.");

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet(`GASTOS ${mesTxt} ${anio}`.slice(0, 31));
  hoja.getColumn("B").width = 59.43;
  hoja.getColumn("C").width = 13;
  hoja.getColumn("D").width = 11.29;
  hoja.getColumn("E").width = 19.14;

  hoja.getCell("B3").value = `EMPRESA: ${EMPRESA.nombre}`;
  hoja.getCell("B3").font = fuente(false, 11);
  hoja.getCell("B4").value = `DIRECCIÓN: ${EMPRESA.direccion}`;
  hoja.getCell("B4").font = fuente(false, 11);
  hoja.getCell("B6").value = `DETALLE GENERAL DE GASTOS MES ${mesTxt} DEL AÑO ${anio}`;
  hoja.getCell("B6").font = fuente(true);

  etiqueta(hoja, 8, "CLASIFICACION DEL GASTO", true, true, true);
  celda(hoja, 8, 5, "MONTO", { negrita: true, alinear: "center", borde: true, relleno: true });
  TOPICOS.forEach((topico, i) => etiqueta(hoja, 9 + i, topico, false, false));

  const filaTotal = 9 + TOPICOS.length;
  etiqueta(hoja, filaTotal, "TOTAL GASTOS DEL MES", true, true, true);
  monto(hoja, filaTotal, { formula: `SUM(E9:E${filaTotal - 1})` }, true, true);

  const firma = filaTotal + 3;
  celda(hoja, firma, 4, EMPRESA.gerente, { negrita: true, alinear: "center" });
  celda(hoja, firma + 1, 4, EMPRESA.cargo, { negrita: true, alinear: "center" });

  const totales = {};
  let fila = firma + 4;
  for (const topico of TOPICOS) {
    const propios = datos.filter((g) => g.topico === topico);
    if (!propios.length) continue;
    celda(hoja, fila, 2, `DETALLE GASTOS EN ${topico} MES ${mesTxt} DEL AÑO ${anio}`, { negrita: true });
    const encabezado = fila + 2;
    ["PROVEEDOR", "N° BOLETA", "FECHA", "MONTO"].forEach((texto, i) => {
      celda(hoja, encabezado, 2 + i, texto, { negrita: true, alinear: "center", borde: true, relleno: true });
    });
    const primera = encabezado + 1;
    propios.forEach((g, i) => {
      const actual = primera + i;
      celda(hoja, actual, 2, g.proveedor, { borde: true });
      celda(hoja, actual, 3, g.nboleta, { alinear: "right", borde: true });
      celda(hoja, actual, 4, g.fecha, { alinear: "center", borde: true });
      monto(hoja, actual, g.monto);
    });
    const ultima = primera + propios.length - 1;
    const totalFila = ultima + 1;
    etiqueta(hoja, totalFila, "VALOR TOTAL", true, true, true);
    monto(hoja, totalFila, { formula: `SUM(E${primera}:E${ultima})` }, true, true);
    totales[topico] = `E${totalFila}`;
    fila = totalFila + 3;
  }

  TOPICOS.forEach((topico, i) => {
    const ref = totales[topico];
    monto(hoja, 9 + i, ref ? { formula: ref } : 0, true);
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// Datos sin procesar: 5 columnas sin encabezado (igual que guardar_data).
async function guardarDatos(gastos) {
  const datos = validarGastos(gastos);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Sheet");
  datos.forEach((g, i) => {
    hoja.getRow(i + 1).values = [g.topico, g.proveedor, g.nboleta, g.fecha, g.monto];
  });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function textoCelda(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toLocaleDateString("es-CL");
  if (typeof valor === "object") return String(valor.text ?? valor.result ?? "");
  return String(valor);
}

// Lee un archivo de datos sin procesar (equivale a recuperar_data: corta en la primera fila incompleta).
async function recuperarDatos(buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw errorHttp(400, "No se pudo leer el archivo de recuperación.");
  }
  const hoja = libro.worksheets[0];
  const gastos = [];
  if (!hoja) return gastos;
  for (let i = 1; i <= hoja.rowCount; i += 1) {
    const [topico, proveedor, nboleta, fecha, montoCelda] = [1, 2, 3, 4, 5].map((c) => textoCelda(hoja.getCell(i, c).value).trim());
    if (!topico || !proveedor || !nboleta || !fecha || !montoCelda) break;
    const montoNum = Math.trunc(Number(montoCelda));
    if (!Number.isFinite(montoNum)) throw errorHttp(400, `Monto no válido en la fila ${i}.`);
    gastos.push({ topico, proveedor, nboleta, fecha, monto: montoNum });
  }
  return gastos;
}

function nombreDia(fecha = new Date()) {
  return `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, "0")}${String(fecha.getDate()).padStart(2, "0")}`;
}

module.exports = { TOPICOS, EMPRESA, validarGasto, validarGastos, armarDetalle, guardarDatos, recuperarDatos, nombreDia };
