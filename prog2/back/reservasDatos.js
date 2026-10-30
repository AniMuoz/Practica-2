const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const { ejecutar } = require("./supabaseTablas");
const { supabase } = require("./supabase");
const {
  CAMPOS_RESERVA,
  cargarMateriales,
  exigirClave,
  falloSupabase,
  indiceCampo,
  matrizGuardada,
  matrizReserva,
  registrosReserva,
} = require("./nucleoDatos");
const { compactarPlanilla, filasConBodegas, pintar } = require("./planillasStock");
const { leerContratistas } = require("./contratistas");

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

let cacheReservas = null;

function leerReservas() {
  if (cacheReservas) return cacheReservas.datos;
  let filasDb = ejecutar("leer", { tabla: "reservas" }) || [];
  if (filasDb.length === 0) {
    const previa = matrizGuardada("reservas");
    const registros = previa ? registrosReserva(previa) : [];
    if (registros.length > 0) {
      ejecutar("reemplazar", { tabla: "reservas", columna: "orden", filas: registros });
      filasDb = registros;
    }
  }
  const matriz = matrizReserva(filasDb);
  if (matriz.length === 0) return { columnas: [], filas: [] };
  const columnas = (matriz[0] || []).map((nombre) => String(nombre).trim());
  const filas = normalizarFechas(
    columnas,
    matriz.slice(1).filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""))
  );
  const datos = { columnas, filas };
  cacheReservas = { datos };
  return datos;
}

function importarReservas(clave, buffer) {
  exigirClave(clave);
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
  const columnas = CAMPOS_RESERVA.map(([titulo]) => titulo);
  const nuevas = normalizarFechas(
    columnas,
    matrizEntrada.slice(1)
      .filter((fila) => fila.some((celda) => String(celda ?? "").trim() !== ""))
      .map((fila) => columnas.map((titulo) => {
        const indice = indiceCampo(encabezados, titulo);
        return indice < 0 ? "" : fila[indice] ?? "";
      }))
  );
  const actual = leerReservas();
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
  ejecutar("reemplazar", { tabla: "reservas", columna: "orden", filas: registrosReserva(matriz) });
  cacheReservas = null;
  return { agregados, actualizados, omitidos };
}

function claveCarga(modo, columna) {
  if (modo === "dos-columnas") {
    const destino = String(columna ?? "").trim();
    return destino ? `dos-columnas:${destino}` : "dos-columnas";
  }
  return String(modo || "completa");
}

let cacheCargas = null;

function leerUltimasCargas() {
  if (cacheCargas) return cacheCargas;
  const filas = ejecutar("leer", { tabla: "ultimas_cargas" }) || [];
  const datos = {};
  filas.forEach((fila) => {
    datos[fila.clave] = fila.fecha;
  });
  cacheCargas = datos;
  return datos;
}

async function registrarCarga(modo, columna) {
  const cargas = { ...leerUltimasCargas() };
  const clave = claveCarga(modo, columna);
  cargas[clave] = new Date().toISOString();
  const { error } = await supabase.from("ultimas_cargas").upsert({ clave, fecha: cargas[clave] });
  if (error) falloSupabase(error);
  cacheCargas = cargas;
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

function modoBusquedaReserva(por) {
  return String(por ?? "").trim().toLowerCase() === "orden" ? "orden" : "reserva";
}

function revisionReservas(reserva, por = "reserva") {
  const termino = String(reserva ?? "").trim().toLowerCase();
  const modo = modoBusquedaReserva(por);
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
  const indice = (patron) => indiceEncabezado(columnas, patron);
  const iOrden = indice(/^orden$/i);
  const indiceReserva = indice(/^n[ºo°.]?\s*reserva$/i);
  const indiceBusqueda = modo === "orden" ? iOrden : indiceReserva;
  const coinciden =
    indiceBusqueda < 0
      ? []
      : filas.filter((fila) => String(fila[indiceBusqueda] ?? "").trim().toLowerCase().includes(termino));
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

function buscarReservas(reserva, pagina = 0, tamano = 100, por = "reserva") {
  const revision = revisionReservas(reserva, por);
  const cantidad = Number(tamano);
  const limite = Number.isFinite(cantidad) && cantidad > 0 ? Math.min(Math.trunc(cantidad), 500) : 100;
  const indice = Math.max(0, Math.trunc(Number(pagina) || 0));
  const inicio = indice * limite;
  return {
    columnas: revision.columnas,
    filas: revision.filas.slice(inicio, inicio + limite),
    total: revision.total,
    coincidencias: revision.filas.length,
    pagina: indice,
    fecha: revision.fecha,
    solicitante: revision.solicitante,
    movimiento: revision.movimiento,
  };
}

function precargarDatos() {
  cargarMateriales();
  leerContratistas();
  leerReservas();
}

async function exportarRevisionPorReserva(reserva, colores = true, por = "reserva") {
  const modo = modoBusquedaReserva(por);
  const etiqueta = modo === "orden" ? "orden" : "reserva";
  if (!String(reserva ?? "").trim()) {
    const error = new Error(`Escribe un número de ${etiqueta}.`);
    error.status = 400;
    throw error;
  }
  const revision = revisionReservas(reserva, modo);
  if (revision.total === 0) {
    const error = new Error("Todavía no hay reservas cargadas.");
    error.status = 400;
    throw error;
  }
  if (revision.filas.length === 0) {
    const error = new Error(`No hay reservas con ese número de ${etiqueta}.`);
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
  textoFecha,
  normalizarFechas,
  leerReservas,
  importarReservas,
  claveCarga,
  leerUltimasCargas,
  registrarCarga,
  indiceEncabezado,
  celdaReserva,
  numeroReserva,
  modoBusquedaReserva,
  revisionReservas,
  buscarReservas,
  precargarDatos,
  exportarRevisionPorReserva,
};
