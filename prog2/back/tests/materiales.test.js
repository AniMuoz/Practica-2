process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// nucleoDatos.js toma estas dependencias al cargarse: se reemplazan antes por versiones en memoria.
const tablas = require("../supabaseTablas");
let bd;
tablas.ejecutar = (operacion, carga) => {
  if (operacion === "leer") return bd[carga.tabla] ?? [];
  if (operacion === "reemplazar") {
    bd[carga.tabla] = carga.filas;
    return null;
  }
  throw new Error(`operación inesperada: ${operacion}`);
};

const imagenes = require("../imagenesSupabase");
let quitadas = [];
imagenes.quitarImagen = async (nombre) => {
  quitadas.push(nombre);
};

const { supabase } = require("../supabase");
let llamadas = [];
let errorSupabase = null;
supabase.from = (tabla) => ({
  async upsert(registro) {
    llamadas.push({ tipo: "upsert", tabla, registro });
    return { error: errorSupabase };
  },
  delete: () => ({
    eq: async (campo, valor) => {
      llamadas.push({ tipo: "delete", tabla, campo, valor });
      return { error: errorSupabase };
    },
  }),
  update: (datos) => ({
    neq: async (campo, valor) => {
      llamadas.push({ tipo: "update", tabla, datos, campo, valor });
      return { error: errorSupabase };
    },
  }),
});

const carpetaImagenes = path.join(__dirname, "..", "imagenes");
fs.mkdirSync(carpetaImagenes, { recursive: true });
const IMAGEN_PRUEBA = `zz-prueba-${process.pid}-rombo.png`;
const rutaImagen = path.join(carpetaImagenes, IMAGEN_PRUEBA);
test.after(() => fs.rmSync(rutaImagen, { force: true }));

const MATERIAL_100 = { codigo: "100", descripcion: "Perno", ubicacion: "0102-A", sub_ubicacion: "0102", stock: "10", m502: "3", rombo: IMAGEN_PRUEBA };
const SEMILLA = [
  MATERIAL_100,
  { codigo: "200", descripcion: "Tuerca", stock: "2", inventario: "5", comentario: "x" },
  { codigo: "300", descripcion: "Válvula", stock: "7", inventario: "7", comentario: "" },
];

function cargar(materiales = SEMILLA, planillas = []) {
  bd = { materiales: materiales.map((fila) => ({ ...fila })), planillas };
  llamadas = [];
  quitadas = [];
  errorSupabase = null;
  delete require.cache[require.resolve("../nucleoDatos")];
  return require("../nucleoDatos");
}

const filaDe = (nucleo, codigo) => nucleo.buscarMaterial(codigo).fila;
const upserts = () => llamadas.filter((llamada) => llamada.tipo === "upsert");

// ---------- lectura ----------

test("leerTabla muestra solo las columnas visibles y conserva el marcado en cada fila", () => {
  const nucleo = cargar();
  const { columnas, filas } = nucleo.leerTabla();
  assert.deepEqual(columnas, [
    "Codigo", "Descripcion", "Ubicación", "Sub-ubicación", "Stock", "Peso", "Precio", "Caracteristica",
    "Stock critico", "Rombo", "QR", "Foto", "Inventario", "Comentario",
  ]);
  assert.equal(filas.length, 3);
  assert.equal(filas[0].Descripcion, "Perno");
  assert.equal(filas[0].Marcado, "");
  assert.equal(filas[0].M502, undefined);
});

test("sin materiales la tabla queda con los encabezados y sin filas", () => {
  const nucleo = cargar([]);
  assert.equal(nucleo.leerTabla().filas.length, 0);
  assert.ok(nucleo.leerTabla().columnas.includes("Codigo"));
});

test("si la tabla está vacía migra los materiales de la planilla guardada", () => {
  const encabezado = ["Codigo", "Descripcion", "Stock"];
  const nucleo = cargar([], [{ nombre: "materiales", matriz: [encabezado, ["9", "Migrado", "4"]] }]);
  assert.equal(nucleo.leerTabla().filas[0].Codigo, "9");
  assert.equal(bd.materiales[0].codigo, "9");
});

