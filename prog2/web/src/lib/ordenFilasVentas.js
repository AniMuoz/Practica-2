// Orden dentro de cada orden (lote). Keys uniformes campo-asc / campo-desc.
// Mantener en sync con prog2/back/servicios/ordenFilasVentas.js

const ORDENES_FILAS = {
  "codigo-asc": ["codigo", 1],
  "codigo-desc": ["codigo", -1],
  "ubicacion-asc": ["ubicacion", 1],
  "ubicacion-desc": ["ubicacion", -1],
  "descripcion-asc": ["descripcion", 1],
  "descripcion-desc": ["descripcion", -1],
  "entregar-asc": ["entregar", 1],
  "entregar-desc": ["entregar", -1],
};

export const OPCIONES_ORDEN = [
  ["", "Sin orden extra"],
  ["codigo-asc", "Códigos de menor a mayor"],
  ["codigo-desc", "Códigos de mayor a menor"],
  ["ubicacion-asc", "Ubicaciones de menor a mayor"],
  ["ubicacion-desc", "Ubicaciones de mayor a menor"],
  ["descripcion-asc", "Descripciones A-Z"],
  ["descripcion-desc", "Descripciones Z-A"],
  ["entregar-asc", "Entregar de menor a mayor"],
  ["entregar-desc", "Entregar de mayor a menor"],
];

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
