const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const { supabase } = require("./supabase");
const { claveCorrecta } = require("./fuenteDatos");
const { subirImagen, bajarImagen, quitarImagen } = require("./imagenesSupabase");

const LOGO = path.join(__dirname, "assets", "logo-bitacora.png");
const LARGO_MAXIMO = 200;
const PREFIJO_IMAGEN = "img:";
const TAMANO_MAXIMO_FIRMA = 100 * 1024;
const LADO_MAXIMO_FIRMA = 2000;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
const CAMPOS_RESUMEN_FIRMA = ["fecha", "chofer", "rut", "patente", "ruta", "h_salida", "h_llegada", "km_ini", "km_term", "km_reco"];
const CAMPOS_VERIFICACION = ["firma_hash", "firma_datos", "firma_en"];

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function falloBd(error) {
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    throw errorHttp(503, "En Supabase faltan las tablas de la bitácora. Ejecuta prog2/back/esquema.sql en el SQL Editor y vuelve a intentar.");
  }
  console.error(error);
  throw errorHttp(502, "Supabase no respondió.");
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

function resumenFirma(fila) {
  return CAMPOS_RESUMEN_FIRMA.map((campo) => String(fila?.[campo] ?? "").trim()).join("|");
}

function hashTexto(texto) {
  return crypto.createHash("sha256").update(String(texto), "utf8").digest("hex");
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function rutNormalizado(valor) {
  return String(valor ?? "").replace(/[.\s]/g, "").toLowerCase();
}

function estadoFirma(fila) {
  if (!nombreFirma(fila?.firma)) return "sin_firma";
  if (!fila.firma_hash || !fila.firma_datos) return "sin_verificacion";
  return fila.firma_datos === hashTexto(resumenFirma(fila)) ? "vigente" : "vencida";
}

function conEstadoFirma(fila) {
  return { ...fila, firma_estado: estadoFirma(fila) };
}

function nombreFirma(valor) {
  const texto = String(valor ?? "");
  if (!texto.startsWith(PREFIJO_IMAGEN)) return null;
  const nombre = texto.slice(PREFIJO_IMAGEN.length);
  return /^firma-\d+-\d+-\d+\.(png|jpg)$/.test(nombre) ? nombre : null;
}

function dimensionesJpg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let pos = 2;
  while (pos + 9 < buffer.length) {
    if (buffer[pos] !== 0xff) { pos += 1; continue; }
    const marca = buffer[pos + 1];
    if (marca === 0xff) { pos += 1; continue; }
    if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { pos += 2; continue; }
    const largo = buffer.readUInt16BE(pos + 2);
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      const alto = buffer.readUInt16BE(pos + 5);
      const ancho = buffer.readUInt16BE(pos + 7);
      return ancho > 0 && alto > 0 ? { ancho, alto } : null;
    }
    if (largo < 2) return null;
    pos += 2 + largo;
  }
  return null;
}

function tipoImagen(buffer) {
  if (dimensionesPng(buffer)) return { extension: "png", mime: "image/png", medidas: dimensionesPng(buffer) };
  const jpg = dimensionesJpg(buffer);
  if (jpg) return { extension: "jpg", mime: "image/jpeg", medidas: jpg };
  return null;
}

function dimensionesPng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || !buffer.subarray(0, 8).equals(FIRMA_PNG)) return null;
  const ancho = buffer.readUInt32BE(16);
  const alto = buffer.readUInt32BE(20);
  return ancho > 0 && alto > 0 ? { ancho, alto } : null;
}

async function firmaActual(folio, nFila) {
  const { data, error } = await supabase
    .from("bitacora_filas")
    .select(["firma", ...CAMPOS_VERIFICACION].join(", "))
    .eq("folio", folio)
    .eq("n_fila", nFila)
    .maybeSingle();
  if (error) falloBd(error);
  return data;
}

