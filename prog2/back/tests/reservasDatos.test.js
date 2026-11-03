process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");

// Los módulos toman estas funciones al cargarse: se reemplazan antes por datos en memoria.
const tablas = require("../supabase/supabaseTablas");
let bd;
const operaciones = [];
tablas.ejecutar = (operacion, carga) => {
  operaciones.push({ operacion, ...carga });
  if (operacion === "leer") return bd[carga.tabla] ?? [];
  if (operacion === "reemplazar") {
    bd[carga.tabla] = carga.filas;
    return null;
  }
  throw new Error(`operación inesperada: ${operacion}`);
};

const nucleo = require("../servicios/nucleoDatos");
const CLAVE = nucleo.CLAVE_DATOS;
let lecturasMateriales = 0;
const MATERIALES = [
  { Codigo: "100", Descripcion: "Perno", Stock: "10", M502: "3", "Ubicación": "0102-A", "Sub-ubicación": "0102" },
  { Codigo: "200", Descripcion: "Tuerca", Stock: "2", "Ubicación": "          " },
];
nucleo.materialesEnCache = () => {
  lecturasMateriales += 1;
  return { filasBodega: MATERIALES };
};

const { supabase } = require("../supabase/supabase");
let errorUpsert = null;
const upserts = [];
supabase.from = (tabla) => ({
  async upsert(fila) {
    upserts.push({ tabla, fila });
    return { error: errorUpsert };
  },
});

const TITULOS = nucleo.CAMPOS_RESERVA.map(([titulo]) => titulo);

function cargar(inicial = {}) {
  bd = { reservas: [], planillas: [], ultimas_cargas: [], contratistas: [], ...inicial };
  operaciones.length = 0;
  upserts.length = 0;
  errorUpsert = null;
  delete require.cache[require.resolve("../servicios/reservasDatos")];
  return require("../servicios/reservasDatos");
}

async function conReservas(inicial = {}) {
  const modulo = cargar(inicial);
  await modulo.cargarReservas();
  return modulo;
}

async function conCargas(inicial = {}) {
  const modulo = cargar(inicial);
  await modulo.cargarUltimasCargas();
  return modulo;
}

function registro(datos) {
  return Object.fromEntries(nucleo.CAMPOS_RESERVA.map(([, campo]) => [campo, String(datos[campo] ?? "")]));
}

const RESERVAS = [
  registro({
    orden: "6001", n_reserva: "9001", material: "100", cantidad_necesaria: "5", texto_breve_de_material: "Perno ses",
    centro: "C1", almacen: "M501", unidad_medida_base: "UN", fecha_de_necesidad: "05/10/2026",
    nombre_del_usuario: "jperez", clase_de_movimiento: "201", cantid_reducidas: "1", cantidad_diferencia: "2",
  }),
  registro({ orden: "6001", n_reserva: "9001", material: "200", cantidad_necesaria: "30", texto_breve_de_material: "Tuerca" }),
  registro({ orden: "6002", n_reserva: "9002", material: "999", cantidad_necesaria: "1,5", texto_breve_de_material: "Desconocido" }),
];

