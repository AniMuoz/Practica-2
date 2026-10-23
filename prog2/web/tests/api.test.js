import test from "node:test";
import assert from "node:assert/strict";
import { obtenerJson, enviarJson, enviarFormulario, descargarBlob } from "../src/api.js";

function simularFetch(respuesta) {
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return respuesta;
  };
  return llamadas;
}

const ok = (cuerpo) => ({ ok: true, status: 200, json: async () => cuerpo, blob: async () => "blob" });
const falla = (status, cuerpo) => ({ ok: false, status, json: async () => cuerpo, blob: async () => "blob" });

test("obtenerJson pide sin cache y devuelve el JSON", async () => {
  const llamadas = simularFetch(ok({ a: 1 }));
  assert.deepEqual(await obtenerJson("/api/x"), { a: 1 });
  assert.equal(llamadas[0].opciones.cache, "no-store");
});

test("obtenerJson lanza el mensaje del servidor o el de respaldo", async () => {
  simularFetch(falla(400, { error: "Mal" }));
  await assert.rejects(obtenerJson("/api/x", "Respaldo"), { message: "Mal", status: 400 });
  simularFetch({ ok: false, status: 500, json: async () => { throw new Error("no json"); } });
  await assert.rejects(obtenerJson("/api/x", "Respaldo"), { message: "Respaldo" });
});

test("enviarJson manda cuerpo JSON con el metodo indicado", async () => {
  const llamadas = simularFetch(ok({ ok: true }));
  await enviarJson("/api/x", { clave: "k" }, "m", "PUT");
  assert.equal(llamadas[0].opciones.method, "PUT");
  assert.equal(llamadas[0].opciones.headers["Content-Type"], "application/json");
  assert.equal(llamadas[0].opciones.body, JSON.stringify({ clave: "k" }));
});

test("enviarFormulario no fija Content-Type (lo pone el navegador)", async () => {
  const llamadas = simularFetch(ok({}));
  const formulario = { fake: true };
  await enviarFormulario("/api/x", formulario);
  assert.equal(llamadas[0].opciones.body, formulario);
  assert.equal(llamadas[0].opciones.headers, undefined);
});

test("descargarBlob devuelve el blob y propaga errores JSON", async () => {
  simularFetch(ok({}));
  assert.equal(await descargarBlob("/api/x"), "blob");
  simularFetch(falla(403, { error: "Prohibido" }));
  await assert.rejects(descargarBlob("/api/x"), { message: "Prohibido" });
});
