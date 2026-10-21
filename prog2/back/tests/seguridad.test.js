process.env.RATE_LIMIT_POR_MINUTO = "3";
process.env.ALLOWED_ORIGINS = "https://app.test/, https://otra.test";

const assert = require("node:assert/strict");
const test = require("node:test");
const { middlewareCors, cabecerasSeguras, limitarPeticiones, exigirProxy, MAX_EVENTOS } = require("../seguridad");

function resFalsa() {
  const res = { headers: {}, quitados: [], codigo: 200, cuerpo: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { res.quitados.push(k); };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
}

test("MAX_EVENTOS tiene un valor por defecto numerico", () => {
  assert.equal(MAX_EVENTOS, 100);
});

test("cabecerasSeguras fija las cabeceras y quita X-Powered-By", () => {
  const res = resFalsa();
  let siguio = false;
  cabecerasSeguras({}, res, () => { siguio = true; });
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
  assert.ok(res.headers["Strict-Transport-Security"]);
  assert.deepEqual(res.quitados, ["X-Powered-By"]);
  assert.ok(siguio);
});

test("middlewareCors sin origenes configurados deja pasar sin cabeceras CORS", () => {
  const anterior = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "";
  const mw = middlewareCors();
  process.env.ALLOWED_ORIGINS = anterior;
  const res = resFalsa();
  let siguio = false;
  mw({ method: "GET", headers: { origin: "https://x.test" } }, res, () => { siguio = true; });
  assert.ok(siguio);
  assert.equal(res.headers["Access-Control-Allow-Origin"], undefined);
});

function ejecutarCors(origin) {
  const mw = middlewareCors();
  const res = resFalsa();
  res.getHeader = (k) => res.headers[k];
  res.end = () => {};
  const req = { method: "GET", headers: origin ? { origin } : {} };
  mw(req, res, () => {});
  return res.headers;
}

test("middlewareCors permite solo origenes listados (ignora barra final)", () => {
  assert.equal(ejecutarCors("https://app.test")["Access-Control-Allow-Origin"], "https://app.test");
  assert.equal(ejecutarCors("https://otra.test")["Access-Control-Allow-Origin"], "https://otra.test");
  assert.equal(ejecutarCors("https://malo.test")["Access-Control-Allow-Origin"], undefined);
});

test("exigirProxy deja pasar /healthz y exige el secreto en el resto", () => {
  const anterior = process.env.SECRETO_PROXY;
  process.env.SECRETO_PROXY = "secreto-real";
  try {
    let salud = false;
    exigirProxy({ path: "/healthz", get: () => "" }, resFalsa(), () => { salud = true; });
    assert.equal(salud, true);
    const rechazado = resFalsa();
    let paso = false;
    exigirProxy({ path: "/api/login", get: () => "otro" }, rechazado, () => { paso = true; });
    assert.equal(paso, false);
    assert.equal(rechazado.codigo, 403);
    let ok = false;
    exigirProxy({ path: "/api/login", get: (nombre) => (nombre === "x-secreto-proxy" ? "secreto-real" : "") }, resFalsa(), () => { ok = true; });
    assert.equal(ok, true);
  } finally {
    if (anterior === undefined) delete process.env.SECRETO_PROXY;
    else process.env.SECRETO_PROXY = anterior;
  }
});

test("limitarPeticiones bloquea con 429 al superar el maximo por IP", () => {
  const req = { path: "/x", headers: { "cf-connecting-ip": "1.1.1.1" } };
  for (let i = 0; i < 3; i++) {
    let ok = false;
    limitarPeticiones(req, resFalsa(), () => { ok = true; });
    assert.ok(ok);
  }
  const res = resFalsa();
  let ok = false;
  limitarPeticiones(req, res, () => { ok = true; });
  assert.equal(ok, false);
  assert.equal(res.codigo, 429);
  assert.ok(Number(res.headers["Retry-After"]) > 0);
  assert.ok(res.cuerpo.error);
});

test("limitarPeticiones cuenta por IP por separado y usa x-forwarded-for", () => {
  const a = { path: "/x", headers: { "x-forwarded-for": "2.2.2.2, 9.9.9.9" } };
  const b = { path: "/x", headers: { "x-forwarded-for": "3.3.3.3" } };
  for (let i = 0; i < 4; i++) limitarPeticiones(a, resFalsa(), () => {});
  let ok = false;
  limitarPeticiones(b, resFalsa(), () => { ok = true; });
  assert.ok(ok);
});

test("limitarPeticiones no limita /eventos", () => {
  const req = { path: "/eventos", headers: { "cf-connecting-ip": "4.4.4.4" } };
  let pasos = 0;
  for (let i = 0; i < 10; i++) limitarPeticiones(req, resFalsa(), () => { pasos++; });
  assert.equal(pasos, 10);
});