async function borrarFirmas(valores) {
  for (const valor of valores) {
    const nombre = nombreFirma(valor);
    if (nombre) await quitarImagen(nombre).catch(() => {});
  }
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

async function registrarLog(usuario, evento) {
  try {
    const registros = (Array.isArray(evento) ? evento : [evento]).map((e) => ({
      usuario: String(usuario || ""),
      accion: e.accion,
      folio: e.folio ?? null,
      n_fila: e.n_fila ?? null,
      campo: e.campo ?? null,
      valor_anterior: e.valor_anterior ?? null,
      valor_nuevo: e.valor_nuevo ?? null,
      detalle: e.detalle || {},
    }));
    if (registros.length === 0) return;
    const { error } = await supabase.from("bitacora_log").insert(registros);
    if (error) console.error("No se pudo registrar el log de la bitácora:", error);
  } catch (error) {
    console.error("No se pudo registrar el log de la bitácora:", error);
  }
}

const LIMITE_LOG = 50;

async function listarLog(filtros = {}) {
  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  let q = supabase
    .from("bitacora_log")
    .select("id, creado_en, usuario, accion, folio, n_fila, campo, valor_anterior, valor_nuevo, detalle", { count: "exact" });
  if (filtros.folio) q = q.eq("folio", enteroPositivo(filtros.folio, "Folio"));
  if (filtros.usuario) q = q.eq("usuario", String(filtros.usuario));
  if (filtros.accion) q = q.eq("accion", String(filtros.accion));
  if (filtros.desde && typeof q.gte === "function") q = q.gte("creado_en", `${filtros.desde}T00:00:00`);
  if (filtros.hasta && typeof q.lte === "function") q = q.lte("creado_en", `${filtros.hasta}T23:59:59.999`);
  const desde = (pagina - 1) * LIMITE_LOG;
  const { data, count, error } = await q.order("creado_en", { ascending: false }).range(desde, desde + LIMITE_LOG - 1);
  if (error) falloBd(error);
  return { eventos: data || [], total: count || 0, pagina, por_pagina: LIMITE_LOG };
}

async function crearFolio(clave, usuario) {
  exigirClave(clave);
  const { data, error } = await supabase.from("bitacora_folios").insert({}).select("folio, creado_en").single();
  if (error) falloBd(error);
  await registrarLog(usuario, { accion: "crear_folio", folio: data.folio });
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
      .select(["n_fila", ...CAMPOS, ...CAMPOS_VERIFICACION].join(", "))
      .eq("folio", folio)
      .order("n_fila", { ascending: true })
      .range(desde, desde + 999);
    if (error) falloBd(error);
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return filas.map(conEstadoFirma);
}

async function leerHistorialFirmas(folio) {
  const { data, error } = await supabase
    .from("bitacora_firmas_historial")
    .select("id, n_fila, firma, firma_hash, firma_en, quitada_en, motivo")
    .eq("folio", folio)
    .order("quitada_en", { ascending: false });
  if (error) falloBd(error);
  return data || [];
}

async function leerFolio(valor) {
  const folio = enteroPositivo(valor, "Folio");
  const data = await folioActivo(folio);
  const [filas, historial_firmas] = await Promise.all([leerFilas(folio), leerHistorialFirmas(folio)]);
  return { folio: data.folio, creado_en: data.creado_en, filas, historial_firmas };
}

async function listarAuditoria() {
  const { data, error } = await supabase.from("bitacora_folios").select("folio, creado_en, eliminado_en").order("folio", { ascending: false });
  if (error) falloBd(error);
  return data || [];
}

async function leerAuditoria(valor) {
  const folio = enteroPositivo(valor, "Folio");
  const { data, error } = await supabase.from("bitacora_folios").select("folio, creado_en, eliminado_en").eq("folio", folio).maybeSingle();
  if (error) falloBd(error);
  if (!data) throw errorHttp(404, `El folio ${folio} no existe.`);
  const [filas, historial_firmas] = await Promise.all([leerFilas(folio), leerHistorialFirmas(folio)]);
  const log = (await listarLog({ folio })).eventos;
  return { folio: data.folio, creado_en: data.creado_en, eliminado_en: data.eliminado_en || null, filas, historial_firmas, log };
}

async function guardarFila(clave, valorFolio, valorFila, datos, usuario) {
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

  const anterior = await firmaActual(folio, nFila);
  const firmaGuardada = anterior ? anterior.firma : "";
  if (nombreFirma(firmaGuardada) && fila.firma !== firmaGuardada) {
    throw errorHttp(400, "La imagen de la firma se quita con el botón Quitar imagen.");
  }
  if (fila.firma.startsWith(PREFIJO_IMAGEN) && fila.firma !== firmaGuardada) {
    throw errorHttp(400, "La imagen de la firma se sube con el botón de imagen.");
  }

  const { data: previa, error: errorPrevia } = await supabase
    .from("bitacora_filas")
    .select(CAMPOS.join(", "))
    .eq("folio", folio)
    .eq("n_fila", nFila)
    .maybeSingle();
  if (errorPrevia) falloBd(errorPrevia);

  const registro = { folio, n_fila: nFila, ...fila };
  const { error } = await supabase.from("bitacora_filas").upsert(registro, { onConflict: "folio,n_fila" });
  if (error) falloBd(error);
  if (!previa) await registrarLog(usuario, { accion: "anadir_fila", folio, n_fila: nFila });
  const cambios = CAMPOS.filter((campo) => campo !== "km_reco" && String(previa?.[campo] ?? "") !== fila[campo]).map((campo) => ({
    accion: "editar_celda",
    folio,
    n_fila: nFila,
    campo,
    valor_anterior: String(previa?.[campo] ?? ""),
    valor_nuevo: fila[campo],
  }));
  await registrarLog(usuario, cambios);
  if (firmaGuardada && firmaGuardada !== fila.firma) await borrarFirmas([firmaGuardada]);
  const guardada = { ...fila, firma_hash: anterior?.firma_hash || "", firma_datos: anterior?.firma_datos || "", firma_en: anterior?.firma_en || null };
  return { fila: conEstadoFirma({ n_fila: nFila, ...guardada }) };
}

async function subirFirma(clave, valorFolio, valorFila, buffer, rutConfirmado, usuario) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  const nFila = enteroPositivo(valorFila, "Fila");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw errorHttp(400, "Falta la imagen de la firma.");
  if (buffer.length > TAMANO_MAXIMO_FIRMA) throw errorHttp(400, "La imagen de la firma pesa más de 100 KB.");
  const tipo = tipoImagen(buffer);
  if (!tipo) throw errorHttp(400, "La imagen de la firma debe ser un archivo PNG o JPG.");
  const medidas = tipo.medidas;
  if (medidas.ancho > LADO_MAXIMO_FIRMA || medidas.alto > LADO_MAXIMO_FIRMA) {
    throw errorHttp(400, `La imagen de la firma no puede superar ${LADO_MAXIMO_FIRMA} píxeles por lado.`);
  }

  await folioActivo(folio);
  const { data: fila, error: errorFila } = await supabase
    .from("bitacora_filas")
    .select(["n_fila", ...CAMPOS, ...CAMPOS_VERIFICACION].join(", "))
    .eq("folio", folio)
    .eq("n_fila", nFila)
    .maybeSingle();
  if (errorFila) falloBd(errorFila);
  if (!fila) throw errorHttp(404, `La fila ${nFila} del folio ${folio} no existe.`);
  if (nombreFirma(fila.firma)) {
    throw errorHttp(409, "Esta fila ya tiene una firma. Quítala antes de subir otra.");
  }
  if (rutNormalizado(fila.rut) === "") throw errorHttp(400, "La fila debe tener RUT antes de subir la firma.");
  if (rutNormalizado(rutConfirmado) !== rutNormalizado(fila.rut)) {
    throw errorHttp(400, "El RUT confirmado no coincide con el de la fila.");
  }

  const nombre = `firma-${folio}-${nFila}-${Date.now()}.${tipo.extension}`;
  await subirImagen(nombre, buffer, tipo.mime);
  const valor = `${PREFIJO_IMAGEN}${nombre}`;
  const firmaEn = new Date().toISOString();
  const verificacion = {
    firma: valor,
    firma_hash: hashBuffer(buffer),
    firma_datos: hashTexto(resumenFirma(fila)),
    firma_en: firmaEn,
  };
  const { error } = await supabase.from("bitacora_filas").update(verificacion).eq("folio", folio).eq("n_fila", nFila);
  if (error) {
    await quitarImagen(nombre).catch(() => {});
    falloBd(error);
  }
  await registrarLog(usuario, { accion: "subir_firma", folio, n_fila: nFila, detalle: { hash: verificacion.firma_hash } });
  return { fila: conEstadoFirma({ ...fila, ...verificacion }) };
}

