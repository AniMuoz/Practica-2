// Orden dentro de cada orden (lote). Keys uniformes campo-asc / campo-desc.
// Mantener en sync con prog2/back/servicios/ordenFilasVentas.js

// Una sola definicion: [clave, campo, sentido, etiqueta]. ORDENES_FILAS y OPCIONES_ORDEN se derivan de aqui.
const DEFINICION_ORDENES = [
  ["codigo-asc", "codigo", 1, "Códigos de menor a mayor"],
  ["codigo-desc", "codigo", -1, "Códigos de mayor a menor"],
  ["ubicacion-asc", "ubicacion", 1, "Ubicaciones de menor a mayor"],
  ["ubicacion-desc", "ubicacion", -1, "Ubicaciones de mayor a menor"],
  ["descripcion-asc", "descripcion", 1, "Descripciones A-Z"],
  ["descripcion-desc", "descripcion", -1, "Descripciones Z-A"],
  ["entregar-asc", "entregar", 1, "Entregar de menor a mayor"],
  ["entregar-desc", "entregar", -1, "Entregar de mayor a menor"],
];

const ORDENES_FILAS = Object.fromEntries(DEFINICION_ORDENES.map(([clave, campo, sentido]) => [clave, [campo, sentido]]));

export const OPCIONES_ORDEN = [["", "Sin orden extra"], ...DEFINICION_ORDENES.map(([clave, , , etiqueta]) => [clave, etiqueta])];

function comparar(campo, sentido) {
  return (a, b) => {
    const va = String(a[campo] ?? "").trim();
    const vb = String(b[campo] ?? "").trim();
    if (campo === "ubicacion") {
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
    }
    return va.localeCompare(vb, "es", { numeric: true, sensitivity: "base" }) * sentido;
  };
}

// Ordena una sola lista (una orden). La columna Pos no se mueve.
export function ordenarFilasVentas(filas, orden) {
  const regla = ORDENES_FILAS[orden];
  if (!regla) return filas;
  const [campo, sentido] = regla;
  const posiciones = filas.map((f) => f.pos);
  return [...filas].sort(comparar(campo, sentido)).map((f, i) => ({ ...f, pos: posiciones[i] }));
}
