const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const BODEGAS_EXTRA = ["M502", "M503", "M504", "M505"];
const BODEGAS_EXPORT = ["M501", ...BODEGAS_EXTRA];
const COLUMNA_MARCADO = "Marcado";
const COLUMNAS_OCULTAS = new Set([...BODEGAS_EXTRA, COLUMNA_MARCADO]);
const COLUMNAS_EXTRA = ["Rombo", "QR", "Foto", ...BODEGAS_EXTRA];
const CAMPOS_IMAGEN = new Set(["Rombo", "QR", "Foto"]);
const COLUMNA_STOCK_CRITICO = "Stock critico";
const ARCHIVO_MARCADOS = path.join(__dirname, "marcados.json");

function conStockCritico(matriz) {
  if (matriz.length === 0) return matriz;
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  if (columnas.includes(COLUMNA_STOCK_CRITICO)) return matriz;
  const indiceRombo = columnas.indexOf("Rombo");
  const indice = indiceRombo >= 0 ? indiceRombo : columnas.length;
  return matriz.map((fila, numero) => {
    const copia = [...(fila || [])];
    while (copia.length < columnas.length) copia.push("");
    copia.splice(indice, 0, numero === 0 ? COLUMNA_STOCK_CRITICO : "");
    return copia;
  });
}

function leerCodigosMarcados() {
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVO_MARCADOS, "utf8"));
    return new Set((Array.isArray(data) ? data : []).map((codigo) => String(codigo)));
  } catch {
    return new Set();
  }
}

function conMarcado(matriz) {
  if (matriz.length === 0) return { matriz, agregada: false };
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  if (columnas.includes(COLUMNA_MARCADO)) return { matriz, agregada: false };
  const indiceCodigo = columnas.indexOf("Codigo");
  const marcados = leerCodigosMarcados();
  const conColumna = matriz.map((fila, numero) => {
    const copia = [...(fila || [])];
    while (copia.length < columnas.length) copia.push("");
    const codigo = indiceCodigo >= 0 ? String(copia[indiceCodigo] ?? "") : "";
    copia.push(numero === 0 ? COLUMNA_MARCADO : marcados.has(codigo) ? "1" : "");
    return copia;
  });
  return { matriz: conColumna, agregada: true };
}

function leerMatriz(libro) {
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = conMarcado(
    conStockCritico(XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, defval: "" }))
  );
  return { nombreHoja, matriz };
}

/**
 * Origen actual de la tabla. Cuando el Excel se reemplace por una base
 * de datos, solo hay que cambiar esta función: el resto de la API sigue
 * devolviendo { columnas, filas }.
 */
function sinFilasVacias(matriz) {
  if (matriz.length === 0) return matriz;
  const encabezado = matriz[0];
  const filas = matriz.slice(1).filter((fila) =>
    (fila || []).some((celda) => String(celda ?? "").trim() !== "")
  );
  return [encabezado, ...filas];
}

function leerTabla() {
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const { nombreHoja, matriz } = leerMatriz(libro);
  const encabezadoGuardado = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, defval: "" })[0] || [];
  const encabezadosGuardados = encabezadoGuardado.map((nombre) => String(nombre));
  const faltaFoto = !encabezadosGuardados.includes("Foto");
  const faltaMarcado = !encabezadosGuardados.includes(COLUMNA_MARCADO);
  if (faltaFoto) {
    const columnasArchivo = (matriz[0] || []).map((nombre) => String(nombre));
    if (!columnasArchivo.includes("Foto")) {
      columnasArchivo.push("Foto");
      matriz[0] = columnasArchivo;
    }
  }
  if (!encabezadosGuardados.includes(COLUMNA_STOCK_CRITICO) || faltaFoto || faltaMarcado) {
    libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
    try {
      XLSX.writeFile(libro, archivo);
      if (faltaMarcado && fs.existsSync(ARCHIVO_MARCADOS)) fs.unlinkSync(ARCHIVO_MARCADOS);
    } catch {
      // Si el Excel está abierto, la columna igual se usa en memoria.
    }
  }

  if (matriz.length === 0) {
    return { columnas: [], filas: [] };
  }

  const columnas = matriz[0].map((nombre, indice) =>
    String(nombre || `Columna ${indice + 1}`)
  );

  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }

  const visibles = columnas.filter((columna) => !COLUMNAS_OCULTAS.has(columna));

  const indiceMarcado = columnas.indexOf(COLUMNA_MARCADO);
  const filas = sinFilasVacias(matriz).slice(1).map((fila) => {
    const registro = {};
    visibles.forEach((columna) => {
      registro[columna] = fila[columnas.indexOf(columna)] ?? "";
    });
    registro.Marcado = indiceMarcado >= 0 ? fila[indiceMarcado] ?? "" : "";
    return registro;
  });

  return { columnas: visibles, filas };
}

function marcarMaterial(codigo, marcado) {
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const { nombreHoja, matriz } = leerMatriz(libro);
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceMarcado = columnas.indexOf(COLUMNA_MARCADO);
  if (indiceCodigo < 0 || indiceMarcado < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }
  const indiceFila = matriz.findIndex(
    (fila, indice) => indice > 0 && String(fila[indiceCodigo]) === String(codigo)
  );
  if (indiceFila < 0) return null;
  matriz[indiceFila][indiceMarcado] = marcado ? "1" : "";
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigo);
}

function stockPorBodega(codigo) {
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const { matriz } = leerMatriz(libro);
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceCodigo = columnas.indexOf("Codigo");
  const fila = matriz.find(
    (item, indice) => indice > 0 && String(item[indiceCodigo]) === String(codigo)
  );
  if (!fila) return [];

  const bodegas = [["M501", columnas.indexOf("Stock")], ...BODEGAS_EXTRA.map((nombre) => [nombre, columnas.indexOf(nombre)])];
  return bodegas
    .filter(([, indice]) => indice >= 0 && String(fila[indice] ?? "").trim() !== "")
    .map(([bodega, indice]) => ({ bodega, stock: fila[indice] }));
}

function buscarMaterial(codigo) {
  const { columnas, filas } = leerTabla();
  const buscado = String(codigo);
  const fila = filas.find((item) => String(item.Codigo) === buscado) || null;
  const bodegas = fila == null ? [] : stockPorBodega(buscado).filter((item) => item.bodega !== "M501");
  return { columnas, fila, bodegas };
}

function textoBusqueda(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buscarMateriales(texto) {
  const consulta = textoBusqueda(texto);
  if (consulta.length < 2) return [];
  const { filas } = leerTabla();
  const coincidencias = [];
  for (const fila of filas) {
    const codigo = String(fila.Codigo ?? "").trim();
    const descripcion = String(fila.Descripcion ?? "").trim();
    if (!codigo) continue;
    const codigoNormalizado = textoBusqueda(codigo);
    const descripcionNormalizada = textoBusqueda(descripcion);
    if (!codigoNormalizado.includes(consulta) && !descripcionNormalizada.includes(consulta)) continue;
    coincidencias.push({
      codigo,
      descripcion,
      exacto: codigoNormalizado === consulta,
    });
  }
  coincidencias.sort((a, b) => Number(b.exacto) - Number(a.exacto) || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  return coincidencias.map(({ codigo, descripcion }) => ({ codigo, descripcion }));
}

function actualizarMaterial(codigo, { inventario, comentario }) {
  const textoInventario = String(inventario ?? "").trim();
  const textoComentario = String(comentario ?? "");
  if (textoComentario.length > 50) {
    const error = new Error("El comentario admite como máximo 50 caracteres.");
    error.status = 400;
    throw error;
  }
  if (textoInventario !== "" && !/^-?\d+$/.test(textoInventario)) {
    const error = new Error("Inventario debe ser un número entero.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  const { matriz } = leerMatriz(libro);
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

  if (textoInventario !== "") {
    matriz[indiceFila][indiceInventario] = Number(textoInventario);
  }
  matriz[indiceFila][indiceComentario] = textoComentario;
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);

  return buscarMaterial(codigo);
}

function limpiarInventarioComentarios(clave) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  const indiceInventario = columnas.indexOf("Inventario");
  const indiceComentario = columnas.indexOf("Comentario");

  if (indiceInventario < 0 || indiceComentario < 0) {
    const error = new Error("La tabla no tiene las columnas esperadas.");
    error.status = 500;
    throw error;
  }

  for (let indice = 1; indice < matriz.length; indice += 1) {
    const fila = matriz[indice] || [];
    while (fila.length <= Math.max(indiceInventario, indiceComentario)) fila.push("");
    fila[indiceInventario] = "";
    fila[indiceComentario] = "";
    matriz[indice] = fila;
  }

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return leerTabla();
}

const COLUMNAS_BLOQUEADAS = new Set(["Inventario", "Comentario", "Rombo", "QR", "Foto", COLUMNA_MARCADO]);
const CLAVE_DATOS = "Berfre2026";

function actualizarDatos(codigo, clave, datos, reemplazar) {
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
  const { matriz } = leerMatriz(libro);
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
  if (duplicado && !reemplazar) {
    const error = new Error("Ya existe un material con ese código.");
    error.status = 409;
    throw error;
  }
  if (duplicado && reemplazar) {
    for (let indice = matriz.length - 1; indice > 0; indice -= 1) {
      if (indice !== indiceFila && String(matriz[indice][indiceCodigo]) === codigoNuevo) {
        matriz.splice(indice, 1);
      }
    }
  }

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigoNuevo);
}

function guardarImagen(codigo, campo, nombreArchivo, clave) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  if (!CAMPOS_IMAGEN.has(campo)) {
    const error = new Error("La imagen debe ser Rombo, QR o Foto.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  const { matriz } = leerMatriz(libro);
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
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigo);
}

function eliminarMaterial(codigo, clave) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
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

  for (const campo of CAMPOS_IMAGEN) {
    const indiceCampo = columnas.indexOf(campo);
    if (indiceCampo < 0) continue;
    const anterior = String(matriz[indiceFila][indiceCampo] ?? "");
    if (/\.(png|jpe?g|webp|gif)$/i.test(anterior)) {
      const ruta = path.join(__dirname, "imagenes", path.basename(anterior));
      if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    }
  }

  matriz.splice(indiceFila, 1);
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { codigo: String(codigo) };
}

