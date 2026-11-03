process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");

// contratistas.js toma `ejecutar` al cargarse, así que se reemplaza antes de requerirlo.
const tablas = require("../supabaseTablas");
const llamadas = [];
let bd = { contratistas: [], planillas: [] };
tablas.ejecutar = (operacion, carga) => {
  llamadas.push({ operacion, ...carga });
  if (operacion === "leer") return bd[carga.tabla] ?? [];
  if (operacion === "reemplazar") {
    bd[carga.tabla] = carga.filas;
    return null;
  }
  throw new Error(`operación inesperada: ${operacion}`);
};

const { CLAVE_DATOS } = require("../nucleoDatos");

function cargar(inicial) {
  bd = { contratistas: [], planillas: [], ...inicial };
  llamadas.length = 0;
  delete require.cache[require.resolve("../contratistas")];
  return require("../contratistas");
}

async function conDatos(inicial) {
  const modulo = cargar(inicial);
  await modulo.cargarContratistas();
  return modulo;
}

test("leerContratistas arma columnas y filas desde la base", async () => {
  const { leerContratistas } = await conDatos({ contratistas: [{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Luis" }] });
  assert.deepEqual(leerContratistas(), {
    columnas: ["id", "Nombre"],
    filas: [{ id: 1, nombre: "Ana" }, { id: 2, nombre: "Luis" }],
  });
});

test("leerContratistas guarda el resultado y no vuelve a consultar", async () => {
  const { leerContratistas } = await conDatos({ contratistas: [{ id: 1, nombre: "Ana" }] });
  const primero = leerContratistas();
  const consultas = llamadas.length;
  assert.equal(leerContratistas(), primero);
  assert.equal(llamadas.length, consultas);
});

test("leerContratistas sin datos devuelve la tabla vacía", async () => {
  const { leerContratistas } = await conDatos();
  assert.deepEqual(leerContratistas(), { columnas: ["id", "Nombre"], filas: [] });
});

test("leerContratistas migra la planilla antigua si la tabla está vacía", async () => {
  const { leerContratistas } = await conDatos({
    planillas: [{
      nombre: "contratistas",
      matriz: [["id", "Nombre"], ["1", "Ana"], ["x", "Inválido"], ["3", ""], ["4", "Luis"]],
    }],
  });
  const datos = leerContratistas();
  assert.deepEqual(datos.filas, [{ id: 1, nombre: "Ana" }, { id: 4, nombre: "Luis" }]);
  const reemplazo = llamadas.find((llamada) => llamada.operacion === "reemplazar");
  assert.equal(reemplazo.tabla, "contratistas");
  assert.equal(reemplazo.columna, "id");
  assert.deepEqual(reemplazo.filas, [{ id: 1, nombre: "Ana" }, { id: 4, nombre: "Luis" }]);
});

test("no migra si la planilla antigua solo tiene encabezado o ninguna fila válida", async () => {
  const soloEncabezado = await conDatos({ planillas: [{ nombre: "contratistas", matriz: [["id", "Nombre"]] }] });
  assert.deepEqual(soloEncabezado.leerContratistas().filas, []);
  assert.equal(llamadas.some((llamada) => llamada.operacion === "reemplazar"), false);

  const sinValidas = await conDatos({ planillas: [{ nombre: "contratistas", matriz: [["id", "Nombre"], ["a", "b"]] }] });
  assert.deepEqual(sinValidas.leerContratistas().filas, []);
  assert.equal(llamadas.some((llamada) => llamada.operacion === "reemplazar"), false);
});

test("leerContratistas ignora filas totalmente vacías", async () => {
  const { leerContratistas } = await conDatos({ contratistas: [{ id: 1, nombre: "Ana" }, { id: "", nombre: "  " }] });
  assert.equal(leerContratistas().filas.length, 1);
});

test("guardarContratistas exige la clave y no toca la base si es incorrecta", async () => {
  const { guardarContratistas } = cargar();
  await assert.rejects(() => guardarContratistas("mala", []), { status: 403 });
  assert.equal(llamadas.length, 0);
});

test("guardarContratistas exige una lista", async () => {
  const { guardarContratistas } = cargar();
  for (const valor of [undefined, null, "texto", {}]) {
    await assert.rejects(() => guardarContratistas(CLAVE_DATOS, valor), { status: 400, message: /No hay contratistas/ });
  }
});

test("guardarContratistas valida id numérico, nombre e ids repetidos indicando la fila", async () => {
  const { guardarContratistas } = cargar();
  await assert.rejects(() => guardarContratistas(CLAVE_DATOS, [{ id: "a", nombre: "Ana" }]), { status: 400, message: /fila 1.*id numérico/ });
  await assert.rejects(() => guardarContratistas(CLAVE_DATOS, [{ id: "", nombre: "Ana" }]), { status: 400, message: /id numérico/ });
  await assert.rejects(() => guardarContratistas(CLAVE_DATOS, [{ id: "-1", nombre: "Ana" }]), { status: 400 });
  await assert.rejects(() => guardarContratistas(CLAVE_DATOS, [{ id: "1.5", nombre: "Ana" }]), { status: 400 });
  await assert.rejects(
    () => guardarContratistas(CLAVE_DATOS, [{ id: "1", nombre: "Ana" }, { id: "2", nombre: " " }]),
    { status: 400, message: /fila 2.*nombre/ }
  );
  await assert.rejects(
    () => guardarContratistas(CLAVE_DATOS, [{ id: "1", nombre: "Ana" }, { id: " 1 ", nombre: "Luis" }]),
    { status: 400, message: /id 1 está repetido/ }
  );
  assert.equal(llamadas.some((llamada) => llamada.operacion === "reemplazar"), false);
});

test("guardarContratistas recorta, omite filas vacías, convierte el id a número y devuelve lo guardado", async () => {
  const { guardarContratistas, leerContratistas } = await conDatos({ contratistas: [{ id: 9, nombre: "Viejo" }] });
  leerContratistas();
  const resultado = await guardarContratistas(CLAVE_DATOS, [
    { id: " 7 ", nombre: "  Ana  " },
    { id: "", nombre: "" },
    { id: 8, nombre: "Luis" },
  ]);
  const reemplazo = llamadas.find((llamada) => llamada.operacion === "reemplazar");
  assert.deepEqual(reemplazo.filas, [{ id: 7, nombre: "Ana" }, { id: 8, nombre: "Luis" }]);
  assert.deepEqual(resultado.filas, [{ id: 7, nombre: "Ana" }, { id: 8, nombre: "Luis" }]);
  assert.equal(resultado.filas.some((fila) => fila.nombre === "Viejo"), false);
});

test("guardar una lista vacía deja la tabla vacía", async () => {
  const { guardarContratistas } = cargar();
  assert.deepEqual((await guardarContratistas(CLAVE_DATOS, [])).filas, []);
});
