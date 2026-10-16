const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { ejecutar } = require("./supabaseTablas");
const { supabase } = require("./supabase");
const { quitarImagen } = require("./imagenesSupabase");

const CAMPOS_MATERIAL = [
  ["Codigo", "codigo"],
  ["Descripcion", "descripcion"],
  ["Ubicación", "ubicacion"],
  ["Sub-ubicación", "sub_ubicacion"],
  ["Stock", "stock"],
  ["Peso", "peso"],
  ["Precio", "precio"],
  ["Caracteristica", "caracteristica"],
  ["Stock critico", "stock_critico"],
  ["Rombo", "rombo"],
  ["QR", "qr"],
  ["Foto", "foto"],
  ["Inventario", "inventario"],
  ["Comentario", "comentario"],
  ["Marcado", "marcado"],
  ["M502", "m502"],
  ["M503", "m503"],
  ["M504", "m504"],
  ["M505", "m505"],
];

const CAMPOS_RESERVA = [
  ["Orden", "orden"],
  ["Nº reserva", "n_reserva"],
  ["Nº pos.reserva traslado", "n_pos_reserva_traslado"],
  ["Clase de registro", "clase_de_registro"],
  ["Fecha de necesidad", "fecha_de_necesidad"],
  ["Clase de movimiento", "clase_de_movimiento"],
  ["Indicador debe/haber", "indicador_debe_haber"],
  ["Material", "material"],
  ["Cantidad necesaria", "cantidad_necesaria"],
  ["Cantid.reducidas", "cantid_reducidas"],
  ["Cantidad diferencia", "cantidad_diferencia"],
  ["Un.medida de entrada", "un_medida_de_entrada"],
  ["Texto breve de material", "texto_breve_de_material"],
  ["Almacén", "almacen"],
  ["Centro", "centro"],
  ["Unidad medida base", "unidad_medida_base"],
  ["Imputación reserva", "imputacion_reserva"],
  ["Clase de necesidad", "clase_de_necesidad"],
  ["Ctd.en UM entrada", "ctd_en_um_entrada"],
  ["Ctd.piezas en BR", "ctd_piezas_en_br"],
  ["Ctd.verif.dispon", "ctd_verif_dispon"],
  ["Movim.permitido", "movim_permitido"],
  ["Nombre del usuario", "nombre_del_usuario"],
  ["Operación", "operacion"],
  ["Posición borrada", "posicion_borrada"],
  ["Salida final", "salida_final"],
  ["Texto de clase-mov", "texto_de_clase_mov"],
];