function excel(filas, titulos = TITULOS) {
  const matriz = [titulos, ...filas.map((fila) => titulos.map((titulo) => {
    const campo = nucleo.CAMPOS_RESERVA.find(([nombre]) => nombre === titulo);
    return campo ? fila[campo[1]] ?? "" : "";
  }))];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Hoja1");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}

// ---------- fechas y números ----------

test("normalizarFechas convierte solo las columnas de fecha y no modifica la matriz original", () => {
  const { normalizarFechas } = cargar();
  const filas = [["a", 46300, 46300, new Date(Date.UTC(2026, 9, 5))]];
  const resultado = normalizarFechas(["Texto", "Fecha de necesidad", "Otra", "fecha"], filas);
  assert.deepEqual(resultado, [["a", "05/10/2026", 46300, "05/10/2026"]]);
  assert.equal(filas[0][1], 46300);
  assert.equal(normalizarFechas(["x", "y"], filas), filas);
});

test("textoFecha deja intacto lo que no es fecha ni serial de Excel", () => {
  const { textoFecha } = cargar();
  assert.equal(textoFecha(5), 5);
  assert.equal(textoFecha(100000), 100000);
  assert.equal(textoFecha("texto"), "texto");
  assert.equal(textoFecha(new Date("no es fecha")).toString(), "Invalid Date");
});

test("numeroReserva entiende miles con punto y decimales con coma", () => {
  const { numeroReserva } = cargar();
  assert.equal(numeroReserva("1.000"), 1000);
  assert.equal(numeroReserva("1,5"), 1.5);
  assert.equal(numeroReserva("1.234,56"), 1234.56);
  assert.equal(numeroReserva(7), 7);
  assert.equal(numeroReserva(""), 0);
  assert.equal(numeroReserva("abc"), 0);
  assert.equal(numeroReserva(NaN), 0);
});

test("indiceEncabezado y celdaReserva manejan columnas ausentes", () => {
  const { indiceEncabezado, celdaReserva } = cargar();
  assert.equal(indiceEncabezado([" Material ", "Otro"], /^material$/i), 0);
  assert.equal(indiceEncabezado(["a"], /^z$/), -1);
  assert.equal(celdaReserva(["x"], -1), "");
  assert.equal(celdaReserva([46300], 0), "05/10/2026");
  assert.equal(celdaReserva([null], 0), "");
});

// ---------- lectura ----------

test("leerReservas sin datos devuelve los encabezados y ninguna fila", async () => {
  const { leerReservas } = await conReservas();
  const datos = leerReservas();
  assert.deepEqual(datos.columnas, TITULOS);
  assert.deepEqual(datos.filas, []);
});

test("leerReservas lee de la base, descarta filas vacías y guarda el resultado", async () => {
  const { leerReservas } = await conReservas({ reservas: [...RESERVAS, registro({})] });
  const datos = leerReservas();
  assert.equal(datos.filas.length, 3);
  const consultas = operaciones.length;
  assert.equal(leerReservas(), datos);
  assert.equal(operaciones.length, consultas);
});

test("leerReservas migra la planilla antigua si la tabla está vacía", async () => {
  const matriz = [TITULOS, TITULOS.map((titulo) => (titulo === "Orden" ? "7000" : titulo === "Nº reserva" ? "1" : ""))];
  const { leerReservas } = await conReservas({ planillas: [{ nombre: "reservas", matriz }] });
  assert.equal(leerReservas().filas.length, 1);
  const reemplazo = operaciones.find((operacion) => operacion.operacion === "reemplazar");
  assert.equal(reemplazo.tabla, "reservas");
  assert.equal(reemplazo.columna, "orden");
  assert.equal(reemplazo.filas[0].orden, "7000");
});

// ---------- importación ----------

test("importarReservas exige la clave", async () => {
  const { importarReservas } = cargar();
  await assert.rejects(() => importarReservas("mala", excel(RESERVAS)), { status: 403 });
  assert.equal(operaciones.length, 0);
});

test("importarReservas rechaza archivos sin encabezados", async () => {
  const { importarReservas } = cargar();
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["", ""], ["a", "b"]]), "Hoja1");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
  await assert.rejects(() => importarReservas(CLAVE, buffer), { status: 400, message: /encabezados/ });
});

test("importarReservas agrega, omite repetidas sin cambios y actualiza las modificadas", async () => {
  const { importarReservas } = cargar();
  assert.deepEqual(await importarReservas(CLAVE, excel(RESERVAS)), { agregados: 3, actualizados: 0, omitidos: 0 });
  assert.equal(bd.reservas.length, 3);

  const otra = cargar({ reservas: bd.reservas }).importarReservas;
  assert.deepEqual(await otra(CLAVE, excel(RESERVAS)), { agregados: 0, actualizados: 0, omitidos: 3 });

  const modificada = [{ ...RESERVAS[0], cantidad_necesaria: "99" }, RESERVAS[1], registro({ orden: "6003", n_reserva: "9003", material: "100" })];
  const final = cargar({ reservas: bd.reservas });
  assert.deepEqual(await final.importarReservas(CLAVE, excel(modificada)), { agregados: 1, actualizados: 1, omitidos: 1 });
  assert.equal(bd.reservas.length, 4);
  assert.equal(bd.reservas.find((fila) => fila.orden === "6001" && fila.material === "100").cantidad_necesaria, "99");
});

