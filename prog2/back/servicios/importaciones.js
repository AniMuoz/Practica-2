const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { Readable } = require("node:stream");
const {
  BODEGAS_EXPORT,
  bodegaActual,
  CAMPOS_POR_BODEGA,
  nombreCampoBodega,
  CAMPOS_IMAGEN,
  COLUMNAS_EXTRA,
  COLUMNAS_LOCALES_DETALLADO,
  COLUMNA_MARCADO,
  editarMateriales,
  exigirClave,
  guardarMateriales,
  indicePorCodigo,
  ubicarColumnas,
} = require("./nucleoDatos");

async function importarPlanilla(clave, buffer) {
  exigirClave(clave);

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });
  // La planilla trae las columnas visibles de la bodega elegida (Stock, Ubicación, Inventario...):
  // en M502..M505 se traducen a las columnas de esa bodega y las de M501 se conservan.
  const principal = bodegaActual();
  const conservadas = principal === "M501" ? new Set() : new Set(["Stock", ...CAMPOS_POR_BODEGA.map(([titulo]) => titulo)]);
  const encabezados = (matrizEntrada[0] || []).map((nombre) => nombreCampoBodega(String(nombre).trim())).filter(Boolean);

  const { matriz, porCodigo } = editarMateriales();
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const columnasFormato = columnas.filter((columna) => columna !== COLUMNA_MARCADO && !conservadas.has(columna));
  const encabezadosFormato = encabezados.filter((columna) => columna !== COLUMNA_MARCADO);
  const faltan = columnasFormato.filter(
    (columna) =>
      (columna === principal || !COLUMNAS_EXTRA.includes(columna)) &&
      !COLUMNAS_LOCALES_DETALLADO.includes(columna) &&
      !encabezadosFormato.includes(columna),
  );
  const sobran = encabezadosFormato.filter((columna) => !columnasFormato.includes(columna));
  if (faltan.length || sobran.length) {
    const partes = [];
    if (faltan.length) partes.push(`faltan: ${faltan.join(", ")}`);
    if (sobran.length) partes.push(`no corresponden: ${sobran.join(", ")}`);
    const error = new Error(`El formato no coincide con la planilla (${partes.join("; ")}).`);
    error.status = 400;
    throw error;
  }

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
    const columnaInventario = nombreCampoBodega("Inventario");
    const inventarioTexto = String(fila[indicePorNombre[columnaInventario]] ?? "").trim();
    if (inventarioTexto !== "" && !/^-?\d+$/.test(inventarioTexto)) {
      const error = new Error(`Inventario de la fila ${numero} debe ser un número entero.`);
      error.status = 400;
      throw error;
    }

    const indiceExistente = indicePorCodigo(porCodigo, codigoNuevo);
    const filaPrevia = indiceExistente >= 0 ? matriz[indiceExistente] : [];
    const filaNueva = columnas.map((columna, indice) => {
      if (columna === "Codigo") return codigoNuevo;
      if (columna === columnaInventario) return inventarioTexto === "" ? "" : Number(inventarioTexto);
      if (conservadas.has(columna)) return filaPrevia[indice] ?? "";
      const valor = fila[indicePorNombre[columna]];
      if (
        (columna === COLUMNA_MARCADO ||
          COLUMNAS_EXTRA.includes(columna) ||
          COLUMNAS_LOCALES_DETALLADO.includes(columna)) &&
        indicePorNombre[columna] == null
      ) {
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
      porCodigo.set(codigoNuevo, matriz.length - 1);
      agregados += 1;
    }
  });

  await guardarMateriales(matriz);
  return { agregados, actualizados };
}

