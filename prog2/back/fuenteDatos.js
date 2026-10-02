const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const BODEGAS_EXTRA = ["M502", "M503", "M504", "M505"];
const BODEGAS_EXPORT = ["M501", ...BODEGAS_EXTRA];
const COLUMNAS_OCULTAS = new Set(BODEGAS_EXTRA);
const COLUMNAS_EXTRA = ["Rombo", "QR", "Foto", ...BODEGAS_EXTRA];
const CAMPOS_IMAGEN = new Set(["Rombo", "QR", "Foto"]);
const COLUMNA_STOCK_CRITICO = "Stock critico";

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

function leerMatriz(libro) {
  const nombreHoja = libro.SheetNames[0];
  const matriz = conStockCritico(
    XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, defval: "" })
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
  if (faltaFoto) {
    const columnasArchivo = (matriz[0] || []).map((nombre) => String(nombre));
    if (!columnasArchivo.includes("Foto")) {
      columnasArchivo.push("Foto");
      matriz[0] = columnasArchivo;
    }
  }
  if (!encabezadosGuardados.includes(COLUMNA_STOCK_CRITICO) || faltaFoto) {
    libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
    try {
      XLSX.writeFile(libro, archivo);
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

  const filas = sinFilasVacias(matriz).slice(1).map((fila) => {
    const registro = {};
    visibles.forEach((columna) => {
      registro[columna] = fila[columnas.indexOf(columna)] ?? "";
    });
    return registro;
  });

  return { columnas: visibles, filas };
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
  const textoStock = fila == null ? "" : String(fila.Stock ?? "").trim();
  const stockCero = textoStock !== "" && Number(textoStock) === 0;
  const sinStock = fila != null && (textoStock === "" || stockCero);
  const bodegas = sinStock ? stockPorBodega(buscado) : [];
  return { columnas, fila, bodegas: stockCero ? bodegas.filter((item) => item.bodega !== "M501") : bodegas };
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

function limpiarInventarioComentarios() {
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

const COLUMNAS_BLOQUEADAS = new Set(["Inventario", "Comentario", "Rombo", "QR", "Foto"]);
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
    if (CAMPOS_IMAGEN.has(columna)) return filaPrevia[indice] ?? "";
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

  const faltan = columnas.filter((columna) => !encabezados.includes(columna));
  const sobran = encabezados.filter((columna) => !columnas.includes(columna));
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

async function exportarStockBodega(colores = true) {
  const { columnas, filas } = stockEnBodega();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("M501");
  hoja.getColumn(1).width = 20;
  hoja.getColumn(2).width = 52;
  hoja.getColumn(3).width = 20;

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

  hoja.getCell("A1").value = "Almacen";
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
  hoja.getColumn(1).width = 20;
  hoja.getColumn(2).width = 52;
  for (let indice = 3; indice <= 8; indice += 1) hoja.getColumn(indice).width = 15;

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
  hoja.getColumn(1).width = 20;
  hoja.getColumn(2).width = 52;
  hoja.getColumn(3).width = 20;
  hoja.getColumn(4).width = 15;
  hoja.getColumn(5).width = 15;
  hoja.getColumn(6).width = 25;

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
  hoja.getCell("A1").value = "Almacen";
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
  return libro.xlsx.writeBuffer();
}

async function exportarPlanillaInventario(colores = true) {
  const { filas } = planillaInventario();
  return armarPlanillaInventario(filas, "M501", colores);
}

async function exportarInventarioBodega(codigo, colores = true) {
  const { grupos } = planillaInventarioPorBodega();
  const filas = grupos.get(String(codigo));
  if (!filas) {
    const error = new Error("No hay materiales para esa bodega.");
    error.status = 404;
    throw error;
  }
  return armarPlanillaInventario(filas, String(codigo), colores);
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
  const resultado = filas
    .filter((fila) => String(fila.Descripcion ?? "").trim() !== "NULO")
    .map((fila) => {
      const ubicacion = String(fila["Ubicación"] ?? "").trim();
      const precioTexto = String(fila.Precio ?? "").trim();
      const precio = precioTexto === "" ? "Sin precio" : `$${precioTexto}`;
      const cantidades = [fila.Stock, fila.M502, fila.M503, fila.M504, fila.M505].map((valor) => valorStock(valor) ?? "");
      const total = cantidades.reduce((suma, valor) => suma + (typeof valor === "number" ? valor : Number(valor) || 0), 0);
      return [
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
      ];
    });
  return { columnas, filas: resultado };
}

function colorStockDetallado(valor) {
  if (valor === 0 || valor === "0") return "FFD3D3D3";
  if (valor == null || valor === "" || valor === "          " || valor === "Sin precio") return "FFF9E37C";
  return "FF73C883";
}

async function exportarStockDetallado(colores = true) {
  const { columnas, filas } = stockDetallado();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Stock detallado");
  const anchos = [15, 10, 52, 8, 15, 30, 8, 8, 8, 8, 10, 18, 15, 15, 15, 18];
  anchos.forEach((ancho, indice) => {
    hoja.getColumn(indice + 1).width = ancho;
  });

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
      pintar(celda, { type: "pattern", pattern: "solid", fgColor: { argb: colorStockDetallado(valor) } }, colores);
    });
  });

  const ultima = Math.max(filas.length + 3, 3);
  hoja.autoFilter = `A3:P${ultima}`;
  return libro.xlsx.writeBuffer();
}