function claveColumna(nombre) {
  return String(nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function indiceCampo(encabezados, titulo) {
  const buscado = claveColumna(titulo);
  return encabezados.findIndex((nombre) => claveColumna(nombre) === buscado);
}

// Ubica columnas por encabezado. `requeridas` = { campo: [alternativas en orden de preferencia] }.
// Cada alternativa se prueba primero como título exacto y luego como texto contenido en el título.
// Busca la fila de encabezados entre las primeras 10 filas.
function ubicarColumnas(matriz, requeridas) {
  const campos = Object.keys(requeridas);
  let mejor = { faltan: campos, indices: {} };
  for (let fila = 0; fila < Math.min(matriz.length, 10); fila += 1) {
    const claves = (matriz[fila] || []).map(claveColumna);
    const indices = {};
    const faltan = [];
    for (const campo of campos) {
      let indice = -1;
      for (const alternativa of requeridas[campo]) {
        const buscada = claveColumna(alternativa);
        indice = claves.findIndex((clave) => clave === buscada);
        if (indice < 0) indice = claves.findIndex((clave) => clave && clave.includes(buscada));
        if (indice >= 0) break;
      }
      if (indice < 0) faltan.push(campo);
      else indices[campo] = indice;
    }
    if (!faltan.length) return { fila, indices };
    if (faltan.length < mejor.faltan.length) mejor = { faltan, indices };
  }
  const error = new Error(`El archivo no tiene los encabezados esperados (faltan: ${mejor.faltan.join(", ")}).`);
  error.status = 400;
  throw error;
}

function registrosMaterial(matriz) {
  const encabezados = (matriz[0] || []).map((nombre) => String(nombre));
  const vistos = new Map();
  matriz.slice(1).forEach((fila) => {
    const registro = {};
    CAMPOS_MATERIAL.forEach(([titulo, campo]) => {
      const indice = indiceCampo(encabezados, titulo);
      registro[campo] = indice < 0 ? "" : String(fila[indice] ?? "");
    });
    registro.codigo = registro.codigo.trim();
    if (registro.codigo) vistos.set(registro.codigo, registro);
  });
  return [...vistos.values()];
}

function matrizMaterial(filas) {
  return [
    CAMPOS_MATERIAL.map(([titulo]) => titulo),
    ...filas.map((fila) => CAMPOS_MATERIAL.map(([, campo]) => fila[campo] ?? "")),
  ];
}

function registrosReserva(matriz) {
  const encabezados = (matriz[0] || []).map((nombre) => String(nombre));
  return matriz.slice(1).map((fila) => {
    const registro = {};
    CAMPOS_RESERVA.forEach(([titulo, campo]) => {
      const indice = indiceCampo(encabezados, titulo);
      const valor = indice < 0 ? "" : fila[indice] ?? "";
      registro[campo] = String(valor ?? "");
    });
    return registro;
  });
}

function matrizReserva(filas) {
  return [
    CAMPOS_RESERVA.map(([titulo]) => titulo),
    ...filas.map((fila) => CAMPOS_RESERVA.map(([, campo]) => fila[campo] ?? "")),
  ];
}

function matrizGuardada(nombre) {
  const planillas = ejecutar("leer", { tabla: "planillas" });
  const guardada = (planillas || []).find((fila) => fila.nombre === nombre);
  return Array.isArray(guardada?.matriz) ? guardada.matriz : null;
}

const ENCABEZADO_MATERIALES = [
  "Codigo", "Descripcion", "Ubicación", "Sub-ubicación", "Stock", "Peso", "Precio",
  "Caracteristica", "Stock critico", "Rombo", "QR", "Foto", "Inventario", "Comentario",
  "Marcado", "M502", "M503", "M504", "M505",
];

const BODEGAS_EXTRA = ["M502", "M503", "M504", "M505"];
const BODEGAS_EXPORT = ["M501", ...BODEGAS_EXTRA];
const COLUMNA_MARCADO = "Marcado";
const COLUMNAS_OCULTAS = new Set([...BODEGAS_EXTRA, COLUMNA_MARCADO]);
const COLUMNAS_EXTRA = ["Rombo", "QR", "Foto", ...BODEGAS_EXTRA];
const CAMPOS_IMAGEN = new Set(["Rombo", "QR", "Foto"]);
const COLUMNA_STOCK_CRITICO = "Stock critico";
const ARCHIVO_MARCADOS = path.join(__dirname, "marcados.json");

function conStockCritico(matriz) {
  if (matriz.length === 0) return matriz;
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  if (columnas.includes(COLUMNA_STOCK_CRITICO)) return matriz;
  const indiceRombo = columnas.indexOf("Rombo");
  const indice = indiceRombo >= 0 ? indiceRombo : columnas.length;
  return matriz.map((fila, numero) => {
    const copia = [...(fila || [])];
    while (copia.length < columnas.length) copia.push("");
    copia.splice(indice, 0, numero === 0 ? COLUMNA_STOCK_CRITICO : "");
    return copia;
  });
}

function leerCodigosMarcados() {
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVO_MARCADOS, "utf8"));
    return new Set((Array.isArray(data) ? data : []).map((codigo) => String(codigo)));
  } catch {
    return new Set();
  }
}

function conMarcado(matriz) {
  if (matriz.length === 0) return { matriz, agregada: false };
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  if (columnas.includes(COLUMNA_MARCADO)) return { matriz, agregada: false };
  const indiceCodigo = columnas.indexOf("Codigo");
  const marcados = leerCodigosMarcados();
  const conColumna = matriz.map((fila, numero) => {
    const copia = [...(fila || [])];
    while (copia.length < columnas.length) copia.push("");
    const codigo = indiceCodigo >= 0 ? String(copia[indiceCodigo] ?? "") : "";
    copia.push(numero === 0 ? COLUMNA_MARCADO : marcados.has(codigo) ? "1" : "");
    return copia;
  });
  return { matriz: conColumna, agregada: true };
}

function leerMatriz(libro) {
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = conMarcado(
    conStockCritico(XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, defval: "" }))
  );
  return { nombreHoja, matriz };
}

