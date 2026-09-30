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

module.exports = { leerTabla, buscarMaterial };