function agregarMaterial(clave, datos) {
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

  const codigoNuevo = String(datos.Codigo ?? "").trim();
  if (!codigoNuevo) {
    const error = new Error("El código no puede quedar vacío.");
    error.status = 400;
    throw error;
  }
  if (String(datos.Inventario ?? "").trim() !== "" && !/^-?\d+$/.test(String(datos.Inventario).trim())) {
    const error = new Error("Inventario debe ser un número entero.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const hoja = libro.Sheets[nombreHoja];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  if (indiceCodigo < 0) {
    const error = new Error("La tabla no tiene la columna Codigo.");
    error.status = 500;
    throw error;
  }
  const indiceExistente = matriz.findIndex(
    (fila, indice) => indice > 0 && String(fila[indiceCodigo]) === codigoNuevo
  );
  const filaPrevia = indiceExistente >= 0 ? matriz[indiceExistente] : [];

  const filaNueva = columnas.map((columna, indice) => {
    if (columna === "Codigo") return codigoNuevo;
    if (columna === "Inventario") {
      const valor = String(datos.Inventario ?? "").trim();
      return valor === "" ? "" : Number(valor);
    }
    if (CAMPOS_IMAGEN.has(columna) || columna === COLUMNA_MARCADO) return filaPrevia[indice] ?? "";
    return datos[columna] ?? "";
  });
  if (indiceExistente >= 0) matriz[indiceExistente] = filaNueva;
  else matriz.push(filaNueva);
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return buscarMaterial(codigoNuevo);
}

function importarPlanilla(clave, buffer) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });
  const encabezados = (matrizEntrada[0] || []).map((nombre) => String(nombre).trim()).filter(Boolean);

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const columnasFormato = columnas.filter((columna) => columna !== COLUMNA_MARCADO);
  const encabezadosFormato = encabezados.filter((columna) => columna !== COLUMNA_MARCADO);
  const faltan = columnasFormato.filter((columna) => !encabezadosFormato.includes(columna));
  const sobran = encabezadosFormato.filter((columna) => !columnasFormato.includes(columna));
  if (faltan.length || sobran.length) {
    const partes = [];
    if (faltan.length) partes.push(`faltan: ${faltan.join(", ")}`);
    if (sobran.length) partes.push(`no corresponden: ${sobran.join(", ")}`);
    const error = new Error(`El formato no coincide con la planilla (${partes.join("; ")}).`);
    error.status = 400;
    throw error;
  }

  const indiceCodigo = columnas.indexOf("Codigo");
  const indicePorNombre = Object.fromEntries(encabezados.map((nombre, indice) => [nombre, indice]));
  let agregados = 0;
  let actualizados = 0;

  matrizEntrada.slice(1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + 2;
    const vacia = encabezados.every((nombre) => String(fila[indicePorNombre[nombre]] ?? "").trim() === "");
    if (vacia) return;

    const codigoNuevo = String(fila[indicePorNombre.Codigo] ?? "").trim();
    if (!codigoNuevo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }
    const inventarioTexto = String(fila[indicePorNombre.Inventario] ?? "").trim();
    if (inventarioTexto !== "" && !/^-?\d+$/.test(inventarioTexto)) {
      const error = new Error(`Inventario de la fila ${numero} debe ser un número entero.`);
      error.status = 400;
      throw error;
    }

    const indiceExistente = matriz.findIndex(
      (item, indice) => indice > 0 && String(item[indiceCodigo]) === codigoNuevo
    );
    const filaPrevia = indiceExistente >= 0 ? matriz[indiceExistente] : [];
    const filaNueva = columnas.map((columna, indice) => {
      if (columna === "Codigo") return codigoNuevo;
      if (columna === "Inventario") return inventarioTexto === "" ? "" : Number(inventarioTexto);
      const valor = fila[indicePorNombre[columna]];
      if (columna === COLUMNA_MARCADO && indicePorNombre[columna] == null) {
        return filaPrevia[indice] ?? "";
      }
      if (CAMPOS_IMAGEN.has(columna) && String(valor ?? "").trim() === "") {
        return filaPrevia[indice] ?? "";
      }
      return valor ?? "";
    });
    if (indiceExistente >= 0) {
      matriz[indiceExistente] = filaNueva;
      actualizados += 1;
    } else {
      matriz.push(filaNueva);
      agregados += 1;
    }
  });

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { agregados, actualizados };
}

function importarSap(clave, buffer) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceDescripcion = columnas.indexOf("Descripcion");
  const indiceStock = columnas.indexOf("Stock");
  if (indiceCodigo < 0 || indiceDescripcion < 0 || indiceStock < 0) {
    const error = new Error("La tabla no tiene las columnas Codigo, Descripcion y Stock.");
    error.status = 500;
    throw error;
  }

  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const ordenSap = [];
  const vistosSap = new Set();

  matrizEntrada.slice(1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + 2;
    const codigo = String(fila[0] ?? "").trim();
    const descripcion = fila[1] ?? "";
    const planta = String(fila[2] ?? "").trim();
    const stock = fila[3] ?? "";
    if (!codigo && planta === "" && String(descripcion).trim() === "" && String(stock).trim() === "") return;
    if (!BODEGAS_EXPORT.includes(planta)) {
      omitidos += 1;
      return;
    }
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }
    if (!vistosSap.has(codigo)) {
      vistosSap.add(codigo);
      ordenSap.push(codigo);
    }

    const indiceBodega = planta === "M501" ? indiceStock : columnas.indexOf(planta);
    const indiceExistente = matriz.findIndex(
      (item, indice) => indice > 0 && String(item[indiceCodigo]) === codigo
    );
    if (indiceExistente >= 0) {
      if (planta === "M501") matriz[indiceExistente][indiceDescripcion] = descripcion;
      matriz[indiceExistente][indiceBodega] = stock;
      actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceDescripcion] = descripcion;
    filaNueva[indiceBodega] = stock;
    matriz.push(filaNueva);
    agregados += 1;
  });

  const encabezado = matriz[0];
  const porCodigo = new Map();
  const fueraDelExport = [];
  for (let indice = 1; indice < matriz.length; indice += 1) {
    const codigoFila = String(matriz[indice][indiceCodigo] ?? "").trim();
    if (vistosSap.has(codigoFila) && !porCodigo.has(codigoFila)) porCodigo.set(codigoFila, matriz[indice]);
    else if (!vistosSap.has(codigoFila)) fueraDelExport.push(matriz[indice]);
  }
  const ordenadas = ordenSap.map((codigoFila) => porCodigo.get(codigoFila)).filter(Boolean);
  matriz.splice(0, matriz.length, encabezado, ...ordenadas, ...fueraDelExport);

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { agregados, actualizados, omitidos };
}

function importarPrecios(clave, buffer) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceDescripcion = columnas.indexOf("Descripcion");
  const indicePrecio = columnas.indexOf("Precio");
  if (indiceCodigo < 0 || indiceDescripcion < 0 || indicePrecio < 0) {
    const error = new Error("La tabla no tiene las columnas Codigo, Descripcion y Precio.");
    error.status = 500;
    throw error;
  }

  let agregados = 0;
  let actualizados = 0;

  matrizEntrada.slice(1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + 2;
    const codigo = String(fila[0] ?? "").trim();
    const descripcion = fila[1] ?? "";
    const precio = fila[3] ?? "";
    if (!codigo && String(descripcion).trim() === "" && String(precio).trim() === "") return;
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }

    const indiceExistente = matriz.findIndex(
      (item, indice) => indice > 0 && String(item[indiceCodigo]) === codigo
    );
    if (indiceExistente >= 0) {
      matriz[indiceExistente][indiceDescripcion] = descripcion;
      matriz[indiceExistente][indicePrecio] = precio;
      actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceDescripcion] = descripcion;
    filaNueva[indicePrecio] = precio;
    matriz.push(filaNueva);
    agregados += 1;
  });

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { agregados, actualizados };
}