test("buscarMaterial devuelve la fila y las bodegas con stock (sin M501), o fila nula", () => {
  const nucleo = cargar();
  const encontrado = nucleo.buscarMaterial(100);
  assert.equal(encontrado.fila.Descripcion, "Perno");
  assert.deepEqual(encontrado.bodegas, [{ bodega: "M502", stock: "3" }]);
  assert.deepEqual(nucleo.buscarMaterial("999").bodegas, []);
  assert.equal(nucleo.buscarMaterial("999").fila, null);
  assert.ok(nucleo.buscarMaterial("999").columnas.length > 0);
});

test("stockPorBodega incluye M501 y solo las bodegas con valor", () => {
  const nucleo = cargar();
  assert.deepEqual(nucleo.stockPorBodega("100"), [{ bodega: "M501", stock: "10" }, { bodega: "M502", stock: "3" }]);
  assert.deepEqual(nucleo.stockPorBodega("nada"), []);
});

test("buscarMateriales exige 2 letras, ignora acentos y pone primero el código exacto", () => {
  const nucleo = cargar([
    { codigo: "10", descripcion: "Codo" },
    { codigo: "100", descripcion: "Perno 10" },
    { codigo: "2", descripcion: "Válvula de 10" },
    { codigo: "", descripcion: "sin código 10" },
  ]);
  assert.deepEqual(nucleo.buscarMateriales("1"), []);
  assert.deepEqual(nucleo.buscarMateriales("").length, 0);
  assert.deepEqual(nucleo.buscarMateriales("10").map((fila) => fila.codigo), ["10", "2", "100"]);
  assert.deepEqual(nucleo.buscarMateriales("VALVULA"), [{ codigo: "2", descripcion: "Válvula de 10" }]);
  assert.deepEqual(nucleo.buscarMateriales("zzz"), []);
});

test("editarMateriales entrega copias: cambiarlas no altera la tabla cargada", () => {
  const nucleo = cargar();
  const { matriz, porCodigo } = nucleo.editarMateriales();
  matriz[porCodigo.get("100")][1] = "ALTERADO";
  porCodigo.clear();
  assert.equal(filaDe(nucleo, "100").Descripcion, "Perno");
  assert.equal(nucleo.editarMateriales().porCodigo.size, 3);
});

test("guardarMateriales reemplaza la tabla, descarta filas vacías y refresca la lectura", () => {
  const nucleo = cargar();
  const { matriz } = nucleo.editarMateriales();
  matriz.push(matriz[0].map(() => ""));
  matriz[1][1] = "Perno nuevo";
  nucleo.guardarMateriales(matriz);
  assert.equal(bd.materiales.length, 3);
  assert.equal(bd.materiales[0].descripcion, "Perno nuevo");
  assert.equal(filaDe(nucleo, "100").Descripcion, "Perno nuevo");
});

// ---------- inventario, comentario y marcado ----------

test("actualizarMaterial valida comentario e inventario antes de tocar nada", async () => {
  const nucleo = cargar();
  await assert.rejects(nucleo.actualizarMaterial("100", { inventario: "1", comentario: "x".repeat(51) }), { status: 400, message: /50 caracteres/ });
  for (const inventario of ["1.5", "abc", "1e3", "--2"]) {
    await assert.rejects(nucleo.actualizarMaterial("100", { inventario, comentario: "" }), { status: 400, message: /número entero/ });
  }
  assert.equal(llamadas.length, 0);
  await nucleo.actualizarMaterial("100", { inventario: "-3", comentario: "x".repeat(50) });
  assert.equal(upserts().length, 1);
});

test("actualizarMaterial devuelve null si el código no existe y no guarda", async () => {
  const nucleo = cargar();
  assert.equal(await nucleo.actualizarMaterial("999", { inventario: "1", comentario: "" }), null);
  assert.equal(llamadas.length, 0);
});

