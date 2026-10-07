const assert = require("node:assert/strict");
const test = require("node:test");
const { app, conColores } = require("./server");

function pedir(metodo, ruta, cuerpo) {
  return new Promise((resolve, reject) => {
    const servidor = app.listen(0, "127.0.0.1", async () => {
      const { port } = servidor.address();
      try {
        const respuesta = await fetch(`http://127.0.0.1:${port}${ruta}`, {
          method: metodo,
          headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
          body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        });
        const texto = await respuesta.text();
        let json = null;
        try {
          json = JSON.parse(texto);
        } catch {
          json = null;
        }
        resolve({ status: respuesta.status, json, texto });
      } catch (error) {
        reject(error);
      } finally {
        servidor.close();
      }
    });
  });
}

test("conColores queda activo salvo que el query sea 0", () => {
  assert.equal(conColores(undefined), true);
  assert.equal(conColores("1"), true);
  assert.equal(conColores("0"), false);
});

test("la API de prueba responde el mensaje fijo", async () => {
  const respuesta = await pedir("GET", "/api/mensaje");
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.json.texto, "Prueba de proyecto berfre");
});

test("buscar con menos de dos letras no consulta materiales", async () => {
  const respuesta = await pedir("GET", "/api/buscar?q=a");
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.json.resultados, []);
});

test("agregar un material sin clave responde 403", async () => {
  const respuesta = await pedir("POST", "/api/material", { clave: "no", datos: { Codigo: "1" } });
  assert.equal(respuesta.status, 403);
});

test("limpiar inventario con clave incorrecta responde 403", async () => {
  const respuesta = await pedir("POST", "/api/tabla/limpiar-inventario", { clave: "no" });
  assert.equal(respuesta.status, 403);
});

test("la revisión de reserva exige un número", async () => {
  const respuesta = await pedir("GET", "/api/reservas/excel?reserva=");
  assert.equal(respuesta.status, 400);
  assert.match(respuesta.json.error, /reserva/i);
});
