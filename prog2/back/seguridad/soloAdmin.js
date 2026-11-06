// Los operadores solo pueden ver, filtrar y descargar en la pagina Admin: toda escritura exige rol admin.
// Gastos, buzon y el conteo de la pagina de material (inventario y comentario) quedan fuera a proposito.
const ESCRITURAS_ADMIN = [
  /^\/movimientos\/codigo/,
  /^\/stock-detallado/,
  /^\/tabla\/(excel|limpiar-inventario)$/,
  /^\/material(\/|$)/,
  /^\/contratistas$/,
  /^\/ventas(\/(filas|ordenes)\b.*)?$/,
  /^\/bitacora\//,
];
const METODOS_LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);
// PUT /material/:codigo guarda inventario y comentario. No incluye /datos, /marcado ni /imagen.
const CONTEO_MATERIAL = /^\/material\/[^/]+$/;

function requiereAdmin(metodo, ruta) {
  if (METODOS_LECTURA.has(metodo)) return false;
  if (metodo === "PUT" && CONTEO_MATERIAL.test(ruta)) return false;
  return ESCRITURAS_ADMIN.some((patron) => patron.test(ruta));
}

// `exigirAdmin` y `responderError` se reciben para poder probar el middleware sin Supabase.
function soloAdminEnEscrituras(exigirAdmin, responderError) {
  return async (req, res, next) => {
    if (!requiereAdmin(req.method, req.path)) return next();
    try {
      await exigirAdmin(req);
      next();
    } catch (error) {
      responderError(res, error, "No se pudo verificar el rol.");
    }
  };
}

module.exports = { requiereAdmin, soloAdminEnEscrituras };
