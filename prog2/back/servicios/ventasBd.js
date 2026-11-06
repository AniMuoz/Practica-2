const ExcelJS = require("exceljs");
const { supabase } = require("../supabase/supabase");
const { leerTodo, generarExcelLog, detalleTexto } = require("./logsAuditoria");
const { BODEGAS_EXPORT } = require("./nucleoDatos");
const { compactarPlanilla, filasConBodegas } = require("./planillasStock");
const { leerContratistas } = require("./contratistas");
const { itemsDesdeOrden, itemsDesdeTraspaso, itemsDesdeManual, enteroCelda, escribirEncabezadoVentas, resolverCodcomp } = require("./ventas");
const { ordenarDentroDeOrdenes } = require("./ordenFilasVentas");

const LIMITE_LOG = 25;
const CAMPOS_TEXTO = ["codigo", "contratista", "n_venta", "gd_esval", "estado", "fecha_gd", "gd_esval2", "observacion", "med", "ubicacion"];
const CAMPOS_NUMERO = ["solicitado", "entregar", "cant_gd"];
const CAMPOS_EDITABLES = [...CAMPOS_NUMERO, ...CAMPOS_TEXTO];
const LARGO_MAXIMO = 200;

function marcarCampo(campos, campo) {
  if (!campos.includes(campo)) campos.push(campo);
}

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function falloBd(error) {
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") {
    throw errorHttp(503, "En Supabase faltan las tablas de ventas. Ejecuta prog2/back/esquema.sql en el SQL Editor y vuelve a intentar.");
  }
  console.error(error);
  throw errorHttp(502, "Supabase no respondió.");
}

function mesActual(ahora = new Date()) {
  return { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 };
}

function validarMes(valorAnio, valorMes) {
  if (valorAnio == null && valorMes == null) return mesActual();
  const anio = Number(valorAnio);
  const mes = Number(valorMes);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2999 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw errorHttp(400, "El mes o el año no son válidos.");
  }
  return { anio, mes };
}

function enteroId(valor, nombre) {
  const texto = String(valor ?? "").trim();
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) < 1) throw errorHttp(400, `${nombre} inválido.`);
  return Number(texto);
}

function numero(valor) {
  const n = Number(String(valor ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function registrarLog(usuario, evento) {
  try {
    const registros = (Array.isArray(evento) ? evento : [evento]).map((e) => ({
      usuario: String(usuario || ""),
      accion: e.accion,
      planilla_id: e.planilla_id ?? null,
      fila_id: e.fila_id ?? null,
      campo: e.campo ?? null,
      valor_anterior: e.valor_anterior ?? null,
      valor_nuevo: e.valor_nuevo ?? null,
      detalle: e.detalle || {},
    }));
    if (registros.length === 0) return;
    const { error } = await supabase.from("ventas_log").insert(registros);
    if (error) console.error("No se pudo registrar el log de ventas:", error);
  } catch (error) {
    console.error("No se pudo registrar el log de ventas:", error);
  }
}

async function buscarPlanilla(anio, mes) {
  const { data, error } = await supabase.from("ventas_planillas").select("id, anio, mes, creado_en").eq("anio", anio).eq("mes", mes).maybeSingle();
  if (error) falloBd(error);
  return data || null;
}

async function planillaDelMes(anio, mes) {
  const existente = await buscarPlanilla(anio, mes);
  if (existente) return { planilla: existente, creada: false };
  const { data, error } = await supabase.from("ventas_planillas").insert({ anio, mes }).select("id, anio, mes, creado_en").single();
  if (error) {
    // Otra carga la creó al mismo tiempo (unique anio+mes).
    if (error.code === "23505") {
      const otra = await buscarPlanilla(anio, mes);
      if (otra) return { planilla: otra, creada: false };
    }
    falloBd(error);
  }
  return { planilla: data, creada: true };
}

function conCalculos(fila) {
  const entregar = numero(fila.entregar);
  const kgU = numero(fila.kg_u);
  return {
    ...fila,
    comp: entregar === numero(fila.solicitado) ? "VERDADERO" : "FALSO",
    kg_total: Math.round(kgU * entregar * 1000) / 1000,
    dif_pend: numero(fila.cant_gd) - numero(fila.solicitado),
  };
}

async function leerFilas(planillaId) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("ventas_filas")
      .select("*")
      .eq("planilla_id", planillaId)
      .order("lote", { ascending: true })
      .order("pos", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + 999);
    if (error) falloBd(error);
    filas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  // La numeración (Pos) es propia de cada orden: 10, 20, 30... aunque las filas guardadas traigan otra.
  const contador = new Map();
  return filas.map((fila) => {
    const clave = Number(fila.lote);
    const n = (contador.get(clave) || 0) + 1;
    contador.set(clave, n);
    return conCalculos({ ...fila, lote: clave, pos: n * 10 });
  });
}

async function obtenerPlanilla(valorAnio, valorMes) {
  const { anio, mes } = validarMes(valorAnio, valorMes);
  const planilla = await buscarPlanilla(anio, mes);
  if (!planilla) return { anio, mes, existe: false, id: null, filas: [] };
  return { anio, mes, existe: true, id: planilla.id, creado_en: planilla.creado_en, filas: await leerFilas(planilla.id) };
}

async function listarMeses() {
  const { data, error } = await supabase
    .from("ventas_planillas")
    .select("id, anio, mes, creado_en")
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });
  if (error) falloBd(error);
  return data || [];
}

