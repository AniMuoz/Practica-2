// Bodega "principal" elegida en la barra superior. Se guarda en el navegador y viaja al servidor
// en la cabecera X-Bodega (fetch) o en ?principal= (descargas por enlace). M501 es la bodega por defecto.
export const BODEGAS = ["M501", "M502", "M503", "M504", "M505"];
const CLAVE = "bodega-principal";

export function bodegaPrincipal() {
  try {
    const guardada = typeof localStorage !== "undefined" ? localStorage.getItem(CLAVE) : null;
    return BODEGAS.includes(guardada) ? guardada : "M501";
  } catch {
    return "M501";
  }
}

// Nombre de la sede de cada bodega (título de la navbar y de la pestaña).
export const NOMBRES_BODEGA = { M501: "Coraceros", M502: "San Juan", M503: "San Felipe", M504: "Quillota", M505: "Concón" };

export function nombreBodega(bodega = bodegaPrincipal()) {
  return NOMBRES_BODEGA[bodega] || NOMBRES_BODEGA.M501;
}

export function tituloBodega(bodega = bodegaPrincipal()) {
  return `Bodega Esval ${nombreBodega(bodega)}${bodega === "M501" ? " Viña" : ""}`;
}

export function esM501() {
  return bodegaPrincipal() === "M501";
}

// Cambia la bodega y recarga la página para que todos los datos (principal y Admin) se pidan de nuevo.
export function elegirBodega(bodega) {
  if (!BODEGAS.includes(bodega) || bodega === bodegaPrincipal()) return;
  try {
    localStorage.setItem(CLAVE, bodega);
  } catch {
    /* sin almacenamiento: no se puede cambiar */
    return;
  }
  window.location.reload();
}

// Agrega ?principal=M50x a una ruta de descarga cuando la bodega no es M501.
export function conBodega(ruta) {
  const bodega = bodegaPrincipal();
  if (bodega === "M501") return ruta;
  return `${ruta}${ruta.includes("?") ? "&" : "?"}principal=${bodega}`;
}
