process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";
process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const limite = require("../limiteClave");
const { claveCorrecta, CLAVE_DATOS } = require("../nucleoDatos");

function enPeticion(ip, fn) {
  return limite.contexto.run({ ip }, fn);
}

test.beforeEach(() => limite.reiniciar());

test("fuera de una peticion HTTP no limita", () => {
  for (let i = 0; i < 10; i += 1) assert.equal(claveCorrecta("mala"), false);
  assert.equal(claveCorrecta(CLAVE_DATOS), true);
});

test("el 4.o intento tras 3 fallos responde 429, sin sesion ni rol", () => {
  enPeticion("1.1.1.1", () => {
    for (let i = 0; i < 3; i += 1) assert.equal(claveCorrecta("mala"), false);
    assert.throws(() => claveCorrecta("mala"), { status: 429 });
    assert.throws(() => claveCorrecta(CLAVE_DATOS), { status: 429 });
  });
});

test("el bloqueo es por IP", () => {
  enPeticion("1.1.1.1", () => {
    for (let i = 0; i < 3; i += 1) claveCorrecta("mala");
  });
  enPeticion("2.2.2.2", () => assert.equal(claveCorrecta(CLAVE_DATOS), true));
});

test("tras 15 minutos se puede volver a intentar", () => {
  let t = 1000;
  limite.reiniciar(() => t);
  enPeticion("1.1.1.1", () => {
    for (let i = 0; i < 3; i += 1) claveCorrecta("mala");
    t += limite.BLOQUEO_MS - 1;
    assert.throws(() => claveCorrecta(CLAVE_DATOS), { status: 429 });
    t += 2;
    assert.equal(claveCorrecta(CLAVE_DATOS), true);
  });
});

test("un acierto reinicia el contador", () => {
  enPeticion("1.1.1.1", () => {
    claveCorrecta("mala");
    claveCorrecta("mala");
    assert.equal(claveCorrecta(CLAVE_DATOS), true);
    claveCorrecta("mala");
    claveCorrecta("mala");
    assert.equal(claveCorrecta("mala"), false);
  });
});

test("POST /api/acceso real: 3 claves malas y luego 429, sin sesion", async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
  const { app } = require("../server");
  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const llamar = (clave) =>
      fetch(`http://127.0.0.1:${servidor.address().port}/api/acceso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
    for (let i = 0; i < 3; i += 1) assert.equal((await llamar("mala")).status, 403);
    assert.equal((await llamar("mala")).status, 429);
    assert.equal((await llamar(CLAVE_DATOS)).status, 429);
  } finally {
    servidor.close();
  }
});