test("importarReservas identifica la reserva por orden, número, posición y material sin importar mayúsculas", async () => {
  const base = registro({ orden: "A1", n_reserva: "5", n_pos_reserva_traslado: "1", material: "x" });
  const { importarReservas } = cargar({ reservas: [base] });
  const mismaClave = registro({ orden: "a1", n_reserva: "5", n_pos_reserva_traslado: "1", material: "X", centro: "nuevo" });
  const otraPosicion = registro({ orden: "A1", n_reserva: "5", n_pos_reserva_traslado: "2", material: "x" });
  assert.deepEqual(await importarReservas(CLAVE, excel([mismaClave, otraPosicion])), { agregados: 1, actualizados: 1, omitidos: 0 });
});

test("importarReservas convierte las fechas de Excel y acepta encabezados con otro formato", async () => {
  const { importarReservas } = cargar();
  const titulos = ["ORDEN", "n reserva", "MATERIAL", "fecha de necesidad"];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([titulos, ["6001", "9001", "100", 46300]]), "Hoja1");
  await importarReservas(CLAVE, XLSX.write(libro, { type: "buffer", bookType: "xlsx" }));
  assert.equal(bd.reservas[0].fecha_de_necesidad, "05/10/2026");
  assert.equal(bd.reservas[0].orden, "6001");
  assert.equal(bd.reservas[0].n_reserva, "9001");
});

// ---------- revisión y búsqueda ----------

async function revisar(reserva) {
  const modulo = await conReservas({ reservas: RESERVAS });
  return modulo.revisionReservas(reserva);
}

test("revisionReservas cruza cada línea con el stock y arma el estado", async () => {
  const revision = await revisar("9001");
  assert.equal(revision.columnas.length, 20);
  assert.equal(revision.total, 3);
  assert.equal(revision.filas.length, 2);
  assert.deepEqual(revision.filas[0], [1, "6001", "9001", "100", "Perno", "C1", "M501", 10, 5, "UN", "0102-A", "0102", "05/10/2026", "Disponible", 3, 0, 0, 0, 1, 2]);
  const sinStock = revision.filas[1];
  assert.equal(sinStock[3], "200");
  assert.equal(sinStock[7], 2);
  assert.equal(sinStock[8], 30);
  assert.equal(sinStock[10], "No se encontro ubicación");
  assert.equal(sinStock[13], "No disponible");
  assert.equal(revision.fecha, "05/10/2026");
  assert.equal(revision.solicitante, "jperez");
  assert.equal(revision.movimiento, "201");
});

test("revisionReservas usa el texto de la reserva si el material no está en el inventario", async () => {
  const fila = (await revisar("9002")).filas[0];
  assert.equal(fila[4], "Desconocido");
  assert.equal(fila[7], 0);
  assert.equal(fila[8], 1.5);
  assert.equal(fila[13], "No disponible");
});

test("revisionReservas busca por coincidencia parcial, sin importar mayúsculas, y sin término no devuelve filas", async () => {
  assert.equal((await revisar("900")).filas.length, 3);
  assert.equal((await revisar(" 9002 ")).filas.length, 1);
  assert.equal((await revisar("77777")).filas.length, 0);
  const vacio = await revisar("");
  assert.deepEqual([vacio.columnas, vacio.filas, vacio.total], [[], [], 3]);
  assert.equal((await revisar(undefined)).filas.length, 0);
});