function calcularFilas(items, { materiales, contratista, mov, almacenFila, codcomp, fecha, posInicial }) {
  const descripcionDe = (item) => String(materiales.get(String(item.codigo ?? ""))?.Descripcion || item.descripcion || "").trim();
  const ordenados = items
    .map((item) => ({ item, desc: descripcionDe(item) }))
    .sort((a, b) => a.desc.localeCompare(b.desc, "es", { sensitivity: "base" }))
    .map(({ item }) => item);

  let pos = posInicial;
  return ordenados.map((item) => {
    pos += 10;
    const cant = item.cantidad;
    const codMat = String(item.codigo ?? "");
    const material = materiales.get(codMat);
    const stock = (campo) => enteroCelda(material?.[campo]);
    const m501 = material ? stock("Stock") : 0;
    const m505 = material ? stock("M505") : 0;
    const cantidad = enteroCelda(cant);
    const concon = enteroCelda(item.concon);

    let entregar = 0;
    if (item.entregar != null && item.entregar !== "") {
      entregar = numero(item.entregar);
    } else if (material && cantidad <= m501) {
      entregar = numero(cant);
    }

    let ubicacion = material ? String(material["Ubicación"] ?? "") : "";
    let rojo = false;
    if (concon > 0 || (item.entregar == null && material && m505 > m501 && cantidad > m501)) {
      ubicacion = "CONCON";
      rojo = true;
    } else if (item.entregar == null && material && m505 === 0 && m501 === 0) {
      rojo = true;
    }

    const desc = descripcionDe(item);
    let tiras = null;
    if (/^ca[ñn]er[ií]a/i.test(desc)) {
      tiras = Math.round(numero(cant) / 6);
    } else if (/^\s*kgs?\.?\s*$/i.test(String(item.unidad ?? ""))) {
      const mg = desc.match(/(\d+(?:[.,]\d+)?)\s*GRS?\b/i);
      const mk = desc.match(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*KGS?\b|(\d+(?:[.,]\d+)?)\s*KGS?\b/i);
      let kilosUnidad = null;
      if (mg) kilosUnidad = Number(mg[1].replace(",", ".")) / 1000;
      else if (mk) kilosUnidad = mk[2] ? Number(mk[1] || 0) + Number(mk[2]) / Number(mk[3]) : Number(mk[4].replace(",", "."));
      if (kilosUnidad != null) {
        const total = kilosUnidad * numero(cant);
        if (Number.isFinite(total)) tiras = Math.round(total * 1000) / 1000;
      }
    }

    const precio = enteroCelda(material?.Precio);
    return {
      pos,
      fecha,
      codigo: codMat,
      descripcion: material?.Descripcion || item.descripcion || "",
      ubicacion,
      m501,
      m502: material ? stock("M502") : 0,
      m503: material ? stock("M503") : 0,
      m504: material ? stock("M504") : 0,
      m505,
      solicitado: numero(cant),
      entregar,
      med: String(item.unidad ?? ""),
      tiras,
      dif: m501 - cantidad,
      kg_u: numero(material?.Peso),
      precio_u: precio,
      precio_total: cantidad * precio,
      contratista,
      movimiento: mov,
      almacen: concon > 0 ? "CONCON" : almacenFila,
      n_venta: String(codcomp),
      cant_gd: concon > 0 ? concon : entregar,
      observacion: concon > 0 ? `CONCON ${concon}` : "",
      rojo,
    };
  });
}

