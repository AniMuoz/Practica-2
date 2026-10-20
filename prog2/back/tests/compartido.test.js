const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const compartido = require("../compartido");

const { conColores, nombreConFecha, enviarPlanilla, emitir, clientesEventos } = compartido;

test("conColores es true salvo cuando el valor es '0'", () => {
  assert.equal(conColores("0"), false);
  assert.equal(conColores("1"), true);
  assert.equal(conColores(undefined), true);
});

test("nombreConFecha genera un Content-Disposition con fecha dd-mm-aaaa", () => {
  const d = nombreConFecha("Stock total");
  assert.match(d, /^attachment; filename=Stock%20total%20\d{2}-\d{2}-\d{4}\.xlsx$/);
});

test("enviarPlanilla fija cabeceras y envia el buffer", () => {
  const headers = {};
  let enviado;
  const res = { setHeader: (k, v) => { headers[k] = v; }, send: (b) => { enviado = b; } };
  enviarPlanilla(res, new Uint8Array([1, 2, 3]), "attachment; filename=a.xlsx");
  assert.match(headers["Content-Type"], /spreadsheetml/);
  assert.equal(headers["Content-Disposition"], "attachment; filename=a.xlsx");
  assert.ok(Buffer.isBuffer(enviado));
  assert.deepEqual([...enviado], [1, 2, 3]);
});

test("emitir escribe el evento SSE a todos los clientes conectados", () => {
  const recibidos = [];
  const c1 = { write: (m) => recibidos.push(m) };
  const c2 = { write: (m) => recibidos.push(m) };
  clientesEventos.add(c1);
  clientesEventos.add(c2);
  try {
    emitir({ tipo: "cambio" });
  } finally {
    clientesEventos.delete(c1);
    clientesEventos.delete(c2);
  }
  assert.deepEqual(recibidos, ['data: {"tipo":"cambio"}\n\n', 'data: {"tipo":"cambio"}\n\n']);
});

async function conServidor(middleware, campo, fn) {
  const app = express();
  app.post("/subir/:codigo", middleware.single(campo), (req, res) => res.json({ nombre: req.file?.originalname }));
  app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    await fn(`http://127.0.0.1:${server.address().port}/subir/ABC`);
  } finally {
    server.close();
  }
}

async function enviar(url, campo, nombre, tipo, bytes = 10) {
  const form = new FormData();
  form.append(campo, new Blob([new Uint8Array(bytes)], { type: tipo }), nombre);
  const r = await fetch(url, { method: "POST", body: form });
  return { status: r.status, cuerpo: await r.json() };
}

test("uploadXlsx acepta .xlsx y rechaza otras extensiones", async () => {
  await conServidor(compartido.uploadXlsx, "archivo", async (url) => {
    assert.equal((await enviar(url, "archivo", "datos.XLSX", "application/octet-stream")).status, 200);
    const mal = await enviar(url, "archivo", "datos.csv", "text/csv");
    assert.equal(mal.status, 400);
    assert.match(mal.cuerpo.error, /xlsx/);
  });
});

test("uploadPdf acepta .pdf y rechaza otras extensiones", async () => {
  await conServidor(compartido.uploadPdf, "archivo", async (url) => {
    assert.equal((await enviar(url, "archivo", "r.pdf", "application/pdf")).status, 200);
    assert.equal((await enviar(url, "archivo", "r.txt", "text/plain")).status, 400);
  });
});

test("uploadFirma solo acepta PNG/JPG y limita a 100 KB", async () => {
  await conServidor(compartido.uploadFirma, "firma", async (url) => {
    assert.equal((await enviar(url, "firma", "f.png", "image/png")).status, 200);
    assert.equal((await enviar(url, "firma", "f.gif", "image/gif")).status, 400);
    assert.equal((await enviar(url, "firma", "f.png", "image/png", 200 * 1024)).status, 400);
  });
});

test("upload (imagenes) rechaza tipos que no son imagen", async () => {
  await conServidor(compartido.upload, "imagen", async (url) => {
    const r = await enviar(url, "imagen", "x.pdf", "application/pdf");
    assert.equal(r.status, 400);
  });
});