async function quitarFirma(clave, valorFolio, valorFila, motivo, usuario) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  const nFila = enteroPositivo(valorFila, "Fila");
  const texto = String(motivo ?? "").trim().slice(0, LARGO_MAXIMO);
  if (texto === "") throw errorHttp(400, "Indica el motivo para quitar la firma.");
  await folioActivo(folio);
  const anterior = await firmaActual(folio, nFila);
  if (!anterior) throw errorHttp(404, `La fila ${nFila} del folio ${folio} no existe.`);
  if (!nombreFirma(anterior.firma)) throw errorHttp(400, "Esta fila no tiene una imagen de firma.");

  const { error: errorHistorial } = await supabase.from("bitacora_firmas_historial").insert({
    folio,
    n_fila: nFila,
    firma: anterior.firma,
    firma_hash: anterior.firma_hash || "",
    firma_en: anterior.firma_en,
    motivo: texto,
  });
  if (errorHistorial) falloBd(errorHistorial);

  const { error } = await supabase
    .from("bitacora_filas")
    .update({ firma: "", firma_hash: "", firma_datos: "", firma_en: null })
    .eq("folio", folio)
    .eq("n_fila", nFila);
  if (error) falloBd(error);
  await registrarLog(usuario, { accion: "quitar_firma", folio, n_fila: nFila, detalle: { motivo: texto, hash: anterior.firma_hash || "" } });
  return { fila: { n_fila: nFila, firma: "", firma_hash: "", firma_datos: "", firma_en: null, firma_estado: "sin_firma" }, historial_firmas: await leerHistorialFirmas(folio) };
}

