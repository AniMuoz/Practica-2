import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker.js";

const DESTINO = "https://practica-2-vnu7.onrender.com";

async function conFetchFalso(solicitud, respuesta = new Response("ok")) {
  const original = globalThis.fetch;
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return respuesta;
  };
  try {
    const resultado = await worker.fetch(solicitud, { API: DESTINO });
    return { llamadas, resultado };
  } finally {
    globalThis.fetch = original;
  }
}

test("el worker reenvía la ruta y el query a la API real cambiando el host", async () => {
  const { llamadas } = await conFetchFalso(new Request("https://miapp.example.com/api/tabla?orden=codigo&q=a%20b", {
    headers: { "x-prueba": "1", cookie: "sesion=abc" },
  }));
  assert.equal(llamadas.length, 1);
  assert.equal(String(llamadas[0].url), `${DESTINO}/api/tabla?orden=codigo&q=a%20b`);
  assert.equal(llamadas[0].opciones.method, "GET");
  assert.equal(llamadas[0].opciones.headers.get("host"), null);
  assert.equal(llamadas[0].opciones.headers.get("x-prueba"), "1");
  assert.equal(llamadas[0].opciones.headers.get("cookie"), "sesion=abc");
  assert.equal(llamadas[0].opciones.redirect, "manual");
});

test("el worker no envía cuerpo en GET ni en HEAD", async () => {
  for (const metodo of ["GET", "HEAD"]) {
    const { llamadas } = await conFetchFalso(new Request("https://miapp.example.com/api/x", { method: metodo }));
    assert.equal(llamadas[0].opciones.body, undefined);
    assert.equal(llamadas[0].opciones.method, metodo);
  }
});

test("el worker reenvía el cuerpo en POST, PUT y DELETE", async () => {
  for (const metodo of ["POST", "PUT", "DELETE"]) {
    const solicitud = new Request("https://miapp.example.com/api/material", { method: metodo, body: JSON.stringify({ a: 1 }), headers: { "content-type": "application/json" } });
    const { llamadas } = await conFetchFalso(solicitud);
    assert.equal(llamadas[0].opciones.method, metodo);
    assert.ok(llamadas[0].opciones.body);
    assert.equal(llamadas[0].opciones.headers.get("content-type"), "application/json");
  }
});

test("el worker devuelve tal cual la respuesta de la API, incluidos los errores", async () => {
  const respuesta = new Response(JSON.stringify({ error: "no" }), { status: 403 });
  const { resultado } = await conFetchFalso(new Request("https://miapp.example.com/api/acceso", { method: "POST", body: "{}" }), respuesta);
  assert.equal(resultado, respuesta);
  assert.equal(resultado.status, 403);
});

test("sin la variable API de Cloudflare responde 500", async () => {
  const resultado = await worker.fetch(new Request("https://miapp.example.com/api/sesion"), {});
  assert.equal(resultado.status, 500);
  assert.equal(await resultado.text(), "Falta la variable API en Cloudflare");
});

test("el worker no modifica los encabezados originales de la solicitud", async () => {
  const solicitud = new Request("https://miapp.example.com/api/x", { headers: { host: "miapp.example.com" } });
  await conFetchFalso(solicitud);
  assert.equal(solicitud.headers.get("host"), "miapp.example.com");
});
