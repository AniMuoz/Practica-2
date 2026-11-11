const assert = require("node:assert/strict");
const test = require("node:test");
const { requiereAdmin, soloAdminEnEscrituras } = require("../seguridad/soloAdmin");

const ESCRITURAS = [
  ["PUT", "/stock-detallado"],
  ["DELETE", "/stock-detallado/columna"],
  ["PUT", "/contratistas"],
  ["POST", "/movimientos/codigo"],
  ["PUT", "/movimientos/codigo"],
  ["DELETE", "/movimientos/codigo"],
  ["POST", "/tabla/excel"],
  ["POST", "/tabla/limpiar-inventario"],
  ["POST", "/material"],
  ["PUT", "/material/1/datos"],
  ["PUT", "/material/1/marcado"],
  ["DELETE", "/material/1"],
  ["POST", "/material/1/imagen"],
  ["POST", "/ventas"],
  ["PATCH", "/ventas/filas/5"],
  ["DELETE", "/ventas/filas/5"],
  ["DELETE", "/ventas/ordenes/1/2"],
];

const LIBRES = [
  ["GET", "/stock-detallado"],
  ["GET", "/stock-detallado/excel"],
  ["GET", "/contratistas"],
  ["GET", "/bodega"],
  ["GET", "/inventario"],
  ["GET", "/movimientos"],
  ["GET", "/material/1"],
  ["PUT", "/material/1"],
  ["PUT", "/material/ABC-12"],
  ["GET", "/ventas/auditoria"],
  ["POST", "/ventas/hojas"],
  ["POST", "/reserva"],
  ["POST", "/reserva/excel"],
  ["POST", "/gastos/procesar"],
  ["POST", "/gastos/guardar"],
  ["POST", "/gastos/recuperar"],
  ["GET", "/gastos/topicos"],
  ["POST", "/buzon"],
  ["POST", "/buzon/1/respuestas"],
  ["POST", "/acceso"],
  ["POST", "/login"],
  ["POST", "/cambiar-clave"],
];

test("las escrituras de Admin (stock detallado, contratistas, etc.) exigen rol admin", () => {
  for (const [metodo, ruta] of ESCRITURAS) assert.equal(requiereAdmin(metodo, ruta), true, `${metodo} ${ruta}`);
});

test("ver, filtrar, descargar, Gastos/Buzón y el conteo de material quedan abiertos a operadores", () => {
  for (const [metodo, ruta] of LIBRES) assert.equal(requiereAdmin(metodo, ruta), false, `${metodo} ${ruta}`);
});

test("cambiar mayusculas o añadir / final no salta la exigencia de admin", () => {
  for (const [metodo, ruta] of [
    ["PATCH", "/Ventas/filas/1"],
    ["POST", "/ventas/"],
    ["DELETE", "/movimientos/"],
    ["PUT", "/Stock-Detallado"],
    ["POST", "/tabla/Excel"],
    ["PUT", "/Contratistas/"],
  ]) assert.equal(requiereAdmin(metodo, ruta), true, `${metodo} ${ruta}`);
});

test("las lecturas nunca exigen admin aunque la ruta sea de escritura", () => {
  for (const metodo of ["GET", "HEAD", "OPTIONS"]) assert.equal(requiereAdmin(metodo, "/stock-detallado"), false);
});

function ejecutar(middleware, metodo, ruta) {
  return new Promise((resolve) => {
    const res = {};
    const responderError = (_res, error) => resolve({ bloqueado: true, status: error.status });
    const mw = middleware(responderError);
    mw({ method: metodo, path: ruta }, res, () => resolve({ bloqueado: false }));
  });
}

test("un operador recibe 403 en cada escritura de Admin y no llega a la ruta", async () => {
  const exigirAdmin = async () => {
    const error = new Error("Solo un administrador puede hacer esto.");
    error.status = 403;
    throw error;
  };
  for (const [metodo, ruta] of ESCRITURAS) {
    const resultado = await ejecutar((responder) => soloAdminEnEscrituras(exigirAdmin, responder), metodo, ruta);
    assert.deepEqual(resultado, { bloqueado: true, status: 403 }, `${metodo} ${ruta}`);
  }
});

