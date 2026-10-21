const assert = require("node:assert/strict");
const test = require("node:test");
const { ipDe, verificarEntorno } = require("../seguridad");

function conEntorno(valores, fn) {
  const anteriores = {};
  for (const [k, v] of Object.entries(valores)) {
    anteriores[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(anteriores)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("ipDe ignora x-forwarded-for cuando hay SECRETO_PROXY", () => {
  const req = { headers: { "x-forwarded-for": "6.6.6.6" }, ip: "10.0.0.1" };
  conEntorno({ SECRETO_PROXY: "s" }, () => {
    assert.equal(ipDe(req), "10.0.0.1");
    assert.equal(ipDe({ ...req, headers: { ...req.headers, "cf-connecting-ip": "7.7.7.7" } }), "7.7.7.7");
  });
});

test("verificarEntorno exige secretos solo en produccion", () => {
  conEntorno({ NODE_ENV: "production", RENDER: undefined, SECRETO_PROXY: undefined, SESSION_SECRET: "a" }, () => {
    assert.throws(() => verificarEntorno(), /SECRETO_PROXY/);
  });
  conEntorno({ NODE_ENV: "production", RENDER: undefined, SECRETO_PROXY: "a", SESSION_SECRET: "b" }, () => {
    assert.doesNotThrow(() => verificarEntorno());
  });
  conEntorno({ NODE_ENV: "test", RENDER: undefined, SECRETO_PROXY: undefined, SESSION_SECRET: undefined }, () => {
    assert.doesNotThrow(() => verificarEntorno());
  });
});
