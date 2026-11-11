// Solo los administradores de la bodega M501 pueden modificar datos. Los demas usuarios solo ven y descargan.
// Excepciones: ubicacion, sub-ubicacion, inventario y comentario (los admin de otras bodegas pueden editar
// ubicacion/sub-ubicacion de su bodega; el conteo de inventario y comentario queda abierto a todos).
// Gastos y buzon quedan fuera a proposito.
const ESCRITURAS_ADMIN = [
  /^\/movimientos\/codigo/,
  /^\/movimientos$/,
  /^\/stock-detallado/,
  /^\/tabla\/(excel|limpiar-inventario)$/,
  /^\/material(\/|$)/,
  /^\/contratistas$/,
  /^\/ventas(\/(filas|ordenes)\b.*)?$/,
  /^\/bitacora(\/|$)/,
];
const METODOS_LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);
// PUT /material/:codigo guarda inventario y comentario. No incluye /datos, /marcado ni /imagen.
const CONTEO_MATERIAL = /^\/material\/[^/]+$/;
const DATOS_MATERIAL = /^\/material\/[^/]+\/datos$/;
// El superusuario (admin de M501) puede operar en todas las bodegas, incluida la limpieza ajena.
const SUPERUSUARIO = "adminm501";
// Limpiar inventario y comentarios: cualquier admin, pero solo en su propia bodega.
const LIMPIEZA_PROPIA = /^\/tabla\/limpiar-inventario$/;
// Solo nombres sin sufijo de bodega: el servidor los traduce a las columnas de la bodega activa.
const CAMPO_LIBRE = /^(ubicaci[oó]n|sub-ubicaci[oó]n|inventario|comentario)$/i;

// Express enruta sin distinguir mayusculas ni la "/" final: se normaliza igual para no saltarse la lista.
function normalizarRuta(ruta) {
  const limpia = String(ruta || "").toLowerCase().replace(/\/+$/, "");
  return limpia || "/";
}

function requiereAdmin(metodo, rutaOriginal) {
  if (METODOS_LECTURA.has(metodo)) return false;
  const ruta = normalizarRuta(rutaOriginal);
  if (metodo === "PUT" && CONTEO_MATERIAL.test(ruta)) return false;
  return ESCRITURAS_ADMIN.some((patron) => patron.test(ruta));
}

// Edicion de campos que cualquier admin de bodega puede tocar (solo ubicacion y sub-ubicacion en la practica).
function soloCamposLibres(metodo, ruta, body) {
  if (metodo !== "PUT" || !DATOS_MATERIAL.test(ruta)) return false;
  if (!body || body.reemplazar === true || !body.datos || typeof body.datos !== "object") return false;
  const claves = Object.keys(body.datos);
  return claves.length > 0 && claves.every((clave) => CAMPO_LIBRE.test(clave));
}

// `exigirAdmin` y `responderError` se reciben para poder probar el middleware sin Supabase.
function soloAdminEnEscrituras(exigirAdmin, responderError) {
  return async (req, res, next) => {
    if (!requiereAdmin(req.method, req.path)) return next();
    try {
      await exigirAdmin(req);
      const ruta = normalizarRuta(req.path);
      const bodega = req.bodega || "M501";
      // Un admin de otra bodega solo edita campos libres y solo en su propia bodega (no con X-Bodega ajeno).
      const ajena = req.bodegaActiva && req.bodegaActiva !== bodega;
      if (req.method === "POST" && LIMPIEZA_PROPIA.test(ruta)) {
        if (ajena && req.usuario !== SUPERUSUARIO) throw Object.assign(new Error("Solo puedes limpiar el inventario y comentarios de tu propia bodega."), { status: 403 });
        return next();
      }
      if (bodega !== "M501" && (ajena || !soloCamposLibres(req.method, ruta, req.body))) {
        const error = new Error("Tu bodega solo puede ver y descargar planillas.");
        error.status = 403;
        throw error;
      }
      next();
    } catch (error) {
      responderError(res, error, "No se pudo verificar el rol.");
    }
  };
}

module.exports = { requiereAdmin, soloAdminEnEscrituras };
