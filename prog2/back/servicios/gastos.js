// Planilla de gastos mensual (portada de programa_3, Planilla_gastos_test.py).
const ExcelJS = require("exceljs");

const TOPICOS = [
  "CONSUMOS BASICOS", "TELEFONO E INTERNET", "GASTOS COMUNES", "ARRIENDO DE OFICINA", "COMBUSTIBLE",
  "ESCRITORIO Y OFICINA", "ESTACIONAMIENTO", "ARTICULOS DE ASEO", "GASTOS DE REPRESENTACIÓN",
  "VESTUARIO Y CALZADO", "PASAJES, PEAJES Y CORREOS", "MANTENIMIENTO, REPARACIÓN Y SEGURIDAD",
  "EQUIPAMIENTO", "ALIMENTACIÓN", "OTROS",
];

const EMPRESA = {
  nombre: "BERFRE LTDA.",
  direccion: "22 NORTE 1150 SANTA INES, VIÑA DEL MAR",
  gerente: "CRISTIAN BERNAL P.",
  cargo: "JEFE DE OPERACIONES",
};

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
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

// Devuelve la fecha como "aaaa-mm-dd" o "" si no es válida (equivale a fecha_iso).
function fechaIso(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? "" : valor.toISOString().slice(0, 10);
  const texto = String(valor ?? "").trim().slice(0, 10);
  let d;
  let m;
  let a;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (r) [, a, m, d] = r;
  else if ((r = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto))) [, d, m, a] = r;
  else return "";
  const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  if (fecha.getUTCFullYear() !== Number(a) || fecha.getUTCMonth() !== Number(m) - 1 || fecha.getUTCDate() !== Number(d)) return "";
  return fecha.toISOString().slice(0, 10);
}

function fechaComoDate(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Valida y normaliza una boleta. Devuelve { topico, proveedor, nboleta, fecha, monto }.
function validarGasto(gasto) {
  const g = gasto || {};
  const topico = String(g.topico ?? "").trim();
  const proveedor = String(g.proveedor ?? "").trim();
  const nboleta = String(g.nboleta ?? "").trim();
  const fechaTxt = String(g.fecha ?? "").trim();
  const montoTxt = String(g.monto ?? "").trim();
  if (!topico || !proveedor || !nboleta || !fechaTxt || !montoTxt) throw errorHttp(400, "Debe completar todos los campos.");
  const fecha = fechaIso(fechaTxt);
  if (!fecha) throw errorHttp(400, "La fecha de la boleta no es válida.");
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
// `mes` es el nombre ("diciembre"); también se acepta "aaaa-mm". `anioPedido` es opcional.
async function armarDetalle(gastos, mes, anioPedido) {
  const datos = validarGastos(gastos);
  let mesTxt = String(mes ?? "").trim().toUpperCase();
  let anio = Number.isInteger(anioPedido) && anioPedido >= 2000 && anioPedido <= 2100 ? anioPedido : new Date().getFullYear();
  const periodo = /^(\d{4})-(\d{2})$/.exec(mesTxt);
  if (periodo) {
    anio = Number(periodo[1]);
    mesTxt = MESES[Number(periodo[2]) - 1] || "";
  }
  if (!MESES.includes(mesTxt)) throw errorHttp(400, "Debe indicar un mes válido.");

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

  // Se guarda también el resultado de cada fórmula: así los valores se ven sin habilitar la edición.
  const sumaDe = (topico) => datos.filter((g) => g.topico === topico).reduce((acc, g) => acc + g.monto, 0);
  const filaTotal = 9 + TOPICOS.length;
  etiqueta(hoja, filaTotal, "TOTAL GASTOS DEL MES", true, true, true);
  monto(hoja, filaTotal, { formula: `SUM(E9:E${filaTotal - 1})`, result: datos.reduce((acc, g) => acc + g.monto, 0) }, true, true);

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
      celda(hoja, actual, 4, fechaComoDate(g.fecha), { alinear: "center", borde: true }).numFmt = "DD/MM/YYYY";
      monto(hoja, actual, g.monto);
    });
    const ultima = primera + propios.length - 1;
    const totalFila = ultima + 1;
    etiqueta(hoja, totalFila, "VALOR TOTAL", true, true, true);
    monto(hoja, totalFila, { formula: `SUM(E${primera}:E${ultima})`, result: sumaDe(topico) }, true, true);
    totales[topico] = `E${totalFila}`;
    fila = totalFila + 3;
  }

  TOPICOS.forEach((topico, i) => {
    const ref = totales[topico];
    monto(hoja, 9 + i, ref ? { formula: ref, result: sumaDe(topico) } : 0, true);
  });

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// Datos sin procesar: 5 columnas sin encabezado (igual que guardar_data).
async function guardarDatos(gastos) {
  const datos = validarGastos(gastos);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Sheet");
  datos.forEach((g, i) => {
    hoja.getRow(i + 1).values = [g.topico, g.proveedor, g.nboleta, fechaComoDate(g.fecha), g.monto];
  });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function textoCelda(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return fechaIso(valor);
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
    const fechaOk = fechaIso(fecha);
    if (!fechaOk) throw errorHttp(400, `Fecha no válida en la fila ${i}.`);
    const montoNum = Math.trunc(Number(montoCelda));
    if (!Number.isFinite(montoNum)) throw errorHttp(400, `Monto no válido en la fila ${i}.`);
    gastos.push({ topico, proveedor, nboleta, fecha: fechaOk, monto: montoNum });
  }
  return gastos;
}

module.exports = { TOPICOS, MESES, fechaIso, EMPRESA, validarGasto, validarGastos, armarDetalle, guardarDatos, recuperarDatos };