function importarUbicaciones(clave, buffer) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceUbicacion = columnas.indexOf("Ubicación");
  const indiceSub = columnas.indexOf("Sub-ubicación");
  if (indiceCodigo < 0 || indiceUbicacion < 0 || indiceSub < 0) {
    const error = new Error("La tabla no tiene las columnas Codigo, Ubicación y Sub-ubicación.");
    error.status = 500;
    throw error;
  }

  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;

  matrizEntrada.slice(1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + 2;
    const codigo = String(fila[0] ?? "").trim();
    const planta = String(fila[2] ?? "").trim();
    const ubicacion = String(fila[3] ?? "").trim();
    if (!codigo && planta === "" && ubicacion === "") return;
    if (planta !== "M501") {
      omitidos += 1;
      return;
    }
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }

    const sub = ubicacion.slice(0, 4);
    const indiceExistente = matriz.findIndex(
      (item, indice) => indice > 0 && String(item[indiceCodigo]) === codigo
    );
    if (indiceExistente >= 0) {
      matriz[indiceExistente][indiceUbicacion] = ubicacion;
      matriz[indiceExistente][indiceSub] = sub;
      actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceUbicacion] = ubicacion;
    filaNueva[indiceSub] = sub;
    matriz.push(filaNueva);
    agregados += 1;
  });

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { agregados, actualizados, omitidos };
}

function importarDosColumnas(clave, buffer, columnaDestino) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  const destino = String(columnaDestino ?? "").trim();
  if (!destino || ["Codigo", "Inventario", "Comentario"].includes(destino)) {
    const error = new Error("Elegí una columna válida para actualizar.");
    error.status = 400;
    throw error;
  }

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });
  const encabezados = (matrizEntrada[0] || []).map((nombre) => String(nombre).trim()).filter(Boolean);
  if (encabezados.length !== 2) {
    const error = new Error("La planilla debe tener exactamente 2 columnas con encabezado.");
    error.status = 400;
    throw error;
  }

  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const nombreHoja = libro.SheetNames[0];
  const { matriz } = leerMatriz(libro);
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  const indiceDestino = columnas.indexOf(destino);
  if (indiceCodigo < 0 || indiceDestino < 0) {
    const error = new Error("La tabla no tiene la columna elegida.");
    error.status = 400;
    throw error;
  }

  let agregados = 0;
  let actualizados = 0;

  matrizEntrada.slice(1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + 2;
    const codigo = String(fila[0] ?? "").trim();
    const valor = fila[1] ?? "";
    if (!codigo && String(valor).trim() === "") return;
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }

    const indiceExistente = matriz.findIndex(
      (item, indice) => indice > 0 && String(item[indiceCodigo]) === codigo
    );
    if (indiceExistente >= 0) {
      matriz[indiceExistente][indiceDestino] = valor;
      actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceDestino] = valor;
    matriz.push(filaNueva);
    agregados += 1;
  });

  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);
  return { agregados, actualizados };
}

function columnaExcel(indice) {
  let nombre = "";
  let n = indice + 1;
  while (n > 0) {
    const resto = (n - 1) % 26;
    nombre = String.fromCharCode(65 + resto) + nombre;
    n = Math.floor((n - 1) / 26);
  }
  return nombre;
}

function stockEnBodega() {
  const { filas } = leerTabla();
  const columnas = ["Código", "Descripción", "Libre utilización"];
  const resultado = filas
    .filter((fila) => String(fila.Descripcion ?? "").trim() !== "NULO")
    .map((fila) => [fila.Codigo ?? "", fila.Descripcion ?? "", valorStock(fila.Stock) ?? ""]);
  return { columnas, filas: resultado };
}

function pintar(celda, estilo, colores) {
  if (colores) celda.fill = estilo;
}

function textoVisible(valor) {
  if (valor == null) return "";
  if (valor instanceof Date) return `${valor.getDate()}/${valor.getMonth() + 1}/${valor.getFullYear()}`;
  if (typeof valor === "object") {
    if (Array.isArray(valor.richText)) return valor.richText.map((parte) => parte.text || "").join("");
    if (valor.text != null) return String(valor.text);
    if (valor.result != null && valor.result !== "") return textoVisible(valor.result);
    if (valor.formula) return "0000000000";
    return "";
  }
  return String(valor);
}

function compactarPlanilla(hoja) {
  const vista = { ...(hoja.views && hoja.views[0] ? hoja.views[0] : {}), zoomScale: 80, zoomScaleNormal: 80 };
  hoja.views = [vista];
  const titulosCombinados = new Set();
  Object.keys(hoja._merges || {}).forEach((rango) => {
    const [inicio, fin] = String(rango).split(":");
    if (!fin) return;
    const limpio = inicio.replace(/\$/g, "");
    if (limpio.replace(/\d/g, "") !== fin.replace(/\$/g, "").replace(/\d/g, "")) titulosCombinados.add(limpio);
  });
  const total = hoja.actualColumnCount || hoja.columnCount;
  for (let columna = 1; columna <= total; columna += 1) {
    let maximo = 0;
    hoja.getColumn(columna).eachCell({ includeEmpty: false }, (celda) => {
      if (titulosCombinados.has(celda.address)) return;
      textoVisible(celda.value).split(/\r?\n/).forEach((linea) => {
        if (linea.length > maximo) maximo = linea.length;
      });
    });
    if (maximo > 0) hoja.getColumn(columna).width = maximo + 1;
  }
}

async function exportarStockBodega(colores = true) {
  const { columnas, filas } = stockEnBodega();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("M501");

  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };

  hoja.getCell("A1").value = "Bodega";
  hoja.getCell("B1").value = "M501";
  ["A1", "B1"].forEach((ref) => {
    const celda = hoja.getCell(ref);
    celda.font = { bold: true, size: 12 };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
    });
    const libre = hoja.getCell(numero, 3);
    const valor = libre.value;
    let color = "FF73C883";
    if (valor === 0 || valor === "0") color = "FFD3D3D3";
    else if (valor === "          ") color = "FFF9E37C";
    pintar(libre, { type: "pattern", pattern: "solid", fgColor: { argb: color } }, colores);
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:C${ultima}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function valorStock(valor) {
  const texto = String(valor ?? "").trim();
  if (texto === "") return null;
  const numero = Number(texto);
  if (Number.isFinite(numero) && String(numero) === texto) return numero;
  return valor;
}

function filasConBodegas() {
  const archivo = path.join(__dirname, "bd_test.xlsx");
  const libro = XLSX.readFile(archivo);
  const { matriz } = leerMatriz(libro);
  const columnas = (matriz[0] || []).map((nombre) => String(nombre));
  return sinFilasVacias(matriz).slice(1).map((fila) => {
    const registro = {};
    columnas.forEach((columna, indice) => {
      registro[columna] = fila[indice] ?? "";
    });
    return registro;
  });
}

function stockRegional() {
  const filas = filasConBodegas();
  const columnas = ["Código", "Descripción", "M501", "M502", "M503", "M504", "M505", "Total"];
  const resultado = filas
    .filter((fila) => String(fila.Descripcion ?? "").trim() !== "NULO")
    .map((fila) => {
      const cantidades = [fila.Stock, fila.M502, fila.M503, fila.M504, fila.M505].map((valor) => valorStock(valor) ?? "");
      const total = cantidades.reduce((suma, valor) => suma + (typeof valor === "number" ? valor : Number(valor) || 0), 0);
      return [fila.Codigo ?? "", fila.Descripcion ?? "", ...cantidades, total];
    });
  return { columnas, filas: resultado };
}

async function exportarStockRegional(colores = true) {
  const { columnas, filas } = stockRegional();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Stock regional");

  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };

  const titulo = hoja.getCell("A1");
  titulo.value = "Stock por bodega";
  titulo.font = { bold: true };
  pintar(titulo, encabezado, colores);
  titulo.border = borde;

  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
      if (columna < 2) return;
      if (columna === 7) celda.font = { bold: true };
      let color = "FF73C883";
      if (valor == null || valor === "" || valor === "          ") color = "FFF9E37C";
      else if (valor === 0 || valor === "0") color = "FFD3D3D3";
      pintar(celda, { type: "pattern", pattern: "solid", fgColor: { argb: color } }, colores);
    });
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:H${ultima}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function claveUbicacion(ubicacion) {
  const ub = String(ubicacion ?? "").trim();
  if (!ub) return [1, 0];
  if (ub.length >= 2 && /^\d{2}/.test(ub.slice(0, 2))) return [0, Number(ub.slice(0, 2))];
  return [0, 999];
}