async function anadirVenta({ ordenBuffer, hoja = "", contratistaIdx, movTipo, almacen, codVenta, itemsManuales = null, usuario = "" }) {
  let items;
  let numeroTraspaso = "";
  if (itemsManuales) {
    items = itemsDesdeManual(itemsManuales);
  } else if (!ordenBuffer) {
    throw errorHttp(400, "Falta el archivo o la lista de productos.");
  } else if (Number(movTipo) === 2) {
    const traspaso = itemsDesdeTraspaso(ordenBuffer, hoja);
    items = traspaso.items;
    numeroTraspaso = traspaso.numero;
  } else {
    items = itemsDesdeOrden(ordenBuffer, hoja);
  }
  if (items.length === 0) throw errorHttp(400, "No se encontraron productos para cargar.");

  const materiales = new Map();
  filasConBodegas().forEach((fila) => materiales.set(String(fila.Codigo ?? "").trim(), fila));
  const contratistas = leerContratistas().filas.map((fila) => String(fila.nombre ?? ""));
  const contratista = contratistaIdx >= 1 && contratistaIdx <= contratistas.length ? contratistas[contratistaIdx - 1] : "n/a";
  const mov = Number(movTipo) === 2 ? "TRASPASO" : "VENTA";
  const almacenFila = mov === "VENTA" ? "M501" : (new Set(BODEGAS_EXPORT).has(String(almacen || "").trim()) ? String(almacen).trim() : "M501");
  const codcomp = resolverCodcomp(mov, codVenta, numeroTraspaso);

  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const { anio, mes } = mesActual(hoy);
  const { planilla, creada } = await planillaDelMes(anio, mes);
  if (creada) await registrarLog(usuario, { accion: "crear_planilla", planilla_id: planilla.id, detalle: { anio, mes } });

  // La numeración (Pos) se reinicia en cada orden: 10, 20, 30...
  const posInicial = 0;

  const lote = Date.now();
  const filas = calcularFilas(items, { materiales, contratista, mov, almacenFila, codcomp, fecha, posInicial })
    .map((fila) => ({ ...fila, planilla_id: planilla.id, lote }));
  const { error } = await supabase.from("ventas_filas").insert(filas);
  if (error) falloBd(error);

  await registrarLog(usuario, {
    accion: "anadir_venta",
    planilla_id: planilla.id,
    detalle: { lote, filas: filas.length, movimiento: mov, contratista, n_venta: String(codcomp), almacen: almacenFila },
  });
  return { anio, mes, planilla_id: planilla.id, agregadas: filas.length };
}

async function filaPorId(id) {
  const { data, error } = await supabase.from("ventas_filas").select("*").eq("id", id).maybeSingle();
  if (error) falloBd(error);
  if (!data) throw errorHttp(404, "La fila no existe.");
  return data;
}