test("revisionReservas puede buscar por número de orden", async () => {
  const { revisionReservas } = await conReservas({ reservas: RESERVAS });
  assert.equal(revisionReservas("6001", "orden").filas.length, 2);
  assert.equal(revisionReservas("6002", "orden").filas.length, 1);
  assert.equal(revisionReservas("600", "orden").filas.length, 3);
  assert.equal(revisionReservas("9001", "orden").filas.length, 0);
  assert.equal(revisionReservas("6001", "reserva").filas.length, 0);
});

test("revisionReservas omite la copia incompleta cuando hay otra completa de la misma reserva", async () => {
  const incompleta = registro({
    n_reserva: "9001",
    n_pos_reserva_traslado: "1",
    material: "100",
    cantidad_necesaria: "5",
    texto_breve_de_material: "Perno",
  });
  const completa = registro({
    orden: "6001",
    n_reserva: "9001",
    n_pos_reserva_traslado: "1",
    material: "100",
    cantidad_necesaria: "5",
    texto_breve_de_material: "Perno",
    centro: "C1",
    almacen: "M501",
    unidad_medida_base: "UN",
    fecha_de_necesidad: "05/10/2026",
  });
  const otraLinea = registro({
    orden: "6001",
    n_reserva: "9001",
    n_pos_reserva_traslado: "2",
    material: "200",
    cantidad_necesaria: "3",
    texto_breve_de_material: "Tuerca",
    centro: "C1",
    almacen: "M501",
  });
  const { revisionReservas } = await conReservas({ reservas: [incompleta, completa, otraLinea] });
  const revision = revisionReservas("9001");
  assert.equal(revision.filas.length, 2);
  assert.deepEqual(
    revision.filas.map((fila) => [fila[1], fila[3], fila[5], fila[6]]),
    [
      ["6001", "100", "C1", "M501"],
      ["6001", "200", "C1", "M501"],
    ]
  );
  assert.deepEqual(revision.marcadosCodigo, [false, false]);
});

test("revisionReservas deja una sola fila cuando hay copias exactamente iguales", async () => {
  const linea = registro({
    orden: "6001",
    n_reserva: "9001",
    n_pos_reserva_traslado: "1",
    material: "100",
    cantidad_necesaria: "5",
    texto_breve_de_material: "Perno",
    centro: "C1",
    almacen: "M501",
  });
  const { revisionReservas } = await conReservas({ reservas: [linea, { ...linea }, linea] });
  const revision = revisionReservas("9001");
  assert.equal(revision.filas.length, 1);
  assert.equal(revision.filas[0][3], "100");
  assert.deepEqual(revision.marcadosCodigo, [false]);
});

test("revisionReservas colapsa filas iguales en pantalla aunque cambie la posición de origen", async () => {
  const base = {
    orden: "",
    n_reserva: "1573425",
    material: "60000390",
    cantidad_necesaria: "2",
    texto_breve_de_material: "PROTECTOR",
    unidad_medida_base: "UN",
    fecha_de_necesidad: "23/09/2026",
  };
  const { revisionReservas } = await conReservas({
    reservas: [
      registro({ ...base, n_pos_reserva_traslado: "1" }),
      registro({ ...base, n_pos_reserva_traslado: "11" }),
    ],
  });
  const revision = revisionReservas("1573425");
  assert.equal(revision.filas.length, 1);
  assert.equal(revision.filas[0][0], 1);
  assert.equal(revision.filas[0][3], "60000390");
  assert.deepEqual(revision.marcadosCodigo, [false]);
  assert.deepEqual(revision.repeticiones, [2]);
});

test("revisionReservas reporta 1 repetición cuando la fila no está duplicada", async () => {
  const revision = await revisar("9001");
  assert.deepEqual(revision.repeticiones, [1, 1]);
});