function planillaInventario() {
  const { filas } = leerTabla();
  const columnas = ["Código", "Descripción", "Ubicación", "Sub-Ubicación", "Libre utilización", "Existencia"];
  const resultado = filas
    .filter((fila) => String(fila.Descripcion ?? "").trim() !== "NULO")
    .map((fila) => [
      fila.Codigo ?? "",
      fila.Descripcion ?? "",
      fila["Ubicación"] ?? "",
      fila["Sub-ubicación"] ?? "",
      valorStock(fila.Stock) ?? "",
      "",
      String(fila.Inventario ?? "").trim(),
    ])
    .sort((a, b) => {
      const [grupoA, numeroA] = claveUbicacion(a[2]);
      const [grupoB, numeroB] = claveUbicacion(b[2]);
      return grupoA - grupoB || numeroA - numeroB;
    });
  return { columnas, filas: resultado };
}

function codigoBodega(ubicacion) {
  const ub = String(ubicacion ?? "").trim();
  if (/^\d{2}/.test(ub)) return ub.slice(0, 2);
  return "Sin bodega";
}

function planillaInventarioPorBodega() {
  const { columnas, filas } = planillaInventario();
  const grupos = new Map();
  filas.forEach((fila) => {
    const codigo = codigoBodega(fila[2]);
    if (!grupos.has(codigo)) grupos.set(codigo, []);
    grupos.get(codigo).push(fila);
  });
  const bodegas = [...grupos.keys()].sort((a, b) => {
    const numeroA = /^\d+$/.test(a) ? Number(a) : 9999;
    const numeroB = /^\d+$/.test(b) ? Number(b) : 9999;
    return numeroA - numeroB || a.localeCompare(b);
  }).map((codigo) => ({ codigo, cantidad: grupos.get(codigo).length }));
  return { columnas, grupos, bodegas };
}

async function armarPlanillaInventario(filas, almacen, colores = true) {
  const columnas = ["Código", "Descripción", "Ubicación", "Sub-Ubicación", "Libre utilización", "Existencia"];
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Inventario");

  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };
  const vacio = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF9E37C" },
  };

  ["A1", "B1"].forEach((ref) => {
    const celda = hoja.getCell(ref);
    celda.font = { bold: true, size: 12 };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });
  hoja.getCell("A1").value = "Bodega";
  hoja.getCell("B1").value = almacen;

  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
      if ((columna === 2 || columna === 3) && String(valor ?? "").trim() === "") pintar(celda, vacio, colores);
    });
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:F${ultima}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function aplicarExistencia(filas, origen) {
  return filas.map((fila) => {
    const copia = fila.slice(0, 6);
    if (origen === "libre") copia[5] = fila[4];
    if (origen === "inventario") copia[5] = fila[6] ?? "";
    return copia;
  });
}

async function exportarPlanillaInventario(colores = true, origenExistencia = "") {
  const { filas } = planillaInventario();
  return armarPlanillaInventario(aplicarExistencia(filas, origenExistencia), "M501", colores);
}

async function exportarInventarioBodega(codigo, colores = true, origenExistencia = "") {
  const { grupos } = planillaInventarioPorBodega();
  const filas = grupos.get(String(codigo));
  if (!filas) {
    const error = new Error("No hay materiales para esa bodega.");
    error.status = 404;
    throw error;
  }
  return armarPlanillaInventario(aplicarExistencia(filas, origenExistencia), String(codigo), colores);
}

function stockDetallado() {
  const filas = filasConBodegas();
  const columnas = [
    "Ubicación",
    "Código",
    "Descripción",
    "M501",
    "Precio x Unidad",
    "Clasificación",
    "M502",
    "M503",
    "M504",
    "M505",
    "Total",
    "Cons.Prom.Mensual",
    "STOCK CRITICO",
    "Stock Max",
    "INDICADOR",
    "Cambio de ubicación",
  ];
  const resultado = [];
  const marcados = [];
  filas
    .filter((fila) => String(fila.Descripcion ?? "").trim() !== "NULO")
    .forEach((fila) => {
      const ubicacion = String(fila["Ubicación"] ?? "").trim();
      const precioTexto = String(fila.Precio ?? "").trim();
      const precio = precioTexto === "" ? "Sin precio" : `$${precioTexto}`;
      const cantidades = [fila.Stock, fila.M502, fila.M503, fila.M504, fila.M505].map((valor) => valorStock(valor) ?? "");
      const total = cantidades.reduce((suma, valor) => suma + (typeof valor === "number" ? valor : Number(valor) || 0), 0);
      resultado.push([
        ubicacion === "" || ubicacion === "          " ? "" : fila["Ubicación"],
        fila.Codigo ?? "",
        fila.Descripcion ?? "",
        cantidades[0],
        precio,
        "",
        cantidades[1],
        cantidades[2],
        cantidades[3],
        cantidades[4],
        total,
        "",
        fila["Stock critico"] ?? "",
        "",
        "",
        "",
      ]);
      marcados.push(String(fila.Marcado) === "1");
    });
  return { columnas, filas: resultado, marcados };
}

function colorStockDetallado(valor) {
  if (valor === 0 || valor === "0") return "FFD3D3D3";
  if (valor == null || valor === "" || valor === "          " || valor === "Sin precio") return "FFF9E37C";
  return "FF73C883";
}

const COLUMNAS_MARCA_DETALLADO = new Set([3, 6, 7, 8, 9, 10]);

async function exportarStockDetallado(colores = true) {
  const { columnas, filas, marcados } = stockDetallado();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Stock detallado");

  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };
  const titulo = hoja.getCell("A1");
  titulo.value = "Stock detallado";
  titulo.font = { bold: true };
  pintar(titulo, encabezado, colores);
  titulo.border = borde;

  const coloreadas = new Set([0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
      if (columna === 10) celda.font = { bold: true };
      if (!coloreadas.has(columna)) return;
      const color = marcados[indice] && COLUMNAS_MARCA_DETALLADO.has(columna) ? "FF88DC65" : colorStockDetallado(valor);
      pintar(celda, { type: "pattern", pattern: "solid", fgColor: { argb: color } }, colores);
    });
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:P${ultima}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function aplicarFiltrosTabla(filas, filtros = {}) {
  let lista = filas.filter((fila) => String(fila.Stock ?? "").trim() !== "");
  const bodega = String(filtros.bodega ?? "").trim();
  const subUbicacion = String(filtros.subUbicacion ?? "").trim();
  const stockMinimo = String(filtros.stockMinimo ?? "").trim();
  if (bodega) {
    lista = lista.filter((fila) => String(fila["Ubicación"] ?? "").trim().slice(0, 2) === bodega);
  }
  if (subUbicacion) {
    lista = lista.filter((fila) => String(fila["Sub-ubicación"] ?? "").trim() === subUbicacion);
  }
  if (stockMinimo !== "") {
    const minimo = Number(stockMinimo);
    lista = lista.filter((fila) => {
      const stock = Number(String(fila.Stock ?? "").trim());
      return Number.isFinite(stock) && stock >= minimo;
    });
  }
  if (filtros.soloConPrecio) {
    lista = lista.filter((fila) => String(fila.Precio ?? "").trim() !== "");
  }
  if (filtros.soloConUbicacion) {
    lista = lista.filter((fila) => String(fila["Ubicación"] ?? "").trim() !== "");
  }
  if (filtros.soloStockCritico) {
    lista = lista.filter((fila) => {
      const textoCritico = String(fila["Stock critico"] ?? "").trim();
      if (textoCritico === "") return false;
      const critico = Number(textoCritico);
      const stock = Number(String(fila.Stock ?? "").trim());
      return Number.isFinite(critico) && Number.isFinite(stock) && stock <= critico;
    });
  }
  if (filtros.soloInventarioOComentario) {
    lista = lista.filter((fila) => {
      const inventario = String(fila.Inventario ?? "").trim();
      const comentario = String(fila.Comentario ?? "").trim();
      return inventario !== "" || comentario !== "";
    });
  }
  if (filtros.soloMarcados) {
    lista = lista.filter((fila) => String(fila.Marcado) === "1");
  }
  if (filtros.ignorarNulo) {
    lista = lista.filter((fila) => String(fila.Descripcion ?? "").trim().toUpperCase() !== "NULO");
  }
  const orden = String(filtros.orden ?? "");
  if (orden === "codigo" || orden === "codigo-asc") {
    const sentido = orden === "codigo" ? -1 : 1;
    lista = [...lista].sort((a, b) => {
      const na = Number(a.Codigo);
      const nb = Number(b.Codigo);
      const comparado = Number.isFinite(na) && Number.isFinite(nb)
        ? na - nb
        : String(a.Codigo).localeCompare(String(b.Codigo), "es", { numeric: true });
      return comparado * sentido;
    });
  } else if (orden === "descripcion" || orden === "descripcion-desc") {
    const sentido = orden === "descripcion" ? 1 : -1;
    lista = [...lista].sort((a, b) =>
      String(a.Descripcion ?? "").localeCompare(String(b.Descripcion ?? ""), "es", { sensitivity: "base" }) * sentido
    );
  }
  return lista;
}

