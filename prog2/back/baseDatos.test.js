const assert = require("node:assert/strict");
const test = require("node:test");
const { leer, reemplazar, guardarCarga, main } = require("./supabaseTarea");
const { subirImagen, bajarImagen, quitarImagen } = require("./imagenesSupabase");
const { interpretarSalida } = require("./supabase");
const { interpretarProceso } = require("./supabaseTablas");

function clienteTablas(tablas = {}) {
  const llamadas = [];
  return {
    llamadas,
    from(tabla) {
      if (!tablas[tabla]) tablas[tabla] = [];
      const consulta = { tabla, filtros: [] };
      const api = {
        select() {
          return api;
        },
        range(desde, hasta) {
          llamadas.push({ tipo: "leer", tabla, desde, hasta });
          return { data: tablas[tabla].slice(desde, hasta + 1), error: null };
        },
        delete() {
          return api;
        },
        not(columna) {
          llamadas.push({ tipo: "borrar", tabla, columna });
          tablas[tabla] = [];
          return { error: null };
        },
        insert(lote) {
          llamadas.push({ tipo: "insertar", tabla, cantidad: lote.length });
          tablas[tabla].push(...lote);
          return { error: null };
        },
        upsert(fila) {
          llamadas.push({ tipo: "upsert", tabla, fila });
          tablas[tabla].push(fila);
          return { error: null };
        },
      };
      return api;
    },
  };
}

function clienteStorage({ crear = null, subida = null, bajada = null, quitar = null } = {}) {
  const llamadas = [];
  return {
    llamadas,
    storage: {
      createBucket(nombre, opciones) {
        llamadas.push({ tipo: "cubo", nombre, opciones });
        return { error: crear };
      },
      from(nombre) {
        return {
          upload(archivo, buffer, opciones) {
            llamadas.push({ tipo: "subir", cubo: nombre, archivo, bytes: buffer.length, opciones });
            return { error: subida };
          },
          download(archivo) {
            llamadas.push({ tipo: "bajar", cubo: nombre, archivo });
            if (bajada instanceof Error) return { data: null, error: { message: bajada.message } };
            return {
              data: bajada
                ? { arrayBuffer: async () => Uint8Array.from(bajada).buffer }
                : null,
              error: bajada ? null : { message: "not found" },
            };
          },
          remove(nombres) {
            llamadas.push({ tipo: "quitar", cubo: nombre, nombres });
            return { error: quitar };
          },
        };
      },
    },
  };
}

test("leer pagina de a mil filas", async () => {
  const filas = Array.from({ length: 1001 }, (_, i) => ({ codigo: i }));
  const cliente = clienteTablas({ materiales: filas });
  const leidas = await leer("materiales", cliente);
  assert.equal(leidas.length, 1001);
  assert.deepEqual(
    cliente.llamadas.map((llamada) => llamada.desde),
    [0, 1000]
  );
});

test("leer corta si la tabla responde error", async () => {
  const cliente = {
    from() {
      return {
        select() {
          return this;
        },
        range() {
          return { data: null, error: { message: "tabla ausente" } };
        },
      };
    },
  };
  await assert.rejects(() => leer("materiales", cliente), /tabla ausente/);
});

test("reemplazar vacía la tabla e inserta de a 400", async () => {
  const filas = Array.from({ length: 401 }, (_, i) => ({ codigo: String(i) }));
  const tablas = { materiales: [{ codigo: "viejo" }] };
  const cliente = clienteTablas(tablas);
  await reemplazar("materiales", filas, "codigo", cliente);
  assert.equal(tablas.materiales.length, 401);
  assert.deepEqual(
    cliente.llamadas.map((llamada) => llamada.tipo),
    ["borrar", "insertar", "insertar"]
  );
  assert.deepEqual(
    cliente.llamadas.filter((llamada) => llamada.tipo === "insertar").map((llamada) => llamada.cantidad),
    [400, 1]
  );
});

test("guardarCarga hace upsert en ultimas_cargas", async () => {
  const cliente = clienteTablas();
  await guardarCarga({ clave: "sap", fecha: "2026-10-08" }, cliente);
  assert.equal(cliente.llamadas[0].tabla, "ultimas_cargas");
  assert.equal(cliente.llamadas[0].fila.clave, "sap");
});

test("una operación desconocida no toca tablas", async () => {
  await assert.rejects(() => main({ operacion: "otra" }), /desconocida/);
});

test("subir imagen crea el cubo público y reemplaza el archivo", async () => {
  const cliente = clienteStorage();
  await subirImagen("a-foto.png", Buffer.from("hola"), "image/png", cliente);
  assert.equal(cliente.llamadas[0].nombre, "imagenes");
  assert.equal(cliente.llamadas[0].opciones.public, true);
  assert.equal(cliente.llamadas[1].opciones.upsert, true);
  assert.equal(cliente.llamadas[1].opciones.contentType, "image/png");
});

test("si el cubo ya existe igual sube la imagen", async () => {
  const cliente = clienteStorage({ crear: { message: "The resource already exists" } });
  await subirImagen("a.png", Buffer.from("x"), "", cliente);
  assert.equal(cliente.llamadas.at(-1).tipo, "subir");
  assert.equal(cliente.llamadas.at(-1).opciones.contentType, "application/octet-stream");
});

test("un fallo al crear el cubo responde 502", async () => {
  const cliente = clienteStorage({ crear: { message: "permiso denegado" } });
  await assert.rejects(() => subirImagen("a.png", Buffer.from("x"), "image/png", cliente), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /permiso/);
    return true;
  });
});

test("bajar imagen devuelve el buffer o null si no está", async () => {
  const presente = clienteStorage({ bajada: Buffer.from("abc") });
  const buffer = await bajarImagen("a.png", presente);
  assert.equal(buffer.toString(), "abc");
  const ausente = clienteStorage();
  assert.equal(await bajarImagen("no.png", ausente), null);
});

test("quitar imagen ignora un archivo que no existe", async () => {
  const cliente = clienteStorage({ quitar: { message: "Object not found" } });
  await quitarImagen("a.png", cliente);
  await quitarImagen("", cliente);
  assert.equal(cliente.llamadas.length, 1);
});

test("interpretarSalida distingue tablas faltantes de otros fallos", () => {
  assert.deepEqual(interpretarSalida({ status: 0, stdout: '[{"codigo":"1"}]' }), [{ codigo: "1" }]);
  assert.equal(interpretarSalida({ status: 0, stdout: "" }), null);
  assert.throws(() => interpretarSalida({ status: 1, stderr: "PGRST205" }), (error) => {
    assert.equal(error.status, 503);
    assert.match(error.message, /faltan las tablas/);
    return true;
  });
  assert.throws(() => interpretarSalida({ status: 1, stderr: "timeout" }), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.message, "timeout");
    return true;
  });
});

test("interpretarProceso lee el json del proceso hijo", () => {
  assert.deepEqual(interpretarProceso({ status: 0, stdout: "[1]" }), [1]);
  assert.equal(interpretarProceso({ status: 0, stdout: "" }), null);
  assert.throws(() => interpretarProceso({ status: 1, stderr: "  corte  " }), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.message, "corte");
    return true;
  });
});
