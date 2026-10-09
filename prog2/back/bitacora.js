const path = require("path");
const ExcelJS = require("exceljs");
const { supabase } = require("./supabase");
const { claveCorrecta } = require("./fuenteDatos");

const LOGO = path.join(__dirname, "assets", "logo-bitacora.png");
const LARGO_MAXIMO = 200;

const COLUMNAS = [
  { campo: "fecha", titulo: "FECHA", ancho: 9 },
  { campo: "chofer", titulo: "CHOFER", ancho: 9.88671875 },
  { campo: "rut", titulo: "RUT", ancho: 7.44140625 },
  { campo: "patente", titulo: "PATENTE", ancho: 6.88671875 },
  { campo: "ruta", titulo: "RUTA", ancho: 11.33203125 },
  { campo: "h_salida", titulo: "H.SALIDA", ancho: 6.6640625 },
  { campo: "h_llegada", titulo: "H.LLEGADA", ancho: 7.88671875 },
  { campo: "km_ini", titulo: "KM/INI", ancho: 6.88671875 },
  { campo: "km_term", titulo: "KM/TERM", ancho: 7.33203125 },
  { campo: "km_reco", titulo: "KM/RECO", ancho: 8.109375 },
  { campo: "observacion", titulo: "OBSERVACION", ancho: 27.6640625 },
  { campo: "firma", titulo: "FIRMA", ancho: 15.5546875 },
];

const CAMPOS = COLUMNAS.map((columna) => columna.campo);
const CAMPOS_KM = new Set(["km_ini", "km_term", "km_reco"]);

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function falloBd(error) {
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    throw errorHttp(503, "En Supabase faltan las tablas de la bitácora. Ejecuta prog2/back/esquema.sql en el SQL Editor y vuelve a intentar.");
  }
  throw errorHttp(502, error.message || "Supabase no respondió.");
}

function exigirClave(clave) {
  if (!claveCorrecta(clave)) throw errorHttp(403, "Contraseña incorrecta.");
}

function enteroPositivo(valor, nombre) {
  const texto = String(valor ?? "").trim();
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) < 1) {
    throw errorHttp(400, `${nombre} inválido.`);
  }
  return Number(texto);
}

function numeroKm(valor) {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (texto === "" || !/^-?\d+(\.\d+)?$/.test(texto)) return null;
  return Number(texto);
}

function calcularRecorrido(kmIni, kmTerm) {
  const inicio = numeroKm(kmIni);
  const termino = numeroKm(kmTerm);
  if (inicio === null || termino === null) return "";
  const resultado = Math.round((termino - inicio) * 1000) / 1000;
  return String(resultado);
}

function limpiarFila(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    throw errorHttp(400, "No hay datos para guardar.");
  }
  const fila = {};
  CAMPOS.forEach((campo) => {
    fila[campo] = String(datos[campo] ?? "").trim().slice(0, LARGO_MAXIMO);
  });
  if (fila.fecha !== "" && !fechaValida(fila.fecha)) throw errorHttp(400, "La fecha no es válida.");
  fila.km_reco = calcularRecorrido(fila.km_ini, fila.km_term);
  return fila;
}

function fechaValida(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const fecha = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  return fecha.toISOString().slice(0, 10) === texto;
}

function fechaLegible(texto) {
  return fechaValida(texto) ? texto.split("-").reverse().join("/") : texto;
}

async function crearFolio(clave) {
  exigirClave(clave);
  const { data, error } = await supabase.from("bitacora_folios").insert({}).select("folio, creado_en").single();
  if (error) falloBd(error);
  return { folio: data.folio, creado_en: data.creado_en, filas: [] };
}

async function ultimoFolio() {
  const { data, error } = await supabase.from("bitacora_folios").select("folio").order("folio", { ascending: false }).limit(1);
  if (error) falloBd(error);
  const { count, error: errorTotal } = await supabase
    .from("bitacora_folios")
    .select("folio", { count: "exact", head: true })
    .is("eliminado_en", null);
  if (errorTotal) falloBd(errorTotal);
  return { ultimo: data && data.length ? data[0].folio : null, total: count || 0 };
}

async function folioActivo(folio) {
  const { data, error } = await supabase.from("bitacora_folios").select("folio, creado_en, eliminado_en").eq("folio", folio).maybeSingle();
  if (error) falloBd(error);
  if (!data) throw errorHttp(404, `El folio ${folio} no existe.`);
  if (data.eliminado_en) throw errorHttp(410, "Folio eliminado");
  return data;
}

async function leerFilas(folio) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("bitacora_filas")
      .select(["n_fila", ...CAMPOS].join(", "))
      .eq("folio", folio)
      .order("n_fila", { ascending: true })
      .range(desde, desde + 999);
    if (error) falloBd(error);
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

async function leerFolio(valor) {
  const folio = enteroPositivo(valor, "Folio");
  const data = await folioActivo(folio);
  return { folio: data.folio, creado_en: data.creado_en, filas: await leerFilas(folio) };
}

