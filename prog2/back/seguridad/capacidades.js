// Capa canónica de capacidades (rol × bodega × acción).
// Las rutas y el middleware deben preguntar aquí; el front espeja la misma política en web/src/lib/permisos.js.

function actorDe(fuente = {}) {
  return {
    rol: fuente.rol || "operador",
    bodega: fuente.bodega || "M501",
    usuario: fuente.usuario || "",
  };
}

function esAdmin(actor) {
  return actorDe(actor).rol === "admin";
}

function esAdminExt(actor) {
  return actorDe(actor).rol === "admin_ext";
}

function esAdminVista(actor) {
  return esAdmin(actor) || esAdminExt(actor);
}

function esBodegaM501(actor) {
  return (actorDe(actor).bodega || "M501") === "M501";
}

function esAdminM501(actor) {
  return esAdmin(actor) && esBodegaM501(actor);
}

function esAdminM501oExt(actor) {
  return esAdminExt(actor) || esAdminM501(actor);
}

// Admin u operador de una bodega que no es M501 (ni admin_ext): edición limitada de material.
function esBodegaLimitada(actor) {
  return !esAdminExt(actor) && !esBodegaM501(actor);
}

function puedeVerBuzonAdmin(actor) {
  return esAdminVista(actor);
}

// Responder, cambiar estado y borrar: solo admin de la bodega propia (no admin_ext).
function puedeGestionarBuzon(actor) {
  return esAdmin(actor);
}

function puedeEditarDatosCompletos(actor) {
  return !esAdminExt(actor) && !esBodegaLimitada(actor);
}

function puedeEditarObservaciones(actor) {
  return !esAdminExt(actor);
}

function puedeSubirImagenMaterial(actor, campo) {
  const a = actorDe(actor);
  if (esAdminExt(a)) return campo === "QR";
  if (esBodegaLimitada(a)) return campo !== "QR" || a.rol === "admin";
  return true;
}

function puedeEliminarMaterial(actor) {
  return puedeEditarDatosCompletos(actor);
}

module.exports = {
  actorDe,
  esAdmin,
  esAdminExt,
  esAdminVista,
  esBodegaM501,
  esAdminM501,
  esAdminM501oExt,
  esBodegaLimitada,
  puedeVerBuzonAdmin,
  puedeGestionarBuzon,
  puedeEditarDatosCompletos,
  puedeEditarObservaciones,
  puedeSubirImagenMaterial,
  puedeEliminarMaterial,
};