async function editarFila(valorId, cambios, usuario) {
  const id = enteroId(valorId, "Fila");
  if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) throw errorHttp(400, "No hay datos para guardar.");
  const campos = Object.keys(cambios).filter((campo) => CAMPOS_EDITABLES.includes(campo));
  if (campos.length === 0) throw errorHttp(400, "No hay campos editables en la solicitud.");
  const anterior = await filaPorId(id);
  const nuevos = {};
  campos.forEach((campo) => {
    if (CAMPOS_NUMERO.includes(campo)) {
      const texto = String(cambios[campo] ?? "").trim().replace(",", ".");
      if (texto !== "" && !Number.isFinite(Number(texto))) throw errorHttp(400, `El valor de ${campo} no es un número.`);
      nuevos[campo] = texto === "" ? 0 : Number(texto);
    } else {
      nuevos[campo] = String(cambios[campo] ?? "").trim().slice(0, LARGO_MAXIMO);
    }
  });
  if (campos.includes("codigo") && String(anterior.codigo ?? "") !== nuevos.codigo) {
    const material = filasConBodegas().find((m) => String(m.Codigo ?? "").trim() === nuevos.codigo);
    if (!nuevos.codigo || !material) {
      const error = errorHttp(422, `El codigo ${nuevos.codigo} no existe, se revirtio ese cambio`);
      error.codigoInvalido = true;
      throw error;
    }
    const entregarFila = "entregar" in nuevos ? nuevos.entregar : numero(anterior.entregar);
    const solicitadoFila = "solicitado" in nuevos ? nuevos.solicitado : numero(anterior.solicitado);
    const medFila = "med" in nuevos ? nuevos.med : String(anterior.med ?? "");
    const [calculada] = calcularFilas(
      [{ codigo: nuevos.codigo, cantidad: solicitadoFila, unidad: medFila, entregar: entregarFila }],
      { materiales: new Map([[nuevos.codigo, material]]), contratista: anterior.contratista, mov: anterior.movimiento, almacenFila: anterior.almacen, codcomp: anterior.n_venta, fecha: anterior.fecha, posInicial: 0 },
    );
    const derivados = ["descripcion", "ubicacion", "m501", "m502", "m503", "m504", "m505", "tiras", "dif", "kg_u", "precio_u", "precio_total", "rojo"];
    derivados.forEach((campo) => {
      // Una ubicación cambiada a mano en la misma edición se conserva.
      if (campo === "ubicacion" && campos.includes("ubicacion")) return;
      nuevos[campo] = calculada[campo];
      if (!campos.includes(campo)) campos.push(campo);
    });
  }
  if (campos.includes("ubicacion")) {
    const eraConcon = String(anterior.ubicacion ?? "").trim().toUpperCase() === "CONCON";
    if (nuevos.ubicacion.toUpperCase() === "CONCON") {
      // Formato CONCON automático (igual que al generar la venta).
      const entregar = "entregar" in nuevos ? nuevos.entregar : numero(anterior.entregar);
      const solicitado = "solicitado" in nuevos ? nuevos.solicitado : numero(anterior.solicitado);
      const concon = solicitado - entregar > 0 ? solicitado - entregar : solicitado;
      nuevos.ubicacion = "CONCON";
      nuevos.rojo = true;
      nuevos.almacen = "CONCON";
      nuevos.cant_gd = concon;
      nuevos.observacion = `CONCON ${concon}`;
      ["rojo", "almacen", "cant_gd", "observacion"].forEach((c) => marcarCampo(campos, c));
    } else if (eraConcon) {
      const entregar = "entregar" in nuevos ? nuevos.entregar : numero(anterior.entregar);
      nuevos.rojo = false;
      nuevos.cant_gd = entregar;
      // El almacén previo a CONCON no se guarda; mismo default que anadirVenta.
      nuevos.almacen = "M501";
      ["rojo", "cant_gd", "almacen"].forEach((c) => marcarCampo(campos, c));
      if (/^CONCON\b/i.test(String(anterior.observacion ?? "").trim())) {
        nuevos.observacion = "";
        marcarCampo(campos, "observacion");
      }
    }
  }
  const cambiados = campos.filter((campo) => String(anterior[campo] ?? "") !== String(nuevos[campo]));
  if (cambiados.length === 0) return { fila: conCalculos(anterior) };
  const { error } = await supabase.from("ventas_filas").update(nuevos).eq("id", id);
  if (error) falloBd(error);
  await registrarLog(usuario, cambiados.map((campo) => ({
    accion: "editar_celda",
    planilla_id: anterior.planilla_id,
    fila_id: id,
    campo,
    valor_anterior: String(anterior[campo] ?? ""),
    valor_nuevo: String(nuevos[campo]),
    detalle: { pos: anterior.pos, codigo: anterior.codigo },
  })));
  return { fila: conCalculos({ ...anterior, ...nuevos }) };
}