async function importarSap(clave, buffer) {
  exigirClave(clave);

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });

  const { matriz, porCodigo } = editarMateriales();
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

  const { indices: cols, fila: filaEncSap } = ubicarColumnas(matrizEntrada, {
    codigo: ["Material", "matnr"],
    descripcion: ["Texto breve de material", "Descripcion"],
    planta: ["Almacén", "lgort"],
    stock: ["Libre utilización", "Stock"],
  });
  matrizEntrada.slice(filaEncSap + 1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + filaEncSap + 2;
    const codigo = String(fila[cols.codigo] ?? "").trim();
    const descripcion = fila[cols.descripcion] ?? "";
    const planta = String(fila[cols.planta] ?? "").trim();
    const stock = fila[cols.stock] ?? "";
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
    const indiceExistente = indicePorCodigo(porCodigo, codigo);
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
    porCodigo.set(codigo, matriz.length - 1);
    agregados += 1;
  });

  const encabezado = matriz[0];
  const filasSap = new Map();
  const fueraDelExport = [];
  for (let indice = 1; indice < matriz.length; indice += 1) {
    const codigoFila = String(matriz[indice][indiceCodigo] ?? "").trim();
    if (vistosSap.has(codigoFila) && !filasSap.has(codigoFila)) filasSap.set(codigoFila, matriz[indice]);
    else if (!vistosSap.has(codigoFila)) fueraDelExport.push(matriz[indice]);
  }
  const ordenadas = ordenSap.map((codigoFila) => filasSap.get(codigoFila)).filter(Boolean);
  matriz.splice(0, matriz.length, encabezado, ...ordenadas, ...fueraDelExport);

  await guardarMateriales(matriz);
  return { agregados, actualizados, omitidos };
}

async function importarPrecios(clave, buffer) {
  exigirClave(clave);

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });

  const { matriz, porCodigo } = editarMateriales();
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

  const { indices: cols, fila: filaEnc } = ubicarColumnas(matrizEntrada, {
    codigo: ["Material", "matnr"],
    descripcion: ["Texto breve de material", "Descripcion"],
    precio: ["Nuevos precios", "Precio"],
  });
  matrizEntrada.slice(filaEnc + 1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + filaEnc + 2;
    const codigo = String(fila[cols.codigo] ?? "").trim();
    const descripcion = fila[cols.descripcion] ?? "";
    const precio = fila[cols.precio] ?? "";
    if (!codigo && String(descripcion).trim() === "" && String(precio).trim() === "") return;
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }

    const indiceExistente = indicePorCodigo(porCodigo, codigo);
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
    porCodigo.set(codigo, matriz.length - 1);
    agregados += 1;
  });

  await guardarMateriales(matriz);
  return { agregados, actualizados };
}

// Lee solo la primera hoja en streaming y conserva código, almacén y ubicación de cada fila.
// Un archivo de SAP con ~100.000 filas no se carga entero en memoria.
async function leerUbicacionesXlsx(buffer) {
  const lector = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([buffer]), {
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
    worksheets: "emit",
  });
  const requeridas = {
    codigo: ["matnr", "Material"],
    planta: ["lgort", "Almacén"],
    ubicacion: ["lgpbe", "Ubicación"],
  };
  const textos = (fila) => Array.from({ length: fila.cellCount }, (_, i) => fila.getCell(i + 1).text);
  const inicio = [];
  const registros = [];
  let cols = null;
  let hojas = 0;

  function agregarFila(valores, numero) {
    const codigo = String(valores[cols.codigo] ?? "").trim();
    const planta = String(valores[cols.planta] ?? "").trim();
    const ubicacion = String(valores[cols.ubicacion] ?? "").trim();
    if (!codigo && planta === "" && ubicacion === "") return;
    registros.push({ numero, codigo, planta, ubicacion });
  }

  // Los encabezados se buscan en las primeras 10 filas; después solo se extraen las 3 columnas.
  function fijarEncabezados() {
    const { indices, fila } = ubicarColumnas(inicio, requeridas);
    cols = indices;
    inicio.slice(fila + 1).forEach((previa, i) => agregarFila(previa, fila + i + 2));
  }

  try {
    for await (const hoja of lector) {
      hojas += 1;
      if (hojas > 1) break;
      for await (const fila of hoja) {
        if (cols) {
          agregarFila(textos(fila), fila.number);
          continue;
        }
        inicio.push(textos(fila));
        if (inicio.length >= 10) fijarEncabezados();
      }
    }
  } catch (error) {
    if (error.status) throw error;
    // Archivos con el zip en otro orden (p. ej. generados por otras librerías): lectura completa de la primera hoja.
    const libro = XLSX.read(buffer, { type: "buffer", sheets: 0 });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    if (!hoja) {
      const sinHojas = new Error("El archivo no tiene hojas.");
      sinHojas.status = 400;
      throw sinHojas;
    }
    registros.length = 0;
    inicio.length = 0;
    cols = null;
    XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" }).forEach((valores, i) => {
      if (cols) return agregarFila(valores, i + 1);
      inicio.push(valores);
      if (inicio.length >= 10) fijarEncabezados();
    });
    if (!cols) fijarEncabezados();
    return registros;
  }
  if (hojas === 0) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  if (!cols) fijarEncabezados();
  return registros;
}