test("revisionReservas marca el código cuando el mismo material aparece con datos distintos", async () => {
  const base = {
    orden: "6001",
    n_reserva: "9001",
    material: "100",
    texto_breve_de_material: "Perno",
    centro: "C1",
    almacen: "M501",
  };
  const { revisionReservas } = await conReservas({
    reservas: [
      registro({ ...base, n_pos_reserva_traslado: "1", cantidad_necesaria: "5" }),
      registro({ ...base, n_pos_reserva_traslado: "2", cantidad_necesaria: "8" }),
      registro({
        orden: "6001",
        n_reserva: "9001",
        n_pos_reserva_traslado: "3",
        material: "200",
        cantidad_necesaria: "1",
        texto_breve_de_material: "Tuerca",
        centro: "C1",
        almacen: "M501",
      }),
    ],
  });
  const revision = revisionReservas("9001");
  assert.equal(revision.filas.length, 3);
  assert.deepEqual(revision.marcadosCodigo, [true, true, false]);
  assert.deepEqual(
    revision.filas.map((fila) => [fila[3], fila[8]]),
    [
      ["100", 5],
      ["100", 8],
      ["200", 1],
    ]
  );
});

test("revisionReservas prioriza la completa y no marca conflicto si la incompleta se descarta", async () => {
  const incompleta = registro({
    n_reserva: "9001",
    n_pos_reserva_traslado: "1",
    material: "100",
    cantidad_necesaria: "5",
  });
  const completa = registro({
    orden: "6001",
    n_reserva: "9001",
    n_pos_reserva_traslado: "1",
    material: "100",
    cantidad_necesaria: "5",
    centro: "C1",
    almacen: "M501",
  });
  const { revisionReservas } = await conReservas({ reservas: [incompleta, completa] });
  const revision = revisionReservas("9001");
  assert.equal(revision.filas.length, 1);
  assert.deepEqual(revision.marcadosCodigo, [false]);
  assert.equal(revision.filas[0][1], "6001");
});

test("buscarReservas pagina, limita el tamaño y corrige valores inválidos", async () => {
  const muchas = Array.from({ length: 600 }, (_, i) => registro({ orden: String(i), n_reserva: "7", material: "100", cantidad_necesaria: "1" }));
  const { buscarReservas } = await conReservas({ reservas: muchas });
  const pagina1 = buscarReservas("7", 1, 2);
  assert.equal(pagina1.filas.length, 2);
  assert.equal(pagina1.filas[0][0], 3);
  assert.equal(pagina1.coincidencias, 600);
  assert.equal(pagina1.pagina, 1);
  assert.equal(pagina1.total, 600);
  assert.equal(buscarReservas("7", 0, 100000).filas.length, 500);
  for (const tamano of ["abc", 0, -5, undefined]) {
    assert.equal(buscarReservas("7", 0, tamano).filas.length, 100);
  }
  assert.equal(buscarReservas("7", -3, 2).pagina, 0);
  assert.equal(buscarReservas("7", "2", 2).pagina, 2);
  assert.equal(buscarReservas("7", "x", 2).pagina, 0);
  assert.equal(buscarReservas("7", 99, 100).filas.length, 0);
});

// ---------- exportación ----------