async function anadirFilaVacia(valorPlanilla, valorLote, usuario) {
  const planillaId = enteroId(valorPlanilla, "Planilla");
  const lote = enteroId(valorLote, "Orden");
  const { data, error } = await supabase.from("ventas_filas").select("*").eq("planilla_id", planillaId).eq("lote", lote);
  if (error) falloBd(error);
  if (!data || data.length === 0) throw errorHttp(404, "La orden no existe.");
  const base = data[0];
  const fila = {
    planilla_id: planillaId, lote, pos: (data.length + 1) * 10, fecha: base.fecha,
    codigo: "", descripcion: "", ubicacion: "", m501: 0, m502: 0, m503: 0, m504: 0, m505: 0,
    solicitado: 0, entregar: 0, med: "", tiras: null, dif: 0, kg_u: 0, precio_u: 0, precio_total: 0,
    contratista: base.contratista, movimiento: base.movimiento, almacen: base.almacen, n_venta: base.n_venta,
    cant_gd: 0, observacion: "", rojo: false,
  };
  const { data: creada, error: errorInsertar } = await supabase.from("ventas_filas").insert(fila).select("id").single();
  if (errorInsertar) falloBd(errorInsertar);
  await registrarLog(usuario, { accion: "anadir_venta", planilla_id: planillaId, fila_id: creada?.id ?? null, detalle: { lote, filas: 1, fila_extra: true } });
  return { planilla_id: planillaId, lote, agregada: true };
}

async function quitarFila(valorId, usuario) {
  const id = enteroId(valorId, "Fila");
  const anterior = await filaPorId(id);
  const { error } = await supabase.from("ventas_filas").delete().eq("id", id);
  if (error) falloBd(error);
  await registrarLog(usuario, {
    accion: "quitar_fila",
    planilla_id: anterior.planilla_id,
    fila_id: id,
    detalle: { pos: anterior.pos, codigo: anterior.codigo, descripcion: anterior.descripcion, solicitado: anterior.solicitado, movimiento: anterior.movimiento },
  });
  return { id, eliminada: true };
}

async function quitarOrden(valorPlanilla, valorLote, usuario) {
  const planillaId = enteroId(valorPlanilla, "Planilla");
  const lote = enteroId(valorLote, "Orden");
  const { data, error } = await supabase.from("ventas_filas").select("*").eq("planilla_id", planillaId).eq("lote", lote);
  if (error) falloBd(error);
  if (!data || data.length === 0) throw errorHttp(404, "La orden no existe.");
  const { error: errorBorrar } = await supabase.from("ventas_filas").delete().eq("planilla_id", planillaId).eq("lote", lote);
  if (errorBorrar) falloBd(errorBorrar);
  const primera = data[0];
  await registrarLog(usuario, {
    accion: "quitar_orden",
    planilla_id: planillaId,
    detalle: {
      lote,
      filas: data.length,
      movimiento: primera.movimiento,
      n_venta: primera.n_venta,
      contratista: primera.contratista,
      codigos: data.map((f) => f.codigo),
    },
  });
  return { planilla_id: planillaId, lote, eliminadas: data.length };
}