function sinFilasVacias(matriz) {
  if (matriz.length === 0) return matriz;
  const encabezado = matriz[0];
  const filas = matriz.slice(1).filter((fila) =>
    (fila || []).some((celda) => String(celda ?? "").trim() !== "")
  );
  return [encabezado, ...filas];
}

function mapaPorCodigo(matriz, indiceCodigo) {
  const mapa = new Map();
  if (indiceCodigo < 0) return mapa;
  for (let indice = 1; indice < matriz.length; indice += 1) {
    const codigo = String((matriz[indice] || [])[indiceCodigo] ?? "");
    if (!mapa.has(codigo)) mapa.set(codigo, indice);
  }
  return mapa;
}

function indicePorCodigo(mapa, codigo) {
  return mapa.has(codigo) ? mapa.get(codigo) : -1;
}

function tablaDesdeMatriz(matriz) {
  if (matriz.length === 0) return { columnas: [], filas: [] };
  const columnas = matriz[0].map((nombre, indice) => String(nombre || `Columna ${indice + 1}`));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  const visibles = columnas.filter((columna) => !COLUMNAS_OCULTAS.has(columna));
  const indiceMarcado = columnas.indexOf(COLUMNA_MARCADO);
  const filas = sinFilasVacias(matriz).slice(1).map((fila) => {
    const registro = {};
    visibles.forEach((columna) => {
      registro[columna] = fila[columnas.indexOf(columna)] ?? "";
    });
    registro.Marcado = indiceMarcado >= 0 ? fila[indiceMarcado] ?? "" : "";
    return registro;
  });
  return { columnas: visibles, filas };
}

function filasBodegaDesdeMatriz(matriz) {
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  return sinFilasVacias(matriz).slice(1).map((fila) => {
    const registro = {};
    columnas.forEach((columna, indice) => {
      registro[columna] = fila[indice] ?? "";
    });
    return registro;
  });
}

let cacheMateriales = null;