test("actualizarMaterial guarda inventario numérico y comentario, y los persiste en Supabase", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.actualizarMaterial("100", { inventario: " 8 ", comentario: "revisar" });
  assert.equal(resultado.fila.Inventario, 8);
  assert.equal(resultado.fila.Comentario, "revisar");
  assert.equal(filaDe(nucleo, "100").Comentario, "revisar");
  assert.equal(upserts()[0].tabla, "materiales");
  assert.equal(upserts()[0].registro.codigo, "100");
  assert.equal(upserts()[0].registro.inventario, "8");
  assert.equal(upserts()[0].registro.comentario, "revisar");
  assert.equal(upserts()[0].registro.descripcion, "Perno");
});

test("actualizarMaterial con un inventario vacío conserva el valor anterior y cambia el comentario", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.actualizarMaterial("200", { inventario: "", comentario: "nuevo" });
  assert.equal(String(resultado.fila.Inventario), "5");
  assert.equal(resultado.fila.Comentario, "nuevo");
});

test("un fallo de Supabase al guardar se informa como 502 y no cambia la tabla", async () => {
  const nucleo = cargar();
  errorSupabase = { message: "sin conexión" };
  await assert.rejects(nucleo.actualizarMaterial("100", { inventario: "9", comentario: "" }), { status: 502, message: "sin conexión" });
  assert.notEqual(String(filaDe(nucleo, "100").Inventario), "9");
});

test("marcarMaterial activa y quita la marca, o devuelve null si no existe", async () => {
  const nucleo = cargar();
  assert.equal((await nucleo.marcarMaterial("100", true)).fila.Marcado, "1");
  assert.equal(upserts()[0].registro.marcado, "1");
  assert.equal((await nucleo.marcarMaterial("100", false)).fila.Marcado, "");
  assert.equal(await nucleo.marcarMaterial("999", true), null);
});

test("limpiarInventarioComentarios exige la clave y vacía ambas columnas en todas las filas", async () => {
  const nucleo = cargar();
  await assert.rejects(nucleo.limpiarInventarioComentarios("mala"), { status: 403 });
  assert.equal(llamadas.length, 0);
  const tabla = await nucleo.limpiarInventarioComentarios(nucleo.CLAVE_DATOS);
  assert.deepEqual(tabla.filas.map((fila) => [fila.Inventario, fila.Comentario]), [["", ""], ["", ""], ["", ""]]);
  assert.deepEqual(llamadas[0], { tipo: "update", tabla: "materiales", datos: { inventario: "", comentario: "" }, campo: "codigo", valor: "" });
});

test("limpiarInventarioComentarios informa un fallo de Supabase y no vacía la tabla", async () => {
  const nucleo = cargar();
  errorSupabase = { message: "caído" };
  await assert.rejects(nucleo.limpiarInventarioComentarios(nucleo.CLAVE_DATOS), { status: 502 });
  assert.equal(String(filaDe(nucleo, "200").Inventario), "5");
});

// ---------- actualizarDatos ----------

test("actualizarDatos valida clave y datos", async () => {
  const nucleo = cargar();
  const CLAVE = nucleo.CLAVE_DATOS;
  await assert.rejects(nucleo.actualizarDatos("100", "mala", { Descripcion: "x" }), { status: 403 });
  for (const datos of [undefined, null, "texto"]) {
    await assert.rejects(nucleo.actualizarDatos("100", CLAVE, datos), { status: 400, message: /No hay datos/ });
  }
  assert.equal(await nucleo.actualizarDatos("999", CLAVE, { Descripcion: "x" }), null);
  assert.equal(llamadas.length, 0);
});