function nombreDescarga(ahora = new Date()) {
  const dia = String(ahora.getDate()).padStart(2, "0");
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  return `VENTAS Y TRASPASOS ${dia}-${mes}-${ahora.getFullYear()}.xlsx`;
}

async function armarExcel(filas, colores = true) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Ventas");
  const COLUMNAS_TOTAL = 36;
  escribirEncabezadoVentas(hoja, 1, colores);
  const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  const estilo = (celda, color) => {
    celda.border = borde;
    celda.font = colores && color ? { bold: true, color: { argb: color } } : { bold: true };
  };

  // Cada carga (lote) es una orden: sus filas, una fila de total y de nuevo los encabezados.
  const lotes = [];
  filas.forEach((fila) => {
    const ultimo = lotes[lotes.length - 1];
    if (ultimo && ultimo.lote === fila.lote && ultimo.planilla_id === fila.planilla_id) ultimo.filas.push(fila);
    else lotes.push({ lote: fila.lote, planilla_id: fila.planilla_id, filas: [fila] });
  });

  let n = 2;
  lotes.forEach((grupo) => {
    const primera = n;
    grupo.filas.forEach((fila) => {
      const rojo = fila.rojo ? "FFFF0000" : null;
      const valores = [
        fila.pos, fila.codigo, fila.descripcion, fila.ubicacion,
        fila.m501, fila.m502, fila.m503, fila.m504, fila.m505,
        fila.solicitado, fila.entregar, fila.med, fila.tiras ?? null, fila.dif, fila.comp,
        fila.kg_u, { formula: `P${n}*K${n}` }, fila.precio_u, fila.precio_total,
        fila.contratista, fila.movimiento, fila.almacen, fila.n_venta,
        fila.cant_gd, fila.gd_esval, fila.estado, fila.fecha,
        { formula: `X${n}-J${n}` }, fila.gd_esval2, fila.fecha_gd, fila.observacion,
        fila.pos, null, null, { formula: `AG${n}=B${n}` }, { formula: `AH${n}=X${n}` },
      ];
      for (let columna = 0; columna < COLUMNAS_TOTAL; columna += 1) {
        const celda = hoja.getCell(n, columna + 1);
        const valor = valores[columna];
        if (valor !== null && valor !== undefined && valor !== "") celda.value = valor;
        estilo(celda, rojo);
      }
      estilo(hoja.getCell(n, 5), numero(fila.m501) === 0 ? "FFFF0000" : (rojo || "FF7CC8FF"));
      n += 1;
    });
    for (let columna = 1; columna <= COLUMNAS_TOTAL; columna += 1) estilo(hoja.getCell(n, columna));
    hoja.getCell(n, 16).value = "total";
    hoja.getCell(n, 17).value = { formula: `SUM(Q${primera}:Q${n - 1})` };
    hoja.getCell(n, 18).value = "Total";
    hoja.getCell(n, 19).value = { formula: `SUM(S${primera}:S${n - 1})` };
    n += 1;
    escribirEncabezadoVentas(hoja, n, colores);
    for (let columna = 1; columna <= COLUMNAS_TOTAL; columna += 1) estilo(hoja.getCell(n, columna));
    n += 1;
  });

  hoja.autoFilter = "A1:AJ1";
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}
// Planilla reducida para reservar material: solo las columnas necesarias, con la sub-ubicación del maestro.
async function armarExcelReservar(filas, colores = true) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Ventas");
  const titulos = ["Pos", "Código", "Descripción", "Ubicación", "Sub-ubicación", "M501", "Solicitado", "Entregar", "Med", "Tiras"];
  const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  const subPorCodigo = new Map();
  filasConBodegas().forEach((m) => subPorCodigo.set(String(m.Codigo ?? "").trim(), String(m["Sub-ubicación"] ?? "")));
  const encabezado = (n) => {
    titulos.forEach((titulo, i) => {
      const celda = hoja.getCell(n, i + 1);
      celda.value = titulo;
      celda.font = { bold: true };
      celda.border = borde;
      if (colores) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    });
  };
  encabezado(1);
  let n = 2;
  let anterior = null;
  filas.forEach((fila) => {
    const clave = `${fila.planilla_id}-${fila.lote}`;
    if (anterior !== null && anterior !== clave) {
      encabezado(n);
      n += 1;
    }
    anterior = clave;
    const valores = [
      fila.pos, fila.codigo, fila.descripcion, fila.ubicacion, subPorCodigo.get(String(fila.codigo ?? "").trim()) || "",
      fila.m501, fila.solicitado, fila.entregar, fila.med, fila.tiras ?? null,
    ];
    valores.forEach((valor, i) => {
      const celda = hoja.getCell(n, i + 1);
      if (valor !== null && valor !== undefined && valor !== "") celda.value = valor;
      celda.border = borde;
      celda.font = colores && fila.rojo ? { bold: true, color: { argb: "FFFF0000" } } : { bold: true };
    });
    n += 1;
  });
  hoja.autoFilter = "A1:J1";
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

