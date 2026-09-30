const fs = require("fs");
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

  for (const extra of ["Rombo", "QR"]) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }

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

const COLUMNAS_BLOQUEADAS = new Set(["Inventario", "Comentario", "Rombo", "QR"]);
const CLAVE_DATOS = "Berfre2026";

function actualizarDatos(codigo, clave, datos) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  if (!datos || typeof datos !== "object") {
    const error = new Error("No hay datos para guardar.");
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
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }

  const indiceFila = matriz.findIndex(
    (fila, indice) => indice > 0 && String(fila[indiceCodigo]) === String(codigo)
  );
  if (indiceFila < 0) return null;

  columnas.forEach((columna, indice) => {
    if (COLUMNAS_BLOQUEADAS.has(columna) || !(columna in datos)) return;
    matriz[indiceFila][indice] = datos[columna] ?? "";
  });

  const codigoNuevo = String(matriz[indiceFila][indiceCodigo] ?? "").trim();
  if (!codigoNuevo) {
    const error = new Error("El código no puede quedar vacío.");
    error.status = 400;
    throw error;
  }
  const duplicado = matriz.some(
    (fila, indice) =>
      indice > 0 && indice !== indiceFila && String(fila[indiceCodigo]) === codigoNuevo
  );
  if (duplicado) {
    const error = new Error("Ya existe un material con ese código.");
    error.status = 400;
    throw error;
  }

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(matriz);
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigoNuevo);
}

function guardarImagen(codigo, campo, nombreArchivo, clave) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  if (campo !== "Rombo" && campo !== "QR") {
    const error = new Error("La imagen debe ser Rombo o QR.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }

  if (!columnas.includes(campo)) {
    columnas.push(campo);
    matriz[0] = columnas;
    for (let i = 1; i < matriz.length; i += 1) {
      matriz[i][columnas.length - 1] = matriz[i][columnas.length - 1] ?? "";
    }
  }

  const indiceFila = matriz.findIndex(
    (fila, indice) => indice > 0 && String(fila[indiceCodigo]) === String(codigo)
  );
  if (indiceFila < 0) return null;

  const indiceCampo = columnas.indexOf(campo);
  const anterior = String(matriz[indiceFila][indiceCampo] ?? "");
  if (!nombreArchivo && /\.(png|jpe?g|webp|gif)$/i.test(anterior)) {
    const ruta = path.join(__dirname, "imagenes", path.basename(anterior));
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
  }

  matriz[indiceFila][indiceCampo] = nombreArchivo || "";
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(matriz);
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigo);
}

module.exports = { leerTabla, buscarMaterial, actualizarMaterial, actualizarDatos, guardarImagen };
