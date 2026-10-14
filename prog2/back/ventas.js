const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { BODEGAS_EXPORT, claveColumna } = require("./nucleoDatos");
const { compactarPlanilla, filasConBodegas, pintar } = require("./planillasStock");
const { leerContratistas } = require("./contratistas");

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

function columnaPorTitulo(claves, ...opciones) {
  for (const opcion of opciones) {
    const indice = claves.findIndex((clave) => (typeof opcion === "function" ? opcion(clave) : clave === opcion));
    if (indice >= 0) return indice;
  }
  return -1;
}

function itemsDesdeOrden(ordenBuffer) {
  const libroOrden = XLSX.read(ordenBuffer, { type: "buffer" });
  const nombrePedido = libroOrden.SheetNames.find((nombre) => nombre.toLowerCase().includes("pedido")) || libroOrden.SheetNames[0];
  const orden = XLSX.utils.sheet_to_json(libroOrden.Sheets[nombrePedido], { header: 1, defval: null });
  const encabezado = orden.findIndex((fila) => (fila || []).some((celda) => claveColumna(celda) === "solicitado"));
  if (encabezado < 0) throw new Error("No se encontró el encabezado \"Solicitado\" en la orden de venta.");
  const claves = (orden[encabezado] || []).map(claveColumna);
  const colCodigo = columnaPorTitulo(claves, "codigo");
  const colUnidad = columnaPorTitulo(claves, "un", "med", "unidad");
  const colSolicitado = columnaPorTitulo(claves, "solicitado");
  if (colCodigo < 0) throw new Error("No se encontró el encabezado \"Código\" en la orden de venta.");
  return orden.slice(encabezado + 1).flatMap((fila) => {
    const cantidad = fila?.[colSolicitado];
    if (cantidad == null || cantidad === "" || Number(cantidad) === 0) return [];
    return [{
      codigo: fila?.[colCodigo],
      unidad: colUnidad >= 0 ? fila?.[colUnidad] : "",
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
  // Las columnas se ubican por el nombre del encabezado (la posición puede cambiar).
  const libro = XLSX.read(traspasoBuffer, { type: "buffer" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
  const numero = numeroEnTitulo(filas[0]?.[2]);
  const filaEnc = filas.findIndex((fila) => (fila || []).some((celda) => claveColumna(celda) === "codigo"));
  if (filaEnc < 0) throw new Error("No se encontró el encabezado \"Código\" en el traspaso.");
  const claves = (filas[filaEnc] || []).map(claveColumna);
  const colCodigo = columnaPorTitulo(claves, "codigo");
  const colDescripcion = columnaPorTitulo(claves, (c) => c.startsWith("descrip"));
  const colUnidad = columnaPorTitulo(claves, "medida", "med", "un", "unidad", (c) => c.startsWith("medida"));
  const colCantidad = columnaPorTitulo(claves, (c) => c.startsWith("solicit"));
  const colConcon = columnaPorTitulo(claves, (c) => c.includes("concon"));
  const colEntregar = columnaPorTitulo(claves, (c) => c.includes("entregar") && !c.includes("concon"));
  const valorEn = (fila, indice) => (indice >= 0 ? fila?.[indice] : undefined);
  const items = filas.slice(filaEnc + 1).flatMap((fila) => {
    const codigo = valorEn(fila, colCodigo);
    if (codigo == null || String(codigo).trim() === "") return [];
    const cantidad = valorEn(fila, colCantidad);
    const entregar = valorEn(fila, colEntregar);
    const concon = valorEn(fila, colConcon);
    const hayCantidad = [cantidad, entregar, concon].some((valor) => valor != null && valor !== "" && Number(valor) !== 0);
    if (!hayCantidad) return [];
    return [{
      codigo,
      descripcion: valorEn(fila, colDescripcion) ?? "",
      unidad: valorEn(fila, colUnidad) ?? "",
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
  const numeroIngresado = codVenta === "" || codVenta == null ? "n/a" : codVenta;
  const codcomp = mov === "TRASPASO"
    ? (numeroTraspaso || numeroIngresado)
    : numeroIngresado;
  const contratista = contratistaIdx <= contratistas.length ? contratistas[contratistaIdx - 1] : "n/a";
  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
  const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

  hoja.autoFilter = "A1:AJ1";

  let cont = 10;
  const primeraFila = lastPos + 1;
  const descripcionDe = (item) => String(
    materiales.get(String(item.codigo ?? ""))?.Descripcion || item.descripcion || "",
  ).trim();
  items = items
    .map((item) => ({ item, desc: descripcionDe(item) }))
    .sort((a, b) => a.desc.localeCompare(b.desc, "es", { sensitivity: "base" }))
    .map(({ item }) => item);

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
    const descFila = descripcionDe(item);
    if (/^ca[ñn]er[ií]a/i.test(descFila)) {
      hoja.getCell(fila, 13).value = Math.round(Number(String(cant).replace(",", ".")) / 6);
    } else if (/^\s*kgs?\.?\s*$/i.test(String(item.unidad ?? ""))) {
      const mg = descFila.match(/(\d+(?:[.,]\d+)?)\s*GRS?\b/i);
      const mk = descFila.match(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*KGS?\b|(\d+(?:[.,]\d+)?)\s*KGS?\b/i);
      let kilosUnidad = null;
      if (mg) {
        kilosUnidad = Number(mg[1].replace(",", ".")) / 1000;
      } else if (mk) {
        kilosUnidad = mk[2]
          ? Number(mk[1] || 0) + Number(mk[2]) / Number(mk[3])
          : Number(mk[4].replace(",", "."));
      }
      if (kilosUnidad != null) {
        const total = kilosUnidad * Number(String(cant).replace(",", "."));
        if (Number.isFinite(total)) hoja.getCell(fila, 13).value = Math.round(total * 1000) / 1000;
      }
    }
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

module.exports = {
  enteroReserva,
  armarReserva,
  revisarReserva,
  exportarRevisionReserva,
  enteroCelda,
  escribirEncabezadoVentas,
  columnaPorTitulo,
  itemsDesdeOrden,
  numeroEnTitulo,
  itemsDesdeTraspaso,
  itemsDesdeManual,
  añadirVenta,
};