function recordarMateriales(matriz, nombreHoja) {
  const limpia = sinFilasVacias(matriz);
  const columnas = (limpia[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const tabla = tablaDesdeMatriz(limpia);
  const filasBodega = filasBodegaDesdeMatriz(limpia);
  const porFila = new Map();
  tabla.filas.forEach((fila) => {
    const codigo = String(fila.Codigo ?? "");
    if (!porFila.has(codigo)) porFila.set(codigo, fila);
  });
  const porFilaBodega = new Map();
  filasBodega.forEach((fila) => {
    const codigo = String(fila.Codigo ?? "");
    if (!porFilaBodega.has(codigo)) porFilaBodega.set(codigo, fila);
  });
  cacheMateriales = {
    firma: "supabase",
    nombreHoja,
    matriz: limpia,
    porCodigo: mapaPorCodigo(limpia, indiceCodigo),
    tabla,
    porFila,
    filasBodega,
    porFilaBodega,
  };
  return cacheMateriales;
}

function cargarMateriales() {
  if (cacheMateriales) return cacheMateriales;
  let filas = ejecutar("leer", { tabla: "materiales" }) || [];
  if (filas.length === 0) {
    const previa = matrizGuardada("materiales");
    const registros = previa ? registrosMaterial(previa) : [];
    if (registros.length > 0) {
      ejecutar("reemplazar", { tabla: "materiales", columna: "codigo", filas: registros });
      filas = registros;
    }
  }
  const matriz = filas.length > 0 ? matrizMaterial(filas) : [ENCABEZADO_MATERIALES.slice()];
  const { matriz: completa } = conMarcado(conStockCritico(matriz));
  return recordarMateriales(completa, "Hoja1");
}

function editarMateriales() {
  const actual = cargarMateriales();
  return {
    matriz: actual.matriz.map((fila) => (Array.isArray(fila) ? fila.slice() : [])),
    porCodigo: new Map(actual.porCodigo),
  };
}

function falloSupabase(error) {
  const fallo = new Error(error.message || "Supabase no respondió.");
  fallo.status = 502;
  throw fallo;
}

async function persistirRegistro(registro) {
  const { error } = await supabase.from("materiales").upsert(registro);
  if (error) falloSupabase(error);
}

async function quitarRegistro(codigo) {
  const { error } = await supabase.from("materiales").delete().eq("codigo", String(codigo));
  if (error) falloSupabase(error);
}

function guardarMateriales(matriz) {
  const nombreHoja = cacheMateriales?.nombreHoja || "Hoja1";
  const limpia = sinFilasVacias(matriz);
  ejecutar("reemplazar", { tabla: "materiales", columna: "codigo", filas: registrosMaterial(limpia) });
  return recordarMateriales(limpia, nombreHoja);
}

async function guardarFila(matriz, indiceFila) {
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const registro = registrosMaterial([columnas, matriz[indiceFila]])[0];
  if (registro) await persistirRegistro(registro);
  return recordarMateriales(matriz, cacheMateriales?.nombreHoja || "Hoja1");
}

function leerTabla() {
  return cargarMateriales().tabla;
}

async function marcarMaterial(codigo, marcado) {
  const { matriz, porCodigo } = editarMateriales();
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceMarcado = columnas.indexOf(COLUMNA_MARCADO);
  if (indiceCodigo < 0 || indiceMarcado < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }
  const indiceFila = indicePorCodigo(porCodigo, String(codigo));
  if (indiceFila < 0) return null;
  matriz[indiceFila][indiceMarcado] = marcado ? "1" : "";
  await guardarFila(matriz, indiceFila);
  return buscarMaterial(codigo);
}

function stockPorBodega(codigo) {
  const fila = cargarMateriales().porFilaBodega.get(String(codigo));
  if (!fila) return [];
  const bodegas = [["M501", "Stock"], ...BODEGAS_EXTRA.map((nombre) => [nombre, nombre])];
  return bodegas
    .filter(([, campo]) => String(fila[campo] ?? "").trim() !== "")
    .map(([bodega, campo]) => ({ bodega, stock: fila[campo] }));
}

function buscarMaterial(codigo) {
  const { tabla, porFila } = cargarMateriales();
  const buscado = String(codigo);
  const fila = porFila.get(buscado) || null;
  const bodegas = fila == null ? [] : stockPorBodega(buscado).filter((item) => item.bodega !== "M501");
  return { columnas: tabla.columnas, fila, bodegas };
}

function textoBusqueda(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buscarMateriales(texto) {
  const consulta = textoBusqueda(texto);
  if (consulta.length < 2) return [];
  const { filas } = leerTabla();
  const coincidencias = [];
  for (const fila of filas) {
    const codigo = String(fila.Codigo ?? "").trim();
    const descripcion = String(fila.Descripcion ?? "").trim();
    if (!codigo) continue;
    const codigoNormalizado = textoBusqueda(codigo);
    const descripcionNormalizada = textoBusqueda(descripcion);
    if (!codigoNormalizado.includes(consulta) && !descripcionNormalizada.includes(consulta)) continue;
    coincidencias.push({
      codigo,
      descripcion,
      exacto: codigoNormalizado === consulta,
    });
  }
  coincidencias.sort((a, b) => Number(b.exacto) - Number(a.exacto) || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  return coincidencias.map(({ codigo, descripcion }) => ({ codigo, descripcion }));
}

async function actualizarMaterial(codigo, { inventario, comentario }) {
  const textoInventario = String(inventario ?? "").trim();
  const textoComentario = String(comentario ?? "");
  if (textoComentario.length > 50) {
    const error = new Error("El comentario admite como máximo 50 caracteres.");
    error.status = 400;
    throw error;
  }
  if (textoInventario !== "" && !/^-?\d+$/.test(textoInventario)) {
    const error = new Error("Inventario debe ser un número entero.");
    error.status = 400;
    throw error;
  }

  const { matriz, porCodigo } = editarMateriales();
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceInventario = columnas.indexOf("Inventario");
  const indiceComentario = columnas.indexOf("Comentario");

  if (indiceCodigo < 0 || indiceInventario < 0 || indiceComentario < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }

  const indiceFila = indicePorCodigo(porCodigo, String(codigo));
  if (indiceFila < 0) return null;

  if (textoInventario !== "") {
    matriz[indiceFila][indiceInventario] = Number(textoInventario);
  }
  matriz[indiceFila][indiceComentario] = textoComentario;
  await guardarFila(matriz, indiceFila);

  return buscarMaterial(codigo);
}

async function limpiarInventarioComentarios(clave) {
  exigirClave(clave);
  const { matriz } = editarMateriales();
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceInventario = columnas.indexOf("Inventario");
  const indiceComentario = columnas.indexOf("Comentario");

  if (indiceInventario < 0 || indiceComentario < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }

  for (let indice = 1; indice < matriz.length; indice += 1) {
    const fila = matriz[indice] || [];
    while (fila.length <= Math.max(indiceInventario, indiceComentario)) fila.push("");
    fila[indiceInventario] = "";
    fila[indiceComentario] = "";
    matriz[indice] = fila;
  }

  const { error } = await supabase.from("materiales").update({ inventario: "", comentario: "" }).neq("codigo", "");
  if (error) falloSupabase(error);
  recordarMateriales(matriz, cacheMateriales?.nombreHoja || "Hoja1");
  return leerTabla();
}

const COLUMNAS_BLOQUEADAS = new Set(["Inventario", "Comentario", "Rombo", "QR", "Foto", COLUMNA_MARCADO]);
const CLAVE_DATOS = process.env.CLAVE_DATOS;
if (!CLAVE_DATOS) {
  throw new Error("Falta CLAVE_DATOS en prog2/back/.env");
}

function claveCorrecta(clave) {
  const esperada = Buffer.from(CLAVE_DATOS);
  const recibida = Buffer.from(String(clave ?? ""));
  if (esperada.length !== recibida.length) {
    crypto.timingSafeEqual(esperada, esperada);
    return false;
  }
  return crypto.timingSafeEqual(esperada, recibida);
}

function exigirClave(clave) {
  if (!claveCorrecta(clave)) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
}

async function actualizarDatos(codigo, clave, datos, reemplazar) {
  exigirClave(clave);
  if (!datos || typeof datos !== "object") {
    const error = new Error("No hay datos para guardar.");
    error.status = 400;
    throw error;
  }

  const { matriz, porCodigo } = editarMateriales();
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }

  const indiceFila = indicePorCodigo(porCodigo, String(codigo));
  if (indiceFila < 0) return null;

  columnas.forEach((columna, indice) => {
    if (COLUMNAS_BLOQUEADAS.has(columna) || !(columna in datos)) return;
    matriz[indiceFila][indice] = datos[columna] ?? "";
  });

  const codigoNuevo = String(matriz[indiceFila][indiceCodigo] ?? "").trim();
  if (!codigoNuevo) {
    const error = new Error("El código no puede quedar vacío.");
    error.status = 400;
    throw error;
  }
  matriz[indiceFila][indiceCodigo] = codigoNuevo;
  const duplicado = matriz.some(
    (fila, indice) =>
      indice > 0 && indice !== indiceFila && String(fila[indiceCodigo]) === codigoNuevo
  );
  if (duplicado && !reemplazar) {
    const error = new Error("Ya existe un material con ese código.");
    error.status = 409;
    throw error;
  }
  if (duplicado && reemplazar) {
    for (let indice = matriz.length - 1; indice > 0; indice -= 1) {
      if (indice !== indiceFila && String(matriz[indice][indiceCodigo]) === codigoNuevo) {
        matriz.splice(indice, 1);
      }
    }
  }

  if (codigoNuevo !== String(codigo)) await quitarRegistro(codigo);
  const indiceGuardado = matriz.findIndex((fila, indice) => indice > 0 && String(fila[indiceCodigo]) === codigoNuevo);
  await guardarFila(matriz, indiceGuardado);
  return buscarMaterial(codigoNuevo);
}

async function guardarImagen(codigo, campo, nombreArchivo, clave) {
  exigirClave(clave);
  if (!CAMPOS_IMAGEN.has(campo)) {
    const error = new Error("La imagen debe ser Rombo, QR o Foto.");
    error.status = 400;
    throw error;
  }

  const { matriz, porCodigo } = editarMateriales();
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }

  if (!columnas.includes(campo)) {
    columnas.push(campo);
    matriz[0] = columnas;
    for (let i = 1; i < matriz.length; i += 1) {
      matriz[i][columnas.length - 1] = matriz[i][columnas.length - 1] ?? "";
    }
  }

  const indiceFila = indicePorCodigo(porCodigo, String(codigo));
  if (indiceFila < 0) return null;

  const indiceCampo = columnas.indexOf(campo);
  const anterior = String(matriz[indiceFila][indiceCampo] ?? "");
  if (!nombreArchivo && /\.(png|jpe?g|webp|gif)$/i.test(anterior)) {
    const ruta = path.join(__dirname, "imagenes", path.basename(anterior));
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    await quitarImagen(path.basename(anterior));
  }

  matriz[indiceFila][indiceCampo] = nombreArchivo || "";
  await guardarFila(matriz, indiceFila);
  return buscarMaterial(codigo);
}

async function eliminarMaterial(codigo, clave) {
  exigirClave(clave);

  const { matriz, porCodigo } = editarMateriales();
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }

  const indiceFila = indicePorCodigo(porCodigo, String(codigo));
  if (indiceFila < 0) return null;

  for (const campo of CAMPOS_IMAGEN) {
    const indiceCampo = columnas.indexOf(campo);
    if (indiceCampo < 0) continue;
    const anterior = String(matriz[indiceFila][indiceCampo] ?? "");
    if (/\.(png|jpe?g|webp|gif)$/i.test(anterior)) {
      const ruta = path.join(__dirname, "imagenes", path.basename(anterior));
      if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      await quitarImagen(path.basename(anterior));
    }
  }

  matriz.splice(indiceFila, 1);
  await quitarRegistro(codigo);
  recordarMateriales(matriz, cacheMateriales?.nombreHoja || "Hoja1");
  return { codigo: String(codigo) };
}

async function agregarMaterial(clave, datos) {
  exigirClave(clave);
  if (!datos || typeof datos !== "object") {
    const error = new Error("No hay datos para guardar.");
    error.status = 400;
    throw error;
  }

  const codigoNuevo = String(datos.Codigo ?? "").trim();
  if (!codigoNuevo) {
    const error = new Error("El código no puede quedar vacío.");
    error.status = 400;
    throw error;
  }
  if (String(datos.Inventario ?? "").trim() !== "" && !/^-?\d+$/.test(String(datos.Inventario).trim())) {
    const error = new Error("Inventario debe ser un número entero.");
    error.status = 400;
    throw error;
  }

  const { matriz, porCodigo } = editarMateriales();
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }
  const indiceExistente = indicePorCodigo(porCodigo, codigoNuevo);
  const filaPrevia = indiceExistente >= 0 ? matriz[indiceExistente] : [];

  const filaNueva = columnas.map((columna, indice) => {
    if (columna === "Codigo") return codigoNuevo;
    if (columna === "Inventario") {
      const valor = String(datos.Inventario ?? "").trim();
      return valor === "" ? "" : Number(valor);
    }
    if (CAMPOS_IMAGEN.has(columna) || columna === COLUMNA_MARCADO) return filaPrevia[indice] ?? "";
    return datos[columna] ?? "";
  });
  if (indiceExistente >= 0) matriz[indiceExistente] = filaNueva;
  else matriz.push(filaNueva);
  const indiceGuardado = indiceExistente >= 0 ? indiceExistente : matriz.length - 1;
  await guardarFila(matriz, indiceGuardado);
  return buscarMaterial(codigoNuevo);
}