async function quitarFila(clave, valorFolio, valorFila, usuario) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  const nFila = enteroPositivo(valorFila, "Fila");
  await folioActivo(folio);

  const anterior = await firmaActual(folio, nFila);
  const { data: historialFila, error: errorLeerHistorial } = await supabase
    .from("bitacora_firmas_historial")
    .select("firma")
    .eq("folio", folio)
    .eq("n_fila", nFila);
  if (errorLeerHistorial) falloBd(errorLeerHistorial);
  const { error } = await supabase.from("bitacora_filas").delete().eq("folio", folio).eq("n_fila", nFila);
  if (error) falloBd(error);
  const { error: errorHistorial } = await supabase.from("bitacora_firmas_historial").delete().eq("folio", folio).eq("n_fila", nFila);
  if (errorHistorial) falloBd(errorHistorial);
  await borrarFirmas([anterior?.firma, ...(historialFila || []).map((item) => item.firma)]);

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
    const { error: errorHistorial } = await supabase
      .from("bitacora_firmas_historial")
      .update({ n_fila: actual - 1 })
      .eq("folio", folio)
      .eq("n_fila", actual);
    if (errorHistorial) falloBd(errorHistorial);
  }
  await registrarLog(usuario, { accion: "quitar_fila", folio, n_fila: nFila });
  return leerFolio(folio);
}

