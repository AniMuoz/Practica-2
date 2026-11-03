const assert = require("node:assert/strict");
const test = require("node:test");
const { comprobarBase, reiniciarSalud } = require("../salud");

function clienteCon(error) {
  const llamadas = [];
  return {
    llamadas,
    from(tabla) {
      llamadas.push(tabla);
      return { select: () => ({ limit: async () => ({ error }) }) };
    },
  };
}

test("la base responde: ok y se reutiliza el resultado durante un minuto", async () => {
  reiniciarSalud();
  const cliente = clienteCon(null);
  assert.deepEqual(await comprobarBase(cliente, 1000), { ok: true });
  assert.deepEqual(await comprobarBase(cliente, 30000), { ok: true });
  assert.equal(cliente.llamadas.length, 1);
  await comprobarBase(cliente, 61001);
  assert.equal(cliente.llamadas.length, 2);
});

test("una tabla que falta cuenta como base viva y otro error no", async () => {
  reiniciarSalud();
  assert.deepEqual(await comprobarBase(clienteCon({ code: "PGRST205" }), 1), { ok: true });
  reiniciarSalud();
  assert.deepEqual(await comprobarBase(clienteCon({ code: "XX" }), 1), { ok: false });
  reiniciarSalud();
});
