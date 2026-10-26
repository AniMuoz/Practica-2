const ExcelJS = require("exceljs");
const {
  CAMPOS_IMAGEN,
  cargarMateriales,
  leerTabla,
  textoBusqueda,
} = require("./nucleoDatos");

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
  Object.entries(hoja._merges || {}).forEach(([direccion, rango]) => {
    const modelo = rango && rango.model;
    if (modelo && modelo.left !== modelo.right) titulosCombinados.add(String(direccion).replace(/\$/g, ""));
  });
  const anchos = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    fila.eachCell({ includeEmpty: false }, (celda) => {
      if (titulosCombinados.has(celda.address)) return;
      const columna = celda.col - 1;
      let maximo = anchos[columna] || 0;
      textoVisible(celda.value).split(/\r?\n/).forEach((linea) => {
        if (linea.length > maximo) maximo = linea.length;
      });
      anchos[columna] = maximo;
    });
  });
  anchos.forEach((maximo, indice) => {
    if (maximo > 0) hoja.getColumn(indice + 1).width = maximo + 1;
  });
}

async function exportarStockBodega(colores = true, filtros = null) {
  const { columnas, filas: todas } = stockEnBodega();
  const { filas } = filtrarPorCodigos(todas, 0, filtros);
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
  return cargarMateriales().filasBodega;
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

async function exportarStockRegional(colores = true, filtros = null) {
  const { columnas, filas: todas } = stockRegional();
  const { filas } = filtrarPorCodigos(todas, 0, filtros);
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

const POSICIONES_INVENTARIO = { libre: 4, destino: 5, inventario: 6 };

function aplicarExistencia(filas, origen, { libre, destino, inventario } = POSICIONES_INVENTARIO) {
  return filas.map((fila) => {
    const copia = fila.slice(0, destino + 1);
    if (origen === "libre") copia[destino] = fila[libre];
    if (origen === "inventario") copia[destino] = fila[inventario] ?? "";
    return copia;
  });
}

async function exportarPlanillaInventario(colores = true, origenExistencia = "", filtros = null) {
  const { filas: todas } = planillaInventario();
  const { filas } = filtrarPorCodigos(todas, 0, filtros);
  return armarPlanillaInventario(aplicarExistencia(filas, origenExistencia), "M501", colores);
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

async function exportarStockDetallado(colores = true, filtros = null) {
  const completo = stockDetallado();
  const { columnas } = completo;
  const { filas, marcados } = filtrarPorCodigos(completo.filas, 1, filtros, completo.marcados);
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
      const color = marcados[indice] && COLUMNAS_MARCA_DETALLADO.has(columna) ? "FF00FF00" : colorStockDetallado(valor);
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
  if (filtros.soloStockCero) {
    lista = lista.filter((fila) => Number(String(fila.Stock ?? "").trim()) === 0);
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
  if (filtros.soloConRombo) {
    lista = lista.filter((fila) => /\.(png|jpe?g|webp|gif)$/i.test(String(fila.Rombo ?? "").trim()));
  }
  if (filtros.ignorarNulo) {
    lista = lista.filter((fila) => String(fila.Descripcion ?? "").trim().toUpperCase() !== "NULO");
  }
  const consulta = textoBusqueda(filtros.texto);
  if (consulta.length >= 2) {
    lista = lista.filter((fila) => {
      const codigo = textoBusqueda(fila.Codigo);
      const descripcion = textoBusqueda(fila.Descripcion);
      return codigo.includes(consulta) || descripcion.includes(consulta);
    });
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
  } else if (orden === "ubicacion" || orden === "ubicacion-asc") {
    // Por bodega (01, 02...) y dentro de ella alfabético; sin ubicación siempre al final.
    const sentido = orden === "ubicacion" ? -1 : 1;
    lista = [...lista].sort((a, b) => {
      const ua = String(a["Ubicación"] ?? "").trim();
      const ub = String(b["Ubicación"] ?? "").trim();
      if (!ua && !ub) return 0;
      if (!ua) return 1;
      if (!ub) return -1;
      return ua.localeCompare(ub, "es", { numeric: true, sensitivity: "base" }) * sentido;
    });
  } else if (orden === "descripcion" || orden === "descripcion-desc") {
    const sentido = orden === "descripcion" ? 1 : -1;
    lista = [...lista].sort((a, b) =>
      String(a.Descripcion ?? "").localeCompare(String(b.Descripcion ?? ""), "es", { sensitivity: "base" }) * sentido
    );
  }
  return lista;
}

// Filtra filas de una planilla con los mismos filtros de la tabla principal.
// Deja solo los códigos que pasan el filtro y los ordena como la tabla filtrada.
function filtrarPorCodigos(filas, indiceCodigo, filtros, marcados, conservarOrden = false) {
  if (!filtros) return { filas, marcados };
  const orden = new Map(aplicarFiltrosTabla(leerTabla().filas, filtros).map((f, i) => [String(f.Codigo), i]));
  const pares = filas
    .map((fila, i) => ({ fila, i }))
    .filter(({ fila }) => orden.has(String(fila[indiceCodigo])));
  if (!conservarOrden) pares.sort((a, b) => orden.get(String(a.fila[indiceCodigo])) - orden.get(String(b.fila[indiceCodigo])));
  return { filas: pares.map((p) => p.fila), marcados: marcados ? pares.map((p) => marcados[p.i]) : undefined };
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

module.exports = {
  columnaExcel,
  stockEnBodega,
  pintar,
  textoVisible,
  compactarPlanilla,
  exportarStockBodega,
  valorStock,
  filasConBodegas,
  stockRegional,
  exportarStockRegional,
  claveUbicacion,
  planillaInventario,
  armarPlanillaInventario,
  aplicarExistencia,
  exportarPlanillaInventario,
  stockDetallado,
  colorStockDetallado,
  COLUMNAS_MARCA_DETALLADO,
  exportarStockDetallado,
  aplicarFiltrosTabla,
  filtrarPorCodigos,
  exportarTabla,
};