const armadorPlanilla = (tipo) => (tipo === "reservar" ? armarExcelReservar : armarExcel);

async function exportarPlanilla(valorAnio, valorMes, usuario, colores = true, tipo = "completa", orden = "", lote = null) {
  const { anio, mes } = validarMes(valorAnio, valorMes);
  const planilla = await buscarPlanilla(anio, mes);
  if (!planilla) throw errorHttp(404, "No hay planilla de ventas para ese mes.");
  let todas = await leerFilas(planilla.id);
  if (lote !== null && lote !== undefined && lote !== "") {
    todas = todas.filter((f) => Number(f.lote) === Number(lote));
    if (todas.length === 0) throw errorHttp(404, "No existe esa orden en la planilla.");
  }
  const filas = ordenarDentroDeOrdenes(todas, orden);
  const reservar = tipo === "reservar";
  const buffer = await armadorPlanilla(tipo)(filas, colores);
  await registrarLog(usuario, { accion: "descargar_excel", planilla_id: planilla.id, detalle: { anio, mes, filas: filas.length, tipo } });
  return { buffer, nombre: reservar ? nombreDescarga().replace("VENTAS Y TRASPASOS ", "VENTAS Y TRASPASOS RESERVAR ") : nombreDescarga() };
}

function nombreDescargaAnual(anio, ahora = new Date()) {
  return nombreDescarga(ahora).replace("VENTAS Y TRASPASOS ", `VENTAS Y TRASPASOS ANUAL ${anio} `);
}

// Une las planillas existentes del año (enero a diciembre) en una sola, sin separar los meses.
async function exportarAnual(valorAnio, usuario, colores = true, tipo = "completa", orden = "") {
  const { anio } = validarMes(valorAnio, 1);
  const { data, error } = await supabase
    .from("ventas_planillas")
    .select("id, anio, mes, creado_en")
    .eq("anio", anio)
    .order("mes", { ascending: true });
  if (error) falloBd(error);
  if (!data || data.length === 0) throw errorHttp(404, `No hay planillas de ventas en ${anio}.`);
  const filas = [];
  for (const planilla of data) filas.push(...(await leerFilas(planilla.id)));
  const reservar = tipo === "reservar";
  const buffer = await armadorPlanilla(tipo)(ordenarDentroDeOrdenes(filas, orden), colores);
  await registrarLog(usuario, { accion: "descargar_excel", detalle: { anio, anual: true, planillas: data.length, filas: filas.length, tipo } });
  return { buffer, nombre: reservar ? nombreDescargaAnual(anio).replace("VENTAS Y TRASPASOS ", "VENTAS Y TRASPASOS RESERVAR ") : nombreDescargaAnual(anio) };
}

