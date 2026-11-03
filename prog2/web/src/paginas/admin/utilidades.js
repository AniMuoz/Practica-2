// Funciones puras de Admin.jsx (sin estado de React) para poder probarlas por separado.

const SIN_CARGA = "Todavía no hay una carga registrada para esta opción.";

// Texto con la fecha de la ultima carga (ISO) o el aviso de que aun no hay ninguna.
export function textoUltimaCarga(iso) {
  if (!iso) return SIN_CARGA;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return SIN_CARGA;
  const texto = fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Último cambio: ${texto}`;
}

// Nombres no vacios de las filas de contratistas.
export function nombresContratistas(filas) {
  return (filas || []).map((fila) => fila.nombre).filter(Boolean);
}

// Deja solo las filas cuyo codigo esta en `codigos` y las ordena segun `orden` (codigo -> posicion).
// `marcados` (opcional) se reordena igual que las filas.
export function filtrarYOrdenarPorCodigo(filas, indiceCodigo, marcados, codigos, orden) {
  const pares = filas
    .map((fila, i) => ({ fila, i }))
    .filter(({ fila }) => codigos.has(String(fila[indiceCodigo])))
    .sort((a, b) => (orden.get(String(a.fila[indiceCodigo])) ?? 0) - (orden.get(String(b.fila[indiceCodigo])) ?? 0));
  return { filas: pares.map((p) => p.fila), marcados: marcados ? pares.map((p) => marcados[p.i]) : undefined };
}
