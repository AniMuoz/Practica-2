const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");

const BODEGAS_EXTRA = ["M502", "M503", "M504", "M505"];
const BODEGAS_EXPORT = ["M501", ...BODEGAS_EXTRA];
const COLUMNAS_OCULTAS = new Set(BODEGAS_EXTRA);
const COLUMNAS_EXTRA = ["Rombo", "QR", ...BODEGAS_EXTRA];
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
  if (!encabezadoGuardado.map((nombre) => String(nombre)).includes(COLUMNA_STOCK_CRITICO)) {
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
  if (!/^-?\d+$/.test(String(inventario).trim())) {
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

  matriz[indiceFila][indiceInventario] = Number(String(inventario).trim());
  matriz[indiceFila][indiceComentario] = String(comentario ?? "");
  libro.Sheets[nombreHoja] = XLSX.utils.aoa_to_sheet(sinFilasVacias(matriz));
  XLSX.writeFile(libro, archivo);

  return buscarMaterial(codigo);
}

const COLUMNAS_BLOQUEADAS = new Set(["Inventario", "Comentario", "Rombo", "QR"]);
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
  if (campo !== "Rombo" && campo !== "QR") {
    const error = new Error("La imagen debe ser Rombo o QR.");
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
    if (columna === "Rombo" || columna === "QR") return filaPrevia[indice] ?? "";
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
      if ((columna === "Rombo" || columna === "QR") && String(valor ?? "").trim() === "") {
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

async function exportarTabla() {
  const { columnas, filas } = leerTabla();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Inventario");
  hoja.addRow(columnas);
  filas.forEach((fila) => {
    hoja.addRow(columnas.map((columna) => fila[columna] ?? ""));
  });

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true };
  encabezado.eachCell((celda) => {
    celda.font = { bold: true };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA9E5E5" },
    };
  });

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

module.exports = {
  leerTabla,
  buscarMaterial,
  actualizarMaterial,
  actualizarDatos,
  guardarImagen,
  exportarTabla,
  agregarMaterial,
  importarPlanilla,
  importarSap,
  importarPrecios,
  importarUbicaciones,
  importarDosColumnas,
};