async function eliminarFolio(clave, valorFolio, confirmacion, usuario) {
  exigirClave(clave);
  const folio = enteroPositivo(valorFolio, "Folio");
  if (String(confirmacion ?? "").trim() !== String(folio)) {
    throw errorHttp(400, "La confirmacion no coincide con el numero de folio.");
  }
  await folioActivo(folio);

  const filas = await leerFilas(folio);
  const historial = await leerHistorialFirmas(folio);
  const firmas = [...filas.map((fila) => fila.firma), ...historial.map((item) => item.firma)];
  const { error: errorHistorial } = await supabase.from("bitacora_firmas_historial").delete().eq("folio", folio);
  if (errorHistorial) falloBd(errorHistorial);
  const { error: errorFilas } = await supabase.from("bitacora_filas").delete().eq("folio", folio);
  if (errorFilas) falloBd(errorFilas);
  await borrarFirmas(firmas);
  const { error } = await supabase.from("bitacora_folios").update({ eliminado_en: new Date().toISOString() }).eq("folio", folio);
  if (error) falloBd(error);
  await registrarLog(usuario, { accion: "eliminar_folio", folio, detalle: { filas: filas.length } });
  return { folio, eliminado: true };
}

const FUENTE = "Aptos Narrow";
const BORDE = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const EMU_POR_PIXEL = 9525;

function ponerFirmaImagen(libro, hoja, buffer, indiceFila, anchoCelda, altoCelda) {
  const tipo = tipoImagen(buffer);
  if (!tipo) return;
  const medidas = tipo.medidas;
  const escala = Math.min(1, (anchoCelda - 4) / medidas.ancho, (altoCelda - 4) / medidas.alto);
  const ancho = Math.max(1, Math.round(medidas.ancho * escala));
  const alto = Math.max(1, Math.round(medidas.alto * escala));
  const id = libro.addImage({ buffer, extension: tipo.extension === "jpg" ? "jpeg" : "png" });
  hoja.addImage(id, {
    tl: {
      nativeCol: COLUMNAS.length - 1,
      nativeColOff: Math.round(((anchoCelda - ancho) / 2) * EMU_POR_PIXEL),
      nativeRow: indiceFila,
      nativeRowOff: Math.round(((altoCelda - alto) / 2) * EMU_POR_PIXEL),
    },
    ext: { width: ancho, height: alto },
  });
}

async function armarExcel(folio, filas, imagenes = new Map()) {
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
      const firmaImagen = columna.campo === "firma" && nombreFirma(valor);
      if (!firmaImagen) {
        celda.alignment = { horizontal: "center", vertical: "middle", wrapText: columna.campo === "observacion" };
      }
      if (columna.campo === "fecha") {
        valor = fechaLegible(valor);
        celda.alignment = { ...celda.alignment, shrinkToFit: true };
      }
      if (firmaImagen) {
        const buffer = imagenes.get(nombreFirma(valor));
        if (buffer) {
          const anchoCelda = Math.round(columna.ancho * 7 + 5);
          const altoCelda = Math.round((28.5 * 96) / 72);
          ponerFirmaImagen(libro, hoja, buffer, 4 + indice, anchoCelda, altoCelda);
        }
        valor = "";
      }
      if (valor !== "" && valor != null) celda.value = valor;
      celda.font = { name: FUENTE, size: 11 };
      celda.border = BORDE;
    });
  }
  return libro.xlsx.writeBuffer();
}

async function exportarFolio(valor, usuario) {
  const { folio, filas } = await leerFolio(valor);
  const imagenes = new Map();
  const nombres = [...new Set(filas.map((fila) => nombreFirma(fila.firma)).filter(Boolean))];
  await Promise.all(
    nombres.map(async (nombre) => {
      const buffer = await bajarImagen(nombre).catch(() => null);
      if (buffer) imagenes.set(nombre, buffer);
    })
  );
  const buffer = await armarExcel(folio, filas, imagenes);
  await registrarLog(usuario, { accion: "descargar_excel", folio });
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
  listarAuditoria,
  leerAuditoria,
  listarLog,
  registrarLog,
  guardarFila,
  subirFirma,
  quitarFirma,
  estadoFirma,
  resumenFirma,
  hashTexto,
  rutNormalizado,
  dimensionesPng,
  nombreFirma,
  quitarFila,
  eliminarFolio,
  armarExcel,
  exportarFolio,
};