test("actualizarDatos cambia los campos permitidos e ignora inventario, comentario, imágenes y marcado", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, {
    Descripcion: "Perno largo", Stock: 55, Inventario: "999", Comentario: "no", Rombo: "otra.png", Marcado: "1", Inexistente: "x",
  });
  assert.equal(resultado.fila.Descripcion, "Perno largo");
  assert.equal(resultado.fila.Stock, 55);
  assert.notEqual(String(resultado.fila.Inventario), "999");
  assert.equal(resultado.fila.Comentario, "");
  assert.equal(resultado.fila.Rombo, IMAGEN_PRUEBA);
  assert.equal(resultado.fila.Marcado, "");
  assert.equal(upserts().length, 1);
  assert.equal(llamadas.some((llamada) => llamada.tipo === "delete"), false);
});

test("actualizarDatos permite borrar un campo con null", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, { Descripcion: null });
  assert.equal(resultado.fila.Descripcion, "");
});

test("cambiar el código borra el registro anterior y guarda el nuevo", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, { Codigo: " 150 ", Descripcion: "Nuevo" });
  assert.equal(resultado.fila.Codigo, "150");
  assert.deepEqual(llamadas[0], { tipo: "delete", tabla: "materiales", campo: "codigo", valor: "100" });
  assert.equal(upserts()[0].registro.codigo, "150");
  assert.equal(filaDe(nucleo, "100"), null);
  assert.equal(filaDe(nucleo, "150").Descripcion, "Nuevo");
});

test("un código vacío se rechaza", async () => {
  const nucleo = cargar();
  await assert.rejects(nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, { Codigo: "  " }), { status: 400, message: /vacío/ });
  assert.equal(filaDe(nucleo, "100").Codigo, "100");
});

test("un código repetido da 409 salvo que se pida reemplazar, y entonces queda una sola fila", async () => {
  const nucleo = cargar();
  await assert.rejects(nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, { Codigo: "200" }), { status: 409 });
  assert.equal(llamadas.length, 0);
  assert.equal(nucleo.leerTabla().filas.length, 3);

  const resultado = await nucleo.actualizarDatos("100", nucleo.CLAVE_DATOS, { Codigo: "200", Descripcion: "Ganó" }, true);
  assert.equal(resultado.fila.Descripcion, "Ganó");
  assert.equal(nucleo.leerTabla().filas.length, 2);
  assert.equal(nucleo.leerTabla().filas.filter((fila) => fila.Codigo === "200").length, 1);
});

// ---------- imágenes ----------

test("guardarImagen valida clave, tipo de imagen y existencia del material", async () => {
  const nucleo = cargar();
  const CLAVE = nucleo.CLAVE_DATOS;
  await assert.rejects(nucleo.guardarImagen("100", "Rombo", "a.png", "mala"), { status: 403 });
  await assert.rejects(nucleo.guardarImagen("100", "Descripcion", "a.png", CLAVE), { status: 400, message: /Rombo, QR o Foto/ });
  assert.equal(await nucleo.guardarImagen("999", "QR", "a.png", CLAVE), null);
  assert.equal(llamadas.length, 0);
});

test("guardarImagen asigna el nombre del archivo y persiste el material", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.guardarImagen("200", "QR", "200-qr.png", nucleo.CLAVE_DATOS);
  assert.equal(resultado.fila.QR, "200-qr.png");
  assert.equal(upserts()[0].registro.qr, "200-qr.png");
  assert.deepEqual(quitadas, []);
});

test("quitar una imagen borra el archivo local y el de Supabase", async () => {
  const nucleo = cargar();
  fs.writeFileSync(rutaImagen, "x");
  const resultado = await nucleo.guardarImagen("100", "Rombo", "", nucleo.CLAVE_DATOS);
  assert.equal(resultado.fila.Rombo, "");
  assert.equal(fs.existsSync(rutaImagen), false);
  assert.deepEqual(quitadas, [IMAGEN_PRUEBA]);
});