async function importarUbicaciones(clave, buffer) {
  exigirClave(clave);

  const filasEntrada = await leerUbicacionesXlsx(buffer);

  const { matriz, porCodigo } = editarMateriales();
  let columnas = (matriz[0] || []).map((nombre) => String(nombre));
  for (const extra of COLUMNAS_EXTRA) {
    if (!columnas.includes(extra)) columnas.push(extra);
  }
  matriz[0] = columnas;

  const indiceCodigo = columnas.indexOf("Codigo");
  // Cada fila va a las columnas de su propio almacén (M501..M505), sin depender de la bodega activa.
  const destinos = {};
  for (const bodega of BODEGAS_EXPORT) {
    destinos[bodega] = {
      ubicacion: columnas.indexOf(nombreCampoBodega("Ubicación", bodega)),
      sub: columnas.indexOf(nombreCampoBodega("Sub-ubicación", bodega)),
    };
  }
  if (indiceCodigo < 0 || Object.values(destinos).some((d) => d.ubicacion < 0 || d.sub < 0)) {
    const error = new Error("La tabla no tiene las columnas Codigo, Ubicación y Sub-ubicación de cada bodega.");
    error.status = 500;
    throw error;
  }

  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const porBodega = Object.fromEntries(BODEGAS_EXPORT.map((b) => [b, { agregados: 0, actualizados: 0 }]));

  filasEntrada.forEach(({ numero, codigo, planta, ubicacion }) => {
    if (!destinos[planta]) {
      omitidos += 1;
      return;
    }
    if (!codigo) {
      const error = new Error(`La fila ${numero} no tiene código.`);
      error.status = 400;
      throw error;
    }

    const { ubicacion: indiceUbicacion, sub: indiceSub } = destinos[planta];
    const sub = ubicacion.slice(0, 4);
    const indiceExistente = indicePorCodigo(porCodigo, codigo);
    if (indiceExistente >= 0) {
      matriz[indiceExistente][indiceUbicacion] = ubicacion;
      matriz[indiceExistente][indiceSub] = sub;
      actualizados += 1;
      porBodega[planta].actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceUbicacion] = ubicacion;
    filaNueva[indiceSub] = sub;
    matriz.push(filaNueva);
    porCodigo.set(codigo, matriz.length - 1);
    agregados += 1;
    porBodega[planta].agregados += 1;
  });

  await guardarMateriales(matriz);
  return { agregados, actualizados, omitidos, porBodega };
}

async function importarDosColumnas(clave, buffer, columnaDestino) {
  exigirClave(clave);
  const destino = nombreCampoBodega(String(columnaDestino ?? "").trim());
  if (!destino || ["Codigo", "Inventario", "Comentario", "Editor"].includes(destino) || /^(Inventario|Comentario|Editor) M50\d$/.test(destino)) {
    const error = new Error("Elige una columna válida para actualizar.");
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

  const { matriz, porCodigo } = editarMateriales();
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

    const indiceExistente = indicePorCodigo(porCodigo, codigo);
    if (indiceExistente >= 0) {
      matriz[indiceExistente][indiceDestino] = valor;
      actualizados += 1;
      return;
    }

    const filaNueva = columnas.map(() => "");
    filaNueva[indiceCodigo] = codigo;
    filaNueva[indiceDestino] = valor;
    matriz.push(filaNueva);
    porCodigo.set(codigo, matriz.length - 1);
    agregados += 1;
  });

  await guardarMateriales(matriz);
  return { agregados, actualizados };
}

module.exports = {
  importarPlanilla,
  importarSap,
  importarPrecios,
  importarUbicaciones,
  importarDosColumnas,
};