test("exportarRevisionPorReserva valida el número y que existan reservas", async () => {
  await assert.rejects((await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("  "), { status: 400, message: /número de reserva/ });
  await assert.rejects((await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("  ", true, "orden"), { status: 400, message: /número de orden/ });
  await assert.rejects((await conReservas()).exportarRevisionPorReserva("9001"), { status: 400, message: /Todavía no hay reservas/ });
  await assert.rejects((await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("55555"), { status: 404 });
  await assert.rejects((await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("55555", true, "orden"), {
    status: 404,
    message: /número de orden/,
  });
});

test("exportarRevisionPorReserva escribe datos laterales, encabezados y estados con color", async () => {
  const buffer = await (await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("9001", true);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.name, "Reserva");
  assert.equal(hoja.getCell("C1").value, "Revisión Stock de Reserva");
  assert.equal(hoja.getCell(3, 1).value, "Fecha de necesidad");
  assert.equal(hoja.getCell(3, 2).value, "05/10/2026");
  assert.equal(hoja.getCell(5, 2).value, "jperez");
  assert.equal(hoja.getCell(7, 2).value, "201");
  assert.equal(hoja.getCell(3, 3).value, "N°");
  assert.equal(hoja.getCell(4, 6).value, "100");
  assert.equal(hoja.getCell(4, 16).value, "Disponible");
  assert.equal(hoja.getCell(4, 16).fill.fgColor.argb, "FF73C883");
  assert.equal(hoja.getCell(5, 16).value, "No disponible");
  assert.equal(hoja.getCell(5, 16).fill.fgColor.argb, "FFF9E37C");
  assert.equal(hoja.getCell(6, 3).value, null);

  const sinColores = new ExcelJS.Workbook();
  await sinColores.xlsx.load(await (await conReservas({ reservas: RESERVAS })).exportarRevisionPorReserva("9001", false));
  assert.equal(sinColores.worksheets[0].getCell(4, 16).fill?.fgColor, undefined);
});

test("exportarRevisionPorReserva pinta de amarillo el código con variantes", async () => {
  const base = {
    orden: "6001",
    n_reserva: "9001",
    material: "100",
    centro: "C1",
    almacen: "M501",
  };
  const buffer = await (await conReservas({
    reservas: [
      registro({ ...base, n_pos_reserva_traslado: "1", cantidad_necesaria: "5" }),
      registro({ ...base, n_pos_reserva_traslado: "2", cantidad_necesaria: "9" }),
    ],
  })).exportarRevisionPorReserva("9001", true);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell(4, 6).value, "100");
  assert.equal(hoja.getCell(4, 6).fill.fgColor.argb, "FFF9E37C");
  assert.equal(hoja.getCell(5, 6).fill.fgColor.argb, "FFF9E37C");
});

// ---------- últimas cargas ----------

test("leerUltimasCargas arma un objeto clave→fecha y lo guarda", async () => {
  const { leerUltimasCargas } = await conCargas({ ultimas_cargas: [{ clave: "sap", fecha: "2026-10-01" }, { clave: "completa", fecha: "2026-10-02" }] });
  const cargas = leerUltimasCargas();
  assert.deepEqual(cargas, { sap: "2026-10-01", completa: "2026-10-02" });
  const consultas = operaciones.length;
  assert.equal(leerUltimasCargas(), cargas);
  assert.equal(operaciones.length, consultas);
});

test("registrarCarga guarda la fecha en Supabase y actualiza el resumen", async () => {
  const { registrarCarga, leerUltimasCargas } = await conCargas({ ultimas_cargas: [{ clave: "sap", fecha: "antes" }] });
  const antes = Date.now();
  const resultado = await registrarCarga("dos-columnas", " Precio ");
  assert.equal(resultado.clave, "dos-columnas:Precio");
  assert.ok(Date.parse(resultado.fecha) >= antes - 1000);
  assert.deepEqual(upserts, [{ tabla: "ultimas_cargas", fila: { clave: "dos-columnas:Precio", fecha: resultado.fecha } }]);
  assert.equal(resultado.cargas.sap, "antes");
  assert.equal(leerUltimasCargas()["dos-columnas:Precio"], resultado.fecha);
  const sinModo = await registrarCarga(undefined);
  assert.equal(sinModo.clave, "completa");
});

test("registrarCarga informa un fallo de Supabase como 502 y no cambia el resumen", async () => {
  const { registrarCarga, leerUltimasCargas } = await conCargas();
  errorUpsert = { message: "sin conexión" };
  await assert.rejects(registrarCarga("sap"), { status: 502, message: "Supabase no respondió." });
  assert.deepEqual(leerUltimasCargas(), {});
});

// ---------- precarga ----------

test("precargarDatos carga materiales, contratistas y reservas", async () => {
  const { precargarDatos } = cargar({ reservas: RESERVAS });
  await precargarDatos();
  const tablasLeidas = operaciones.filter((operacion) => operacion.operacion === "leer").map((operacion) => operacion.tabla);
  assert.ok(tablasLeidas.includes("reservas"));
  assert.ok(tablasLeidas.includes("materiales"));
  assert.ok(tablasLeidas.includes("contratistas"));
});