async function guardarFila(clave, valorFolio, valorFila, datos) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  const nFila = enteroPositivo(valorFila, "Fila");
  const fila = limpiarFila(datos);

  await folioActivo(folio);

  const { data: ultima, error: errorUltima } = await supabase
    .from("bitacora_filas")
    .select("n_fila")
    .eq("folio", folio)
    .order("n_fila", { ascending: false })
    .limit(1);
  if (errorUltima) falloBd(errorUltima);
  const maxima = ultima && ultima.length ? ultima[0].n_fila : 0;
  if (nFila > maxima + 1) throw errorHttp(400, `La siguiente fila disponible es la ${maxima + 1}.`);

  const registro = { folio, n_fila: nFila, ...fila };
  const { error } = await supabase.from("bitacora_filas").upsert(registro, { onConflict: "folio,n_fila" });
  if (error) falloBd(error);
  return { fila: { n_fila: nFila, ...fila } };
}

async function quitarFila(clave, valorFolio, valorFila) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  const nFila = enteroPositivo(valorFila, "Fila");
  await folioActivo(folio);

  const { error } = await supabase.from("bitacora_filas").delete().eq("folio", folio).eq("n_fila", nFila);
  if (error) falloBd(error);

  const { data: siguientes, error: errorSiguientes } = await supabase
    .from("bitacora_filas")
    .select("n_fila")
    .eq("folio", folio)
    .gt("n_fila", nFila)
    .order("n_fila", { ascending: true });
  if (errorSiguientes) falloBd(errorSiguientes);
  for (const { n_fila: actual } of siguientes || []) {
    const { error: errorMover } = await supabase
      .from("bitacora_filas")
      .update({ n_fila: actual - 1 })
      .eq("folio", folio)
      .eq("n_fila", actual);
    if (errorMover) falloBd(errorMover);
  }
  return leerFolio(folio);
}

async function eliminarFolio(clave, valorFolio, confirmacion) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  if (String(confirmacion ?? "").trim() !== String(folio)) {
    throw errorHttp(400, "La confirmacion no coincide con el numero de folio.");
  }
  await folioActivo(folio);

  const { error: errorFilas } = await supabase.from("bitacora_filas").delete().eq("folio", folio);
  if (errorFilas) falloBd(errorFilas);
  const { error } = await supabase.from("bitacora_folios").update({ eliminado_en: new Date().toISOString() }).eq("folio", folio);
  if (error) falloBd(error);
  return { folio, eliminado: true };
}

const FUENTE = "Aptos Narrow";
const BORDE = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

async function armarExcel(folio, filas) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Hoja1", {
    pageSetup: { orientation: "landscape" },
    properties: { defaultRowHeight: 14.4 },
  });
  COLUMNAS.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = columna.ancho;
  });

  hoja.getRow(1).height = 33.6;
  const titulo = hoja.getCell("C1");
  titulo.value = "PLANILLA CONTROL DE VIAJE";
  titulo.font = { name: FUENTE, size: 26, bold: true };
  hoja.mergeCells("K1:L1");
  const numero = hoja.getCell("K1");
  numero.value = `FOLIO Nº ${folio}`;
  numero.font = { name: FUENTE, size: 26, bold: true };
  numero.alignment = { horizontal: "center" };

  const logo = libro.addImage({ filename: LOGO, extension: "png" });
  hoja.addImage(logo, { tl: { col: 0, row: 0 }, ext: { width: 136, height: 59.5 } });

  COLUMNAS.forEach((columna, indice) => {
    const celda = hoja.getCell(4, indice + 1);
    celda.value = columna.titulo;
    celda.font = { name: FUENTE, size: 8, bold: true };
    celda.alignment = { horizontal: "center" };
    celda.border = BORDE;
  });

  for (let indice = 0; indice < filas.length; indice += 1) {
    const fila = filas[indice];
    const hojaFila = hoja.getRow(5 + indice);
    hojaFila.height = 28.5;
    COLUMNAS.forEach((columna, posicion) => {
      const celda = hojaFila.getCell(posicion + 1);
      let valor = fila ? fila[columna.campo] : "";
      if (fila && CAMPOS_KM.has(columna.campo)) {
        const numeroKilometros = numeroKm(valor);
        if (numeroKilometros !== null) valor = numeroKilometros;
      }
      if (columna.campo === "fecha") {
        valor = fechaLegible(valor);
        celda.alignment = { shrinkToFit: true };
      }
      if (valor !== "" && valor != null) celda.value = valor;
      celda.font = { name: FUENTE, size: 11 };
      celda.border = BORDE;
    });
  }
  return libro.xlsx.writeBuffer();
}

async function exportarFolio(valor) {
  const { folio, filas } = await leerFolio(valor);
  const buffer = await armarExcel(folio, filas);
  return { buffer, nombre: `Bitacora folio ${folio}.xlsx` };
}

module.exports = {
  COLUMNAS,
  calcularRecorrido,
  limpiarFila,
  enteroPositivo,
  crearFolio,
  ultimoFolio,
  leerFolio,
  guardarFila,
  quitarFila,
  eliminarFolio,
  armarExcel,
  exportarFolio,
};
