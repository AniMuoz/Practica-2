const path = require("path");
const XLSX = require("xlsx");

/**
 * Origen actual de la tabla. Cuando el Excel se reemplace por una base
 * de datos, solo hay que cambiar esta función: el resto de la API sigue
 * devolviendo { columnas, filas }.
 */
function leerTabla() {
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  if (matriz.length === 0) {
    return { columnas: [], filas: [] };
  }

  const columnas = matriz[0].map((nombre, indice) =>
    String(nombre || `Columna ${indice + 1}`)
  );

  const filas = matriz.slice(1).map((fila) => {
    const registro = {};
    columnas.forEach((columna, indice) => {
      registro[columna] = fila[indice] ?? "";
    });
    return registro;
  });

  return { columnas, filas };
}

function buscarMaterial(codigo) {
  const { columnas, filas } = leerTabla();
  const buscado = String(codigo);
  const fila = filas.find((item) => String(item.Codigo) === buscado) || null;
  return { columnas, fila };
}

function actualizarMaterial(codigo, { inventario, comentario }) {
  if (!/^-?\d+$/.test(String(inventario).trim())) {
    const error = new Error("Inventario debe ser un número entero.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceInventario = columnas.indexOf("Inventario");
  const indiceComentario = columnas.indexOf("Comentario");

  if (indiceCodigo < 0 || indiceInventario < 0 || indiceComentario < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }

  const indiceFila = matriz.findIndex(
    (fila, indice) => indice > 0 && String(fila[indiceCodigo]) === String(codigo)
  );
  if (indiceFila < 0) return null;

  matriz[indiceFila][indiceInventario] = Number(String(inventario).trim());
  matriz[indiceFila][indiceComentario] = String(comentario ?? "");
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(matriz);
  XLSX.writeFile(libro, archivo);

  return buscarMaterial(codigo);
}

module.exports = { leerTabla, buscarMaterial, actualizarMaterial };
