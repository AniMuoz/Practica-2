// Los operadores solo pueden ver, filtrar y descargar en la pagina Admin: toda escritura exige rol admin.
// Gastos y buzon quedan fuera a proposito: los operadores si los usan.
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

function requiereAdmin(metodo, ruta) {
  return !METODOS_LECTURA.has(metodo) && ESCRITURAS_ADMIN.some((patron) => patron.test(ruta));
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