async function exportarTabla(colores = true, filtros = {}) {
  const tabla = leerTabla();
  const columnas = tabla.columnas.filter((columna) => !CAMPOS_IMAGEN.has(columna));
  const filas = aplicarFiltrosTabla(tabla.filas, filtros);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Inventario");
  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  hoja.addRow(columnas);
  const indiceInventario = columnas.indexOf("Inventario");
  const indiceComentario = columnas.indexOf("Comentario");
  const hasta = indiceComentario >= 0 ? indiceComentario + 1 : columnas.length;
  filas.forEach((fila) => {
    const filaHoja = hoja.addRow(columnas.map((columna) => fila[columna] ?? ""));
    if (String(fila.Codigo ?? "").trim() !== "") {
      for (let columna = 1; columna <= hasta; columna += 1) {
        filaHoja.getCell(columna).border = borde;
      }
    }
    const textoCritico = String(fila["Stock critico"] ?? "").trim();
    const stockNumero = Number(String(fila.Stock ?? "").trim());
    const critico = Number(textoCritico);
    if (
      textoCritico !== "" &&
      Number.isFinite(critico) &&
      Number.isFinite(stockNumero) &&
      critico >= stockNumero
    ) {
      const rellenoCritico = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
      columnas.forEach((columna, indice) => {
        if (columna === "Inventario" || columna === "Comentario") return;
        if (columna === "Stock" && String(fila.Marcado) === "1") return;
        pintar(filaHoja.getCell(indice + 1), rellenoCritico, colores);
      });
    }
    const indiceStock = columnas.indexOf("Stock");
    if (indiceStock >= 0 && String(fila.Marcado) === "1") {
      pintar(filaHoja.getCell(indiceStock + 1), { type: "pattern", pattern: "solid", fgColor: { argb: "FF88DC65" } }, colores);
    }
    if (indiceInventario < 0 || indiceComentario < 0) return;
    const comentario = String(fila.Comentario ?? "").trim();
    const stock = String(fila.Stock ?? "").trim();
    const inventario = String(fila.Inventario ?? "").trim();
    if (comentario === "" && inventario === "") return;
    const iguales =
      stock !== "" &&
      inventario !== "" &&
      Number(stock) === Number(inventario) &&
      Number.isFinite(Number(stock)) &&
      Number.isFinite(Number(inventario));
    const color = comentario !== "" ? "FFEFA94A" : iguales ? "FF5DBB63" : "FFFF0000";
    const relleno = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    pintar(filaHoja.getCell(indiceInventario + 1), relleno, colores);
    pintar(filaHoja.getCell(indiceComentario + 1), relleno, colores);
  });

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  for (let columna = 1; columna <= (indiceComentario >= 0 ? indiceComentario + 1 : columnas.length); columna += 1) {
    const celda = encabezado.getCell(columna);
    celda.font = { bold: true };
    celda.border = borde;
    pintar(celda, {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA9E5E5" },
    }, colores);
  }

  if (columnas.length > 0) {
    const ultima = columnaExcel(columnas.length - 1);
    const ultimaFila = Math.max(filas.length + 1, 1);
    hoja.autoFilter = `A1:${ultima}${ultimaFila}`;
  }

  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function enteroReserva(valor) {
  const numero = parseInt(String(valor ?? "").trim(), 10);
  return Number.isFinite(numero) ? numero : 0;
}

function armarReserva(texto) {
  const lineas = String(texto || "").split(/\r?\n/);
  const horizontal = lineas.some((linea) => linea.trim().startsWith("Reserva No."));
  const materiales = new Map();
  filasConBodegas().forEach((fila) => {
    materiales.set(String(fila.Codigo ?? "").trim(), fila);
  });

  const orden = [];
  const num = [];
  const des = [];
  const ub = [];
  const res = [];
  const sto = [];
  const numOrdenItem = [];
  let ordenPagina = null;

  const datoMaterial = (cod) => {
    const material = materiales.get(String(cod ?? "").trim());
    const descripcion = material && String(material.Descripcion ?? "").trim() !== ""
      ? material.Descripcion
      : "Sin descripción";
    const stock = material ? material.Stock ?? 0 : 0;
    const ubicacion = material ? String(material["Ubicación"] ?? "") : "";
    const lugar = ubicacion.trim() !== "" && ubicacion !== "          "
      ? material["Ubicación"]
      : "No se encontro ubicación";
    return { descripcion, stock, lugar };
  };

  lineas.forEach((linea) => {
    const lineaLimpia = linea.trim();
    if (!lineaLimpia) return;
    if (horizontal) {
      if (lineaLimpia.slice(0, 11) === "Reserva No.") {
        const tom2 = (lineaLimpia.split(".")[1] || "").split(" ");
        ordenPagina = tom2[1];
        orden.push(tom2[1]);
      }
      if (lineaLimpia.slice(0, 2) === "00") {
        const cod = lineaLimpia.split(" ")[1];
        const dato = datoMaterial(cod);
        num.push(cod);
        des.push(dato.descripcion);
        sto.push(dato.stock);
        ub.push(dato.lugar);
        numOrdenItem.push(ordenPagina);
      }
      const cant = lineaLimpia.split(",");
      if (cant.length === 2 && cant[1] === "000") res.push(cant[0]);
      return;
    }
    if (lineaLimpia.slice(0, 5) === "Orden") {
      const tom = lineaLimpia.split(/\s{2,}/);
      const resto = (tom.length > 1 ? tom.slice(1).join(" ") : lineaLimpia.slice(5)).trim();
      const numeroOrden = resto.split(/\s+/)[0];
      if (numeroOrden) {
        ordenPagina = numeroOrden;
        orden.push(numeroOrden);
      }
      return;
    }
    if (lineaLimpia.slice(0, 8) === "Material") {
      const tomar = lineaLimpia.split(/\s+/);
      if (tomar[1]) {
        const dato = datoMaterial(tomar[1]);
        num.push(tomar[1]);
        des.push(dato.descripcion);
        sto.push(dato.stock);
        ub.push(dato.lugar);
        res.push(tomar[2]);
        numOrdenItem.push(orden[0] || "");
      }
    }
  });

  const columnas = ["N°", "N° Orden", "Código", "Descripción", "Reserva", "Stock", "Ubicación", "Estado"];
  const filas = num.map((codigo, indice) => {
    const valRes = enteroReserva(res[indice]);
    const valSto = enteroReserva(sto[indice]);
    return [
      indice + 1,
      numOrdenItem[indice] || orden[0] || "",
      codigo,
      des[indice],
      valRes,
      valSto,
      ub[indice],
      valRes <= valSto ? "Disponible" : "No disponible",
    ];
  });
  return { columnas, filas };
}

async function revisarReserva(buffer) {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return armarReserva(data.text);
  } finally {
    await parser.destroy();
  }
}