async function exportarTabla(colores = true) {
  const tabla = leerTabla();
  const columnas = tabla.columnas.filter((columna) => !CAMPOS_IMAGEN.has(columna));
  const filas = tabla.filas;
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
    columnas.forEach((columna, indice) => {
      hoja.getColumn(indice + 1).width = Math.max(String(columna).length + 2, 14);
    });
  }

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
  [8, 18, 15, 52, 12, 12, 25, 16].forEach((ancho, indice) => {
    hoja.getColumn(indice + 1).width = ancho;
  });

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

async function añadirVenta({ ordenBuffer, ventasBuffer, contratistaIdx, movTipo, codVenta, colores = true }) {
  const materiales = new Map();
  filasConBodegas().forEach((fila) => {
    materiales.set(String(fila.Codigo ?? "").trim(), fila);
  });
  const contratistas = leerContratistas().filas.map((fila) => String(fila.nombre ?? ""));

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
  const items = orden.slice(encabezado + 1).flatMap((fila) => {
    const cantidad = fila?.[colSolicitado];
    if (cantidad == null || cantidad === "" || Number(cantidad) === 0) return [];
    return [{
      codigo: fila?.[colCodigo],
      unidad: fila?.[colUnidad],
      cantidad,
    }];
  });

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
  const codcomp = mov === "TRASPASO" ? "n/a" : (codVenta === "" || codVenta == null ? "n/a" : codVenta);
  const contratista = contratistaIdx <= contratistas.length ? contratistas[contratistaIdx - 1] : "n/a";
  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

  const anchos = {
    A: 5, C: 50, D: 12, E: 7, F: 7, G: 7, H: 7, I: 7, J: 7, K: 7, L: 4, M: 4, N: 6, O: 11,
    P: 6, Q: 6, R: 7, S: 9, T: 12, U: 9, V: 6, W: 7, X: 8, Y: 8, Z: 13, AA: 10, AB: 9,
    AC: 9, AD: 9, AE: 35, AF: 5, AH: 10, AI: 18, AJ: 18,
  };
  Object.entries(anchos).forEach(([letra, ancho]) => {
    hoja.getColumn(letra).width = ancho;
  });
  hoja.autoFilter = "A1:AJ1";

  let cont = 10;
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
    if (material) {
      hoja.getCell(fila, 3).value = material.Descripcion ?? "";
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

    let entregar = 0;
    if (material && cantidad <= m501) entregar = cant;
    else if (material && m505 > m501) {
      hoja.getCell(fila, 4).value = "CONCON";
      for (let columna = 1; columna <= 36; columna += 1) {
        hoja.getCell(fila, columna).font = colores ? { bold: true, color: { argb: "FFFF0000" } } : { bold: true };
      }
    } else if (material && m505 === 0 && m501 === 0) {
      for (let columna = 1; columna <= 36; columna += 1) {
        hoja.getCell(fila, columna).font = colores ? { bold: true, color: { argb: "FFFF0000" } } : { bold: true };
      }
    }
    hoja.getCell(fila, 11).value = entregar;
    hoja.getCell(fila, 12).value = item.unidad;
    hoja.getCell(fila, 13).value = 0;
    hoja.getCell(fila, 14).value = m501 - cantidad;
    hoja.getCell(fila, 15).value = hoja.getCell(fila, 11).value === hoja.getCell(fila, 10).value ? "VERDADERO" : "FALSO";
    hoja.getCell(fila, 16).value = 0;
    hoja.getCell(fila, 17).value = { formula: `P${fila}*J${fila}` };
    const precio = enteroCelda(material?.Precio);
    hoja.getCell(fila, 18).value = precio;
    hoja.getCell(fila, 19).value = cantidad * precio;
    hoja.getCell(fila, 20).value = contratista;
    hoja.getCell(fila, 21).value = mov;
    hoja.getCell(fila, 23).value = codcomp;
    hoja.getCell(fila, 24).value = { formula: `K${fila}` };
    hoja.getCell(fila, 28).value = { formula: `X${fila}-J${fila}` };
    hoja.getCell(fila, 27).value = fecha;
    hoja.getCell(fila, 32).value = cont;
    hoja.getCell(fila, 35).value = { formula: `AG${fila}=B${fila}` };
    hoja.getCell(fila, 36).value = { formula: `AH${fila}=X${fila}` };

    lastPos += 1;
    cont += 10;
  }

  escribirEncabezadoVentas(hoja, lastPos + 1, colores);
  for (let columna = 1; columna <= 36; columna += 1) {
    const celda = hoja.getCell(lastPos + 1, columna);
    celda.border = borde;
    celda.font = { ...(celda.font || {}), bold: true };
  }

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

module.exports = {
  leerTabla,
  buscarMaterial,
  actualizarMaterial,
  limpiarInventarioComentarios,
  actualizarDatos,
  guardarImagen,
  exportarTabla,
  agregarMaterial,
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
};
