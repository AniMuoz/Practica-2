// Espejo front de prog2/back/seguridad/capacidades.js.
// La UI solo oculta/deshabilita; el servidor sigue siendo la autoridad.

export function actorDe(fuente = {}) {
  return {
    rol: fuente.rol || "operador",
    bodega: fuente.bodega || "M501",
    usuario: fuente.usuario || "",
  };
}

export function esAdmin(actor) {
  return actorDe(actor).rol === "admin";
}

export function esAdminExt(actor) {
  return actorDe(actor).rol === "admin_ext";
}

export function esAdminVista(actor) {
  return esAdmin(actor) || esAdminExt(actor);
}

export function esBodegaM501(actor) {
  return (actorDe(actor).bodega || "M501") === "M501";
}

export function esAdminM501(actor) {
  return esAdmin(actor) && esBodegaM501(actor);
}

export function esAdminM501oExt(actor) {
  return esAdminExt(actor) || esAdminM501(actor);
}

export function esBodegaLimitada(actor) {
  return !esAdminExt(actor) && !esBodegaM501(actor);
}

export function puedeVerBuzonAdmin(actor) {
  return esAdminVista(actor);
}

export function puedeGestionarBuzon(actor) {
  return esAdmin(actor);
}

export function puedeEditarDatosCompletos(actor) {
  return !esAdminExt(actor) && !esBodegaLimitada(actor);
}

export function puedeEditarObservaciones(actor) {
  return !esAdminExt(actor);
}

export function puedeSubirImagenMaterial(actor, campo) {
  const a = actorDe(actor);
  if (esAdminExt(a)) return campo === "QR";
  if (esBodegaLimitada(a)) return campo !== "QR" || a.rol === "admin";
  return true;
}

export function puedeEliminarMaterial(actor) {
  return puedeEditarDatosCompletos(actor);
}

// Flags de la ficha de material (Detalle): un solo lugar para ramas de edición.
export function permisosDetalle(sesion) {
  const actor = actorDe(sesion);
  const ext = esAdminExt(actor);
  const limitado = esBodegaLimitada(actor);
  return {
    esExt: ext,
    limitado,
    puedeEditarDatosCompletos: puedeEditarDatosCompletos(actor),
    puedeEditarObservaciones: puedeEditarObservaciones(actor),
    puedeEliminarMaterial: puedeEliminarMaterial(actor),
    puedeSubirImagen: (campo) => puedeSubirImagenMaterial(actor, campo),
    etiquetaEdicion: limitado ? "Añadir imagen y observaciones" : "Cambiar datos de material",
  };
}