async function exportarRevisionReserva(buffer, colores = true) {
  const { columnas, filas } = await revisarReserva(buffer);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Reserva");

  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };
  hoja.mergeCells("A1:B1");
  const titulo = hoja.getCell("A1");
  titulo.value = "Revisión Stock de Reserva";
  titulo.font = { bold: true, size: 12 };
  pintar(titulo, encabezado, colores);
  titulo.border = borde;

  columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 1);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 1);
      celda.value = valor ?? "";
      celda.border = borde;
      if (columna !== 7) return;
      const color = valor === "Disponible" ? "FF73C883" : "FFF9E37C";
      pintar(celda, { type: "pattern", pattern: "solid", fgColor: { argb: color } }, colores);
    });
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:H${ultima}`;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

function enteroCelda(valor) {
  const numero = Number(String(valor ?? "").trim());
  return Number.isFinite(numero) ? Math.trunc(numero) : 0;
}

function escribirEncabezadoVentas(hoja, fila, colores) {
  const amarillo = [
    "Pos", "Código", "Descripción", "Ubicación", "M501", "M502", "M503", "M504", "M505",
    "Solicitado", "Entregar", "Med", "Tiras", "Dif", "Comp", "kg x U", "Kg Total GD", "$ x U", "$ Total GD",
    "Contratistas", "Movimiento", "Almacen", "N°Venta", "Cant:GD", "GD Esval", "Estado", "Fecha",
    "Dif.Pend", "GD Esval", "Fecha", "Observacion",
  ];
  const gris = ["Pos", "Código", "SOLICITUD", "COMPARA CODIGO", "COMPARA CANT"];
  const relleno = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  amarillo.forEach((nombre, indice) => {
    const celda = hoja.getCell(fila, indice + 1);
    celda.value = nombre;
    pintar(celda, relleno, colores);
  });
  gris.forEach((nombre, indice) => {
    hoja.getCell(fila, amarillo.length + 1 + indice).value = nombre;
  });
}

function itemsDesdeOrden(ordenBuffer) {
  const libroOrden = XLSX.read(ordenBuffer, { type: "buffer" });
  const nombrePedido = libroOrden.SheetNames.find((nombre) => nombre.toLowerCase().includes("pedido")) || libroOrden.SheetNames[0];
  const orden = XLSX.utils.sheet_to_json(libroOrden.Sheets[nombrePedido], { header: 1, defval: null });
  const encabezado = orden.findIndex((fila) =>
    (fila || []).some((celda) => String(celda ?? "").trim().toLowerCase() === "solicitado")
  );
  const titulos = (orden[encabezado] || []).map((celda) => String(celda ?? "").trim().toLowerCase());
  const colCodigo = Math.max(titulos.indexOf("código"), titulos.indexOf("codigo"), 0);
  const colUnidad = titulos.indexOf("un") >= 0 ? titulos.indexOf("un") : 2;
  const colSolicitado = titulos.indexOf("solicitado") >= 0 ? titulos.indexOf("solicitado") : 3;
  return orden.slice(encabezado + 1).flatMap((fila) => {
    const cantidad = fila?.[colSolicitado];
    if (cantidad == null || cantidad === "" || Number(cantidad) === 0) return [];
    return [{
      codigo: fila?.[colCodigo],
      unidad: fila?.[colUnidad],
      cantidad,
    }];
  });
}

function numeroEnTitulo(titulo) {
  const texto = String(titulo ?? "").trim();
  const marcado = texto.match(/(?:n[°ºo.]|numero|número|traspaso)\s*[:.]?\s*(\d+)/i);
  if (marcado) return marcado[1];
  const numeros = texto.match(/\d+/g);
  return numeros ? numeros[numeros.length - 1] : "";
}

function itemsDesdeTraspaso(traspasoBuffer) {
  // Encabezados en la fila 3. C1 trae el título con el número de traspaso.
  // Col 2 código, col 3 descripción, col 4 med, col 5 solicitado,
  // col 8 cantidad a entregar, col 10 cantidad a entregar desde CONCON.
  const libro = XLSX.read(traspasoBuffer, { type: "buffer" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
  const numero = numeroEnTitulo(filas[0]?.[2]);
  const items = filas.slice(3).flatMap((fila) => {
    const codigo = fila?.[1];
    if (codigo == null || String(codigo).trim() === "") return [];
    const cantidad = fila?.[4];
    const entregar = fila?.[7];
    const concon = fila?.[9];
    const hayCantidad = [cantidad, entregar, concon].some((valor) => valor != null && valor !== "" && Number(valor) !== 0);
    if (!hayCantidad) return [];
    return [{
      codigo,
      descripcion: fila?.[2] ?? "",
      unidad: fila?.[3] ?? "",
      cantidad: cantidad ?? 0,
      entregar,
      concon,
    }];
  });
  return { items, numero };
}

function itemsDesdeManual(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((fila) => {
    const codigo = String(fila?.codigo ?? "").trim();
    const cantidad = fila?.cantidad;
    if (!codigo) return [];
    if (cantidad == null || cantidad === "" || Number(cantidad) === 0) return [];
    return [{ codigo, unidad: "", cantidad }];
  });
}

async function añadirVenta({ ordenBuffer, ventasBuffer, contratistaIdx, movTipo, almacen, codVenta, colores = true, itemsManuales = null }) {
  const materiales = new Map();
  filasConBodegas().forEach((fila) => {
    materiales.set(String(fila.Codigo ?? "").trim(), fila);
  });
  const contratistas = leerContratistas().filas.map((fila) => String(fila.nombre ?? ""));

  let items;
  let numeroTraspaso = "";
  if (itemsManuales) {
    items = itemsDesdeManual(itemsManuales);
  } else if (!ordenBuffer) {
    const error = new Error("Falta el archivo o la lista de productos.");
    error.status = 400;
    throw error;
  } else if (Number(movTipo) === 2) {
    const traspaso = itemsDesdeTraspaso(ordenBuffer);
    items = traspaso.items;
    numeroTraspaso = traspaso.numero;
  } else {
    items = itemsDesdeOrden(ordenBuffer);
  }
  if (items.length === 0) {
    const error = new Error("No se encontraron productos para cargar.");
    error.status = 400;
    throw error;
  }

  const libro = new ExcelJS.Workbook();
  let hoja;
  if (ventasBuffer) {
    await libro.xlsx.load(ventasBuffer);
    hoja = libro.worksheets[0];
    hoja.eachRow((fila) => {
      fila.eachCell((celda) => {
        if (celda.value === "Comprador") celda.value = "Contratistas";
      });
    });
  } else {
    hoja = libro.addWorksheet("Ventas");
    escribirEncabezadoVentas(hoja, 1, colores);
  }

  let lastPos = 1;
  hoja.eachRow((fila, numero) => {
    if (fila.getCell(1).value === "Pos") lastPos = numero;
  });

  const mov = Number(movTipo) === 2 ? "TRASPASO" : "VENTA";
  const bodegas = new Set(BODEGAS_EXPORT);
  const almacenFila = mov === "VENTA" ? "M501" : (bodegas.has(String(almacen || "").trim()) ? String(almacen).trim() : "M501");
  const codcomp = mov === "TRASPASO"
    ? (numeroTraspaso || "n/a")
    : (codVenta === "" || codVenta == null ? "n/a" : codVenta);
  const contratista = contratistaIdx <= contratistas.length ? contratistas[contratistaIdx - 1] : "n/a";
  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

  hoja.autoFilter = "A1:AJ1";

  let cont = 10;
  const primeraFila = lastPos + 1;
  for (const item of items) {
    const cant = item.cantidad;
    const codMat = String(item.codigo ?? "");
    const material = materiales.get(codMat);
    const stock = (campo) => enteroCelda(material?.[campo]);
    const fila = lastPos + 1;
    const m501 = material ? stock("Stock") : 0;
    const m505 = material ? stock("M505") : 0;
    const cantidad = enteroCelda(cant);

    for (let columna = 1; columna <= 36; columna += 1) {
      const celda = hoja.getCell(fila, columna);
      celda.border = borde;
      celda.font = { bold: true };
    }

    hoja.getCell(fila, 1).value = cont;
    hoja.getCell(fila, 2).value = item.codigo;
    hoja.getCell(fila, 3).value = material?.Descripcion || item.descripcion || "";
    if (material) {
      hoja.getCell(fila, 4).value = material["Ubicación"] ?? "";
    }
    hoja.getCell(fila, 5).value = m501;
    hoja.getCell(fila, 5).font = colores
      ? { bold: true, color: { argb: m501 === 0 ? "FFFF0000" : "FF7CC8FF" } }
      : { bold: true };
    hoja.getCell(fila, 6).value = material ? stock("M502") : 0;
    hoja.getCell(fila, 7).value = material ? stock("M503") : 0;
    hoja.getCell(fila, 8).value = material ? stock("M504") : 0;
    hoja.getCell(fila, 9).value = m505;
    hoja.getCell(fila, 10).value = cant;

    const concon = enteroCelda(item.concon);
    let entregar = 0;
    if (item.entregar != null && item.entregar !== "") {
      const textoEntregar = String(item.entregar).trim().replace(",", ".");
      const numeroEntregar = Number(textoEntregar);
      entregar = Number.isFinite(numeroEntregar) ? numeroEntregar : 0;
    } else if (material && cantidad <= m501) {
      entregar = cant;
    }
    if (concon > 0 || (item.entregar == null && material && m505 > m501 && cantidad > m501)) {
      hoja.getCell(fila, 4).value = "CONCON";
      for (let columna = 1; columna <= 36; columna += 1) {
        hoja.getCell(fila, columna).font = colores ? { bold: true, color: { argb: "FFFF0000" } } : { bold: true };
      }
    } else if (item.entregar == null && material && m505 === 0 && m501 === 0) {
      for (let columna = 1; columna <= 36; columna += 1) {
        hoja.getCell(fila, columna).font = colores ? { bold: true, color: { argb: "FFFF0000" } } : { bold: true };
      }
    }
    hoja.getCell(fila, 11).value = entregar;
    if (concon > 0) {
      hoja.getCell(fila, 22).value = "CONCON";
      hoja.getCell(fila, 31).value = `CONCON ${concon}`;
    }
    hoja.getCell(fila, 12).value = item.unidad;
    hoja.getCell(fila, 13).value = 0;
    hoja.getCell(fila, 14).value = m501 - cantidad;
    hoja.getCell(fila, 15).value = hoja.getCell(fila, 11).value === hoja.getCell(fila, 10).value ? "VERDADERO" : "FALSO";
    const peso = Number(String(material?.Peso ?? "").replace(",", ".").trim());
    hoja.getCell(fila, 16).value = Number.isFinite(peso) ? peso : 0;
    hoja.getCell(fila, 17).value = { formula: `P${fila}*K${fila}` };
    const precio = enteroCelda(material?.Precio);
    hoja.getCell(fila, 18).value = precio;
    hoja.getCell(fila, 19).value = cantidad * precio;
    hoja.getCell(fila, 20).value = contratista;
    hoja.getCell(fila, 21).value = mov;
    hoja.getCell(fila, 22).value = almacenFila;
    hoja.getCell(fila, 23).value = codcomp;
    hoja.getCell(fila, 24).value = concon > 0 ? concon : { formula: `K${fila}` };
    hoja.getCell(fila, 28).value = { formula: `X${fila}-J${fila}` };
    hoja.getCell(fila, 27).value = fecha;
    hoja.getCell(fila, 32).value = cont;
    hoja.getCell(fila, 35).value = { formula: `AG${fila}=B${fila}` };
    hoja.getCell(fila, 36).value = { formula: `AH${fila}=X${fila}` };

    lastPos += 1;
    cont += 10;
  }

  if (items.length > 0) {
    const filaTotal = lastPos + 1;
    for (let columna = 1; columna <= 36; columna += 1) {
      const celda = hoja.getCell(filaTotal, columna);
      celda.border = borde;
      celda.font = { bold: true };
    }
    hoja.getCell(filaTotal, 16).value = "total";
    hoja.getCell(filaTotal, 17).value = { formula: `SUM(Q${primeraFila}:Q${lastPos})` };
    hoja.getCell(filaTotal, 18).value = "Total";
    hoja.getCell(filaTotal, 19).value = { formula: `SUM(S${primeraFila}:S${lastPos})` };
    lastPos += 1;
  }

  escribirEncabezadoVentas(hoja, lastPos + 1, colores);
  for (let columna = 1; columna <= 36; columna += 1) {
    const celda = hoja.getCell(lastPos + 1, columna);
    celda.border = borde;
    celda.font = { ...(celda.font || {}), bold: true };
  }

  libro.worksheets.forEach((planilla) => compactarPlanilla(planilla));
  const buffer = await libro.xlsx.writeBuffer();
  return { buffer, nombre: `VENTAS ${hoy.getFullYear()}.xlsx` };
}

function archivoContratistas() {
  return path.join(__dirname, "bd_comp.xlsx");
}

function leerContratistas() {
  const libro = XLSX.readFile(archivoContratistas());
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  const columnas = (matriz[0] || ["id", "Nombre"]).map((nombre) => String(nombre));
  const filas = matriz.slice(1)
    .filter((fila) => (fila || []).some((celda) => String(celda ?? "").trim() !== ""))
    .map((fila) => ({
      id: fila[0] ?? "",
      nombre: fila[1] ?? "",
    }));
  return { columnas, filas };
}

function guardarContratistas(clave, filas) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  if (!Array.isArray(filas)) {
    const error = new Error("No hay contratistas para guardar.");
    error.status = 400;
    throw error;
  }

  const vistos = new Set();
  const matriz = [["id", "Nombre"]];
  filas.forEach((fila, indice) => {
    const id = String(fila.id ?? "").trim();
    const nombre = String(fila.nombre ?? "").trim();
    if (!id && !nombre) return;
    if (!id || !/^\d+$/.test(id)) {
      const error = new Error(`La fila ${indice + 1} necesita un id numérico.`);
      error.status = 400;
      throw error;
    }
    if (!nombre) {
      const error = new Error(`La fila ${indice + 1} necesita un nombre.`);
      error.status = 400;
      throw error;
    }
    if (vistos.has(id)) {
      const error = new Error(`El id ${id} está repetido.`);
      error.status = 400;
      throw error;
    }
    vistos.add(id);
    matriz.push([Number(id), nombre]);
  });

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Hoja1");
  XLSX.writeFile(libro, archivoContratistas());
  return leerContratistas();
}

function archivoReservas() {
  return path.join(__dirname, "bd_reservas.xlsx");
}

function textoFecha(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const dia = String(valor.getUTCDate()).padStart(2, "0");
    const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");
    return `${dia}/${mes}/${valor.getUTCFullYear()}`;
  }
  if (typeof valor === "number" && valor > 20000 && valor < 80000) {
    const fecha = XLSX.SSF.parse_date_code(valor);
    if (fecha) {
      const dia = String(fecha.d).padStart(2, "0");
      const mes = String(fecha.m).padStart(2, "0");
      return `${dia}/${mes}/${fecha.y}`;
    }
  }
  return valor;
}

function normalizarFechas(columnas, filas) {
  const indices = columnas
    .map((nombre, indice) => (/fecha/i.test(String(nombre)) ? indice : -1))
    .filter((indice) => indice >= 0);
  if (indices.length === 0) return filas;
  return filas.map((fila) => {
    const copia = fila.slice();
    indices.forEach((indice) => {
      copia[indice] = textoFecha(copia[indice]);
    });
    return copia;
  });
}

function leerReservas() {
  const archivo = archivoReservas();
  if (!fs.existsSync(archivo)) return { columnas: [], filas: [] };
  const libro = XLSX.readFile(archivo, { cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return { columnas: [], filas: [] };
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  const columnas = (matriz[0] || []).map((nombre) => String(nombre).trim());
  const filas = normalizarFechas(
    columnas,
    matriz.slice(1).filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""))
  );
  return { columnas, filas };
}

function importarReservas(clave, buffer) {
  if (clave !== CLAVE_DATOS) {
    const error = new Error("Contraseña incorrecta.");
    error.status = 403;
    throw error;
  }
  const libroEntrada = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });
  const encabezados = (matrizEntrada[0] || []).map((nombre) => String(nombre).trim());
  if (!encabezados.some(Boolean)) {
    const error = new Error("La planilla no tiene encabezados.");
    error.status = 400;
    throw error;
  }
  const nuevas = normalizarFechas(
    encabezados,
    matrizEntrada.slice(1).filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""))
  );
  const actual = leerReservas();
  const columnas = actual.columnas.length === 0 ? encabezados : actual.columnas;
  if (actual.columnas.length > 0 && encabezados.join("|") !== actual.columnas.join("|")) {
    const error = new Error("Los encabezados no coinciden con bd_reservas.");
    error.status = 400;
    throw error;
  }
  const indiceOrden = columnas.findIndex((columna) => /^orden$/i.test(String(columna).trim()));
  const indiceReserva = columnas.findIndex((columna) => /^n[ºo°.]?\s*reserva$/i.test(String(columna).trim()));
  const indicePosicion = columnas.findIndex((columna) => /pos\.?reserva/i.test(String(columna).trim()));
  const indiceMaterial = columnas.findIndex((columna) => /^material$/i.test(String(columna).trim()));
  if (indiceOrden < 0 || indiceReserva < 0) {
    const error = new Error("La planilla necesita las columnas Orden y Nº reserva.");
    error.status = 400;
    throw error;
  }
  const textoClave = (fila, indice) => (indice < 0 ? "" : String(fila[indice] ?? "").trim().toLowerCase());
  const claveFila = (fila) =>
    [indiceOrden, indiceReserva, indicePosicion, indiceMaterial].map((indice) => textoClave(fila, indice)).join("|");
  const guardadas = actual.filas.map((fila) => fila.slice());
  const indicePorClave = new Map();
  guardadas.forEach((fila, indice) => indicePorClave.set(claveFila(fila), indice));
  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;
  nuevas.forEach((fila) => {
    const clave = claveFila(fila);
    const existente = indicePorClave.get(clave);
    if (existente == null) {
      indicePorClave.set(clave, guardadas.length);
      guardadas.push(fila);
      agregados += 1;
      return;
    }
    const anterior = guardadas[existente];
    const cambio = columnas.some((_, columna) => String(anterior[columna] ?? "") !== String(fila[columna] ?? ""));
    if (!cambio) {
      omitidos += 1;
      return;
    }
    guardadas[existente] = fila;
    actualizados += 1;
  });
  const matriz = [columnas, ...guardadas];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Reservas");
  XLSX.writeFile(libro, archivoReservas());
  return { agregados, actualizados, omitidos };
}

const ARCHIVO_CARGAS = path.join(__dirname, "ultimas_cargas.json");

function claveCarga(modo, columna) {
  if (modo === "dos-columnas") {
    const destino = String(columna ?? "").trim();
    return destino ? `dos-columnas:${destino}` : "dos-columnas";
  }
  return String(modo || "completa");
}

function leerUltimasCargas() {
  try {
    const datos = JSON.parse(fs.readFileSync(ARCHIVO_CARGAS, "utf8"));
    return datos && typeof datos === "object" ? datos : {};
  } catch {
    return {};
  }
}

function registrarCarga(modo, columna) {
  const cargas = leerUltimasCargas();
  const clave = claveCarga(modo, columna);
  cargas[clave] = new Date().toISOString();
  fs.writeFileSync(ARCHIVO_CARGAS, JSON.stringify(cargas, null, 2));
  return { clave, fecha: cargas[clave], cargas };
}

function indiceEncabezado(columnas, patron) {
  return columnas.findIndex((columna) => patron.test(String(columna).trim()));
}

function celdaReserva(fila, indice) {
  if (indice < 0) return "";
  const valor = textoFecha(fila[indice]);
  return valor ?? "";
}

function numeroReserva(valor) {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const texto = String(valor ?? "").trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function revisionReservas(reserva) {
  const termino = String(reserva ?? "").trim().toLowerCase();
  const { columnas, filas } = leerReservas();
  const vacio = {
    columnas: [],
    filas: [],
    total: filas.length,
    fecha: "",
    solicitante: "",
    movimiento: "",
  };
  if (!termino) return vacio;
  const indiceReserva = indiceEncabezado(columnas, /^n[ºo°.]?\s*reserva$/i);
  const coinciden =
    indiceReserva < 0
      ? []
      : filas.filter((fila) => String(fila[indiceReserva] ?? "").trim().toLowerCase().includes(termino));
  const indice = (patron) => indiceEncabezado(columnas, patron);
  const iOrden = indice(/^orden$/i);
  const iMaterial = indice(/^material$/i);
  const iTexto = indice(/texto breve/i);
  const iCentro = indice(/^centro$/i);
  const iAlmacen = indice(/^almac[eé]n$/i);
  const iNecesaria = indice(/cantidad necesaria/i);
  const iUnidad = indice(/un\.?medida de entrada/i);
  const iFecha = indice(/fecha de necesidad/i);
  const iReducida = indice(/cantid\.?reducidas/i);
  const iDiferencia = indice(/cantidad diferencia/i);
  const iUsuario = indice(/nombre del usuario|solicitante/i);
  const iMovimiento = indice(/^clase de movimiento$/i);

  const materiales = new Map();
  filasConBodegas().forEach((fila) => {
    materiales.set(String(fila.Codigo ?? "").trim(), fila);
  });

  const salida = [
    "N°",
    "N° Orden",
    "N° Reserva",
    "Código",
    "Descripción",
    "Centro",
    "Almacen",
    "Stock",
    "Reserva",
    "UN",
    "Ubicación",
    "Sub Ubicación",
    "Fecha de necesidad",
    "Estado",
    "M502",
    "M503",
    "M504",
    "M505",
    "Reducido",
    "Diferencia",
  ];
  const filasRevision = coinciden.map((fila, posicion) => {
    const codigo = String(celdaReserva(fila, iMaterial)).trim();
    const material = materiales.get(codigo);
    const ubicacion = material ? String(material["Ubicación"] ?? "") : "";
    const lugar = ubicacion.trim() !== "" && ubicacion !== "          " ? material["Ubicación"] : "No se encontro ubicación";
    const stock = material ? numeroReserva(material.Stock) : 0;
    const cantidad = numeroReserva(celdaReserva(fila, iNecesaria));
    const descripcionInventario = material ? String(material.Descripcion ?? "").trim() : "";
    const descripcion = descripcionInventario || String(celdaReserva(fila, iTexto)).trim() || "Sin descripción";
    return [
      posicion + 1,
      celdaReserva(fila, iOrden),
      celdaReserva(fila, indiceReserva),
      codigo,
      descripcion,
      celdaReserva(fila, iCentro),
      celdaReserva(fila, iAlmacen),
      stock,
      cantidad,
      celdaReserva(fila, iUnidad),
      lugar,
      material ? material["Sub-ubicación"] ?? "" : "",
      celdaReserva(fila, iFecha),
      cantidad <= stock ? "Disponible" : "No disponible",
      material ? numeroReserva(material.M502) : 0,
      material ? numeroReserva(material.M503) : 0,
      material ? numeroReserva(material.M504) : 0,
      material ? numeroReserva(material.M505) : 0,
      numeroReserva(celdaReserva(fila, iReducida)),
      numeroReserva(celdaReserva(fila, iDiferencia)),
    ];
  });
  const primera = coinciden[0] || [];
  return {
    columnas: salida,
    filas: filasRevision,
    total: filas.length,
    fecha: celdaReserva(primera, iFecha),
    solicitante: celdaReserva(primera, iUsuario),
    movimiento: celdaReserva(primera, iMovimiento),
  };
}

function buscarReservas(reserva) {
  const revision = revisionReservas(reserva);
  return {
    columnas: revision.columnas,
    filas: revision.filas,
    total: revision.total,
    fecha: revision.fecha,
    solicitante: revision.solicitante,
    movimiento: revision.movimiento,
  };
}

async function exportarRevisionPorReserva(reserva, colores = true) {
  const revision = revisionReservas(reserva);
  if (!String(reserva ?? "").trim()) {
    const error = new Error("Escribí un número de reserva.");
    error.status = 400;
    throw error;
  }
  if (revision.total === 0) {
    const error = new Error("Todavía no hay reservas cargadas.");
    error.status = 400;
    throw error;
  }
  if (revision.filas.length === 0) {
    const error = new Error("No hay reservas con ese número de reserva.");
    error.status = 404;
    throw error;
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Reserva");
  const borde = {
    bottom: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "thin" },
    right: { style: "thin" },
    top: { style: "thin" },
  };
  const encabezado = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA9E5E5" },
  };

  hoja.mergeCells("C1:F1");
  const titulo = hoja.getCell("C1");
  titulo.value = "Revisión Stock de Reserva";
  titulo.font = { bold: true, size: 12 };
  pintar(titulo, encabezado, colores);

  const laterales = [
    [3, "Fecha de necesidad", revision.fecha],
    [5, "Solicitante", revision.solicitante],
    [7, "Clase de movimiento", revision.movimiento],
  ];
  laterales.forEach(([fila, etiqueta, valor]) => {
    const celda = hoja.getCell(fila, 1);
    celda.value = etiqueta;
    celda.font = { bold: true };
    hoja.getCell(fila, 2).value = valor ?? "";
  });

  revision.columnas.forEach((nombre, indice) => {
    const celda = hoja.getCell(3, indice + 3);
    celda.value = nombre;
    celda.font = { bold: true };
    pintar(celda, encabezado, colores);
    celda.border = borde;
  });

  const columnaEstado = revision.columnas.indexOf("Estado");
  revision.filas.forEach((fila, indice) => {
    const numero = indice + 4;
    fila.forEach((valor, columna) => {
      const celda = hoja.getCell(numero, columna + 3);
      celda.value = valor ?? "";
      celda.border = borde;
      if (columna !== columnaEstado) return;
      const color = valor === "Disponible" ? "FF73C883" : "FFF9E37C";
      pintar(celda, { type: "pattern", pattern: "solid", fgColor: { argb: color } }, colores);
    });
  });

  const ultima = Math.max(revision.filas.length + 3, 3);
  hoja.autoFilter = `C3:V${ultima}`;
  hoja.getColumn(1).width = 24;
  hoja.getColumn(3).width = 6;
  hoja.getColumn(7).width = 18;
  hoja.getColumn(9).width = 42;
  hoja.getColumn(15).width = 26;
  compactarPlanilla(hoja);
  return libro.xlsx.writeBuffer();
}

module.exports = {
  leerTabla,
  buscarMaterial,
  marcarMaterial,
  buscarMateriales,
  actualizarMaterial,
  limpiarInventarioComentarios,
  actualizarDatos,
  guardarImagen,
  exportarTabla,
  agregarMaterial,
  eliminarMaterial,
  importarPlanilla,
  importarSap,
  importarPrecios,
  importarUbicaciones,
  importarDosColumnas,
  stockEnBodega,
  exportarStockBodega,
  stockRegional,
  exportarStockRegional,
  planillaInventario,
  planillaInventarioPorBodega,
  exportarPlanillaInventario,
  exportarInventarioBodega,
  stockDetallado,
  exportarStockDetallado,
  armarReserva,
  revisarReserva,
  exportarRevisionReserva,
  leerContratistas,
  guardarContratistas,
  añadirVenta,
  importarReservas,
  buscarReservas,
  exportarRevisionPorReserva,
  leerUltimasCargas,
  registrarCarga,
};
