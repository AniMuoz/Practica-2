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
const CAMPO_LIBRE = /^(ubicaci[oó]n|sub-ubicaci[oó]n|inventario|comentario)( m50\d)?$/i;

function requiereAdmin(metodo, ruta) {
  if (METODOS_LECTURA.has(metodo)) return false;
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
      const bodega = req.bodega || "M501";
      if (bodega !== "M501" && !soloCamposLibres(req.method, req.path, req.body)) {
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