test("un operador sigue pasando en lecturas, Gastos, Buzón y el guardado de inventario", async () => {
  const exigirAdmin = async () => {
    throw Object.assign(new Error("no admin"), { status: 403 });
  };
  for (const [metodo, ruta] of LIBRES) {
    const resultado = await ejecutar((responder) => soloAdminEnEscrituras(exigirAdmin, responder), metodo, ruta);
    assert.deepEqual(resultado, { bloqueado: false }, `${metodo} ${ruta}`);
  }
});

test("un administrador pasa en todas las escrituras de Admin", async () => {
  const exigirAdmin = async () => {};
  for (const [metodo, ruta] of ESCRITURAS) {
    const resultado = await ejecutar((responder) => soloAdminEnEscrituras(exigirAdmin, responder), metodo, ruta);
    assert.deepEqual(resultado, { bloqueado: false }, `${metodo} ${ruta}`);
  }
});

test("limpiar inventario: cualquier admin, solo en su propia bodega", async () => {
  const exigirAdmin = async () => {};
  const correr = (req) =>
    new Promise((resolve) => {
      const mw = soloAdminEnEscrituras(exigirAdmin, (_res, error) => resolve({ bloqueado: true, status: error.status }));
      mw({ method: "POST", path: "/tabla/limpiar-inventario", ...req }, {}, () => resolve({ bloqueado: false }));
    });
  assert.deepEqual(await correr({ bodega: "M502", bodegaActiva: "M502" }), { bloqueado: false });
  assert.deepEqual(await correr({ bodega: "M501", bodegaActiva: "M501" }), { bloqueado: false });
  assert.deepEqual(await correr({ bodega: "M502", bodegaActiva: "M503" }), { bloqueado: true, status: 403 });
  assert.deepEqual(await correr({ bodega: "M501", bodegaActiva: "M502" }), { bloqueado: true, status: 403 });
  // El superusuario puede limpiar cualquier bodega.
  assert.deepEqual(await correr({ usuario: "adminm501", bodega: "M501", bodegaActiva: "M503" }), { bloqueado: false });
});

test("un admin de otra bodega solo puede editar ubicacion y sub-ubicacion", async () => {
  const exigirAdmin = async () => {};
  const correr = (metodo, ruta, body) =>
    new Promise((resolve) => {
      const mw = soloAdminEnEscrituras(exigirAdmin, (_res, error) => resolve({ bloqueado: true, status: error.status }));
      mw({ method: metodo, path: ruta, bodega: "M502", body }, {}, () => resolve({ bloqueado: false }));
    });
  assert.deepEqual(await correr("PUT", "/material/1/datos", { datos: { "Ubicación": "A1", "Sub-ubicación": "A1" } }), { bloqueado: false });
  // Claves con sufijo de otra bodega y X-Bodega ajeno quedan bloqueados.
  assert.deepEqual(await correr("PUT", "/material/1/datos", { datos: { "Ubicación M503": "A1" } }), { bloqueado: true, status: 403 });
  const ajena = new Promise((resolve) => {
    const mw = soloAdminEnEscrituras(exigirAdmin, (_res, error) => resolve({ bloqueado: true, status: error.status }));
    mw({ method: "PUT", path: "/material/1/datos", bodega: "M502", bodegaActiva: "M501", body: { datos: { Ubicación: "A1" } } }, {}, () => resolve({ bloqueado: false }));
  });
  assert.deepEqual(await ajena, { bloqueado: true, status: 403 });
  assert.deepEqual(await correr("PUT", "/material/1/datos", { datos: { Precio: 5 } }), { bloqueado: true, status: 403 });
  assert.deepEqual(await correr("POST", "/ventas", {}), { bloqueado: true, status: 403 });
  assert.deepEqual(await correr("POST", "/bitacora/folios", {}), { bloqueado: true, status: 403 });
});