test("quitar una imagen que no es un archivo de imagen no borra nada", async () => {
  const nucleo = cargar([{ codigo: "1", descripcion: "x", rombo: "texto-sin-extension" }]);
  await nucleo.guardarImagen("1", "Rombo", "", nucleo.CLAVE_DATOS);
  assert.deepEqual(quitadas, []);
});

test("reemplazar una imagen por otra no borra la anterior desde esta función", async () => {
  const nucleo = cargar();
  fs.writeFileSync(rutaImagen, "x");
  const resultado = await nucleo.guardarImagen("100", "Rombo", "100-rombo-nuevo.png", nucleo.CLAVE_DATOS);
  assert.equal(resultado.fila.Rombo, "100-rombo-nuevo.png");
  assert.equal(fs.existsSync(rutaImagen), true);
  assert.deepEqual(quitadas, []);
});

// ---------- eliminar y agregar ----------

test("eliminarMaterial exige clave, devuelve null si no existe y si existe borra fila, registro e imágenes", async () => {
  const nucleo = cargar();
  await assert.rejects(nucleo.eliminarMaterial("100", "mala"), { status: 403 });
  assert.equal(await nucleo.eliminarMaterial("999", nucleo.CLAVE_DATOS), null);
  assert.equal(llamadas.length, 0);

  fs.writeFileSync(rutaImagen, "x");
  assert.deepEqual(await nucleo.eliminarMaterial("100", nucleo.CLAVE_DATOS), { codigo: "100" });
  assert.equal(fs.existsSync(rutaImagen), false);
  assert.deepEqual(quitadas, [IMAGEN_PRUEBA]);
  assert.deepEqual(llamadas, [{ tipo: "delete", tabla: "materiales", campo: "codigo", valor: "100" }]);
  assert.equal(filaDe(nucleo, "100"), null);
  assert.equal(nucleo.leerTabla().filas.length, 2);
});

test("agregarMaterial valida clave, datos, código e inventario", async () => {
  const nucleo = cargar();
  const CLAVE = nucleo.CLAVE_DATOS;
  await assert.rejects(nucleo.agregarMaterial("mala", { Codigo: "1" }), { status: 403 });
  await assert.rejects(nucleo.agregarMaterial(CLAVE, null), { status: 400, message: /No hay datos/ });
  await assert.rejects(nucleo.agregarMaterial(CLAVE, { Codigo: "  " }), { status: 400, message: /vacío/ });
  await assert.rejects(nucleo.agregarMaterial(CLAVE, { Codigo: "1", Inventario: "1.5" }), { status: 400, message: /número entero/ });
  assert.equal(llamadas.length, 0);
});

test("agregarMaterial crea un material nuevo con inventario numérico", async () => {
  const nucleo = cargar();
  const resultado = await nucleo.agregarMaterial(nucleo.CLAVE_DATOS, { Codigo: " 400 ", Descripcion: "Codo", Stock: "12", Inventario: "3", Marcado: "1", Rombo: "no.png" });
  assert.equal(resultado.fila.Codigo, "400");
  assert.equal(resultado.fila.Descripcion, "Codo");
  assert.equal(resultado.fila.Inventario, 3);
  assert.equal(resultado.fila.Rombo, "");
  assert.equal(resultado.fila.Marcado, "");
  assert.equal(nucleo.leerTabla().filas.length, 4);
  assert.equal(upserts()[0].registro.codigo, "400");
});

test("agregarMaterial sobre un código existente actualiza sus datos y conserva imágenes y marcado", async () => {
  const nucleo = cargar();
  await nucleo.marcarMaterial("100", true);
  const resultado = await nucleo.agregarMaterial(nucleo.CLAVE_DATOS, { Codigo: "100", Descripcion: "Perno V2" });
  assert.equal(resultado.fila.Descripcion, "Perno V2");
  assert.equal(resultado.fila.Rombo, IMAGEN_PRUEBA);
  assert.equal(resultado.fila.Marcado, "1");
  assert.equal(nucleo.leerTabla().filas.length, 3);
  assert.equal(resultado.fila.Stock, "");
});