module.exports = {
  crypto,
  fs,
  path,
  XLSX,
  CAMPOS_MATERIAL,
  CAMPOS_RESERVA,
  claveColumna,
  indiceCampo,
  ubicarColumnas,
  registrosMaterial,
  matrizMaterial,
  registrosReserva,
  matrizReserva,
  matrizGuardada,
  ENCABEZADO_MATERIALES,
  BODEGAS_EXTRA,
  BODEGAS_EXPORT,
  COLUMNA_MARCADO,
  COLUMNAS_OCULTAS,
  COLUMNAS_EXTRA,
  CAMPOS_IMAGEN,
  COLUMNA_STOCK_CRITICO,
  ARCHIVO_MARCADOS,
  conStockCritico,
  leerCodigosMarcados,
  conMarcado,
  leerMatriz,
  sinFilasVacias,
  mapaPorCodigo,
  indicePorCodigo,
  tablaDesdeMatriz,
  filasBodegaDesdeMatriz,
  recordarMateriales,
  cargarMateriales,
  editarMateriales,
  falloSupabase,
  persistirRegistro,
  quitarRegistro,
  guardarMateriales,
  guardarFila,
  leerTabla,
  marcarMaterial,
  stockPorBodega,
  buscarMaterial,
  textoBusqueda,
  buscarMateriales,
  actualizarMaterial,
  limpiarInventarioComentarios,
  COLUMNAS_BLOQUEADAS,
  CLAVE_DATOS,
  claveCorrecta,
  exigirClave,
  actualizarDatos,
  guardarImagen,
  eliminarMaterial,
  agregarMaterial,
};
