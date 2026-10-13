const XLSX = require("xlsx");
const {
  BODEGAS_EXPORT,
  CAMPOS_IMAGEN,
  COLUMNAS_EXTRA,
  COLUMNA_MARCADO,
  editarMateriales,
  exigirClave,
  guardarMateriales,
  indicePorCodigo,
  ubicarColumnas,
} = require("./nucleoDatos");

function importarPlanilla(clave, buffer) {
  exigirClave(clave);

  const libroEntrada = XLSX.read(buffer, { type: "buffer" });
  const hojaEntrada = libroEntrada.Sheets[libroEntrada.SheetNames[0]];
  if (!hojaEntrada) {
    const error = new Error("El archivo no tiene hojas.");
    error.status = 400;
    throw error;
  }
  const matrizEntrada = XLSX.utils.sheet_to_json(hojaEntrada, { header: 1, defval: "" });
  const encabezados = (matrizEntrada[0] || []).map((nombre) => String(nombre).trim()).filter(Boolean);

  const { matriz, porCodigo } = editarMateriales();
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

    const indiceExistente = indicePorCodigo(porCodigo, codigoNuevo);
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
      porCodigo.set(codigoNuevo, matriz.length - 1);
      agregados += 1;
    }
  });

  guardarMateriales(matriz);
  return { agregados, actualizados };
}

function importarSap(clave, buffer) {
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

  guardarMateriales(matriz);
  return { agregados, actualizados, omitidos };
}

function importarPrecios(clave, buffer) {
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

  guardarMateriales(matriz);
  return { agregados, actualizados };
}

function importarUbicaciones(clave, buffer) {
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

  const { indices: cols, fila: filaEnc } = ubicarColumnas(matrizEntrada, {
    codigo: ["matnr", "Material"],
    planta: ["lgort", "Almacén"],
    ubicacion: ["lgpbe", "Ubicación"],
  });
  matrizEntrada.slice(filaEnc + 1).forEach((fila, desplazamiento) => {
    const numero = desplazamiento + filaEnc + 2;
    const codigo = String(fila[cols.codigo] ?? "").trim();
    const planta = String(fila[cols.planta] ?? "").trim();
    const ubicacion = String(fila[cols.ubicacion] ?? "").trim();
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
    const indiceExistente = indicePorCodigo(porCodigo, codigo);
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
    porCodigo.set(codigo, matriz.length - 1);
    agregados += 1;
  });

  guardarMateriales(matriz);
  return { agregados, actualizados, omitidos };
}

function importarDosColumnas(clave, buffer, columnaDestino) {
  exigirClave(clave);
  const destino = String(columnaDestino ?? "").trim();
  if (!destino || ["Codigo", "Inventario", "Comentario"].includes(destino)) {
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

  guardarMateriales(matriz);
  return { agregados, actualizados };
}

module.exports = {
  importarPlanilla,
  importarSap,
  importarPrecios,
  importarUbicaciones,
  importarDosColumnas,
};