function consultaLog(filtros, opciones) {
  let q = supabase
    .from("ventas_log")
    .select("id, creado_en, usuario, accion, planilla_id, fila_id, campo, valor_anterior, valor_nuevo, detalle", opciones);
  if (filtros.planilla) q = q.eq("planilla_id", enteroId(filtros.planilla, "Planilla"));
  if (filtros.usuario) q = q.eq("usuario", String(filtros.usuario));
  if (filtros.accion) q = q.eq("accion", String(filtros.accion));
  if (filtros.desde && typeof q.gte === "function") q = q.gte("creado_en", `${filtros.desde}T00:00:00`);
  if (filtros.hasta && typeof q.lte === "function") q = q.lte("creado_en", `${filtros.hasta}T23:59:59.999`);
  return q;
}

const ETIQUETAS_LOG = {
  crear_planilla: "Abrió la planilla del mes",
  anadir_venta: "Añadió productos",
  editar_celda: "Editó una celda",
  quitar_fila: "Quitó una fila",
  quitar_orden: "Quitó una orden completa",
  descargar_excel: "Descargó la planilla",
};

// Excel con todo el log que cumple los filtros (sin paginar).
async function exportarLog(filtros = {}) {
  const filas = await leerTodo(() => consultaLog(filtros).order("creado_en", { ascending: false }).order("id", { ascending: false }), falloBd);
  const buffer = await generarExcelLog("Log de ventas", [
    { titulo: "Fecha y hora", clave: "creado_en", ancho: 22 },
    { titulo: "Usuario", clave: "usuario" },
    { titulo: "Acción", clave: "accion", ancho: 24, formato: (v) => ETIQUETAS_LOG[v] || v },
    { titulo: "Planilla", clave: "planilla_id", ancho: 10 },
    { titulo: "Fila", clave: "fila_id", ancho: 10 },
    { titulo: "Campo", clave: "campo" },
    { titulo: "Valor anterior", clave: "valor_anterior", ancho: 28 },
    { titulo: "Valor nuevo", clave: "valor_nuevo", ancho: 28 },
    { titulo: "Detalle", clave: "detalle", ancho: 40, formato: detalleTexto },
  ], filas);
  return { buffer, nombre: "LOG VENTAS" };
}

async function listarLog(filtros = {}) {
  const pagina = Math.max(1, Number.parseInt(filtros.pagina, 10) || 1);
  const q = consultaLog(filtros, { count: "exact" });
  const desde = (pagina - 1) * LIMITE_LOG;
  const { data, count, error } = await q.order("creado_en", { ascending: false }).range(desde, desde + LIMITE_LOG - 1);
  if (error) falloBd(error);
  return { eventos: data || [], total: count || 0, pagina, por_pagina: LIMITE_LOG };
}

async function leerAuditoria(valorId) {
  const id = enteroId(valorId, "Planilla");
  const { data, error } = await supabase.from("ventas_planillas").select("id, anio, mes, creado_en").eq("id", id).maybeSingle();
  if (error) falloBd(error);
  if (!data) throw errorHttp(404, "La planilla no existe.");
  const [filas, log] = await Promise.all([leerFilas(id), listarLog({ planilla: id })]);
  return { ...data, filas, log: log.eventos };
}

module.exports = {
  mesActual,
  validarMes,
  nombreDescarga,
  calcularFilas,
  obtenerPlanilla,
  listarMeses,
  anadirVenta,
  editarFila,
  anadirFilaVacia,
  quitarFila,
  quitarOrden,
  armarExcel,
  exportarPlanilla,
  exportarAnual,
  nombreDescargaAnual,
  registrarLog,
  listarLog,
  exportarLog,
  listarPlanillasAuditoria: listarMeses,
  leerAuditoria,
};
