const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { app } = require("./server");
const { calcularRecorrido, limpiarFila, enteroPositivo, armarExcel, dimensionesPng, nombreFirma } = require("./bitacora");

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
        resolve({ status: respuesta.status, json: await respuesta.json().catch(() => null) });
      } catch (error) {
        reject(error);
      } finally {
        servidor.close();
      }
    });
  });
}

test("KM/RECO se calcula como KM/TERM menos KM/INI", () => {
  assert.equal(calcularRecorrido("100", "250"), "150");
  assert.equal(calcularRecorrido("100,5", "250"), "149.5");
  assert.equal(calcularRecorrido("", "250"), "");
  assert.equal(calcularRecorrido("abc", "250"), "");
});

test("limpiarFila recorta, ignora campos ajenos y recalcula KM/RECO", () => {
  const fila = limpiarFila({ chofer: "  Ana ", km_ini: "10", km_term: "35", km_reco: "999", otro: "x" });
  assert.equal(fila.chofer, "Ana");
  assert.equal(fila.km_reco, "25");
  assert.equal(fila.otro, undefined);
  assert.equal(fila.fecha, "");
  assert.throws(() => limpiarFila(null), { status: 400 });
});

test("la fecha debe venir del calendario (aaaa-mm-dd) o estar vacía", () => {
  assert.equal(limpiarFila({ fecha: "2026-10-09" }).fecha, "2026-10-09");
  assert.equal(limpiarFila({ fecha: "" }).fecha, "");
  ["09/10/2026", "2026-02-30", "hoy"].forEach((fecha) => {
    assert.throws(() => limpiarFila({ fecha }), { status: 400 });
  });
});

test("el folio debe ser un entero desde 1", () => {
  assert.equal(enteroPositivo("7", "Folio"), 7);
  ["0", "-1", "abc", "1.5", ""].forEach((valor) => {
    assert.throws(() => enteroPositivo(valor, "Folio"), { status: 400 });
  });
});

test("el Excel del folio respeta la estructura de la planilla", async () => {
  const filas = [{ n_fila: 1, fecha: "2026-10-09", chofer: "Ana", rut: "1-9", patente: "AB1234", ruta: "Norte", h_salida: "08:00", h_llegada: "18:00", km_ini: "100", km_term: "250", km_reco: "150", observacion: "ok", firma: "" }];
  const buffer = await armarExcel(12, filas);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.getWorksheet("Hoja1");
  assert.equal(hoja.getCell("C1").value, "PLANILLA CONTROL DE VIAJE");
  assert.equal(hoja.getCell("K1").value, "FOLIO Nº 12");
  assert.ok(hoja.getCell("L1").isMerged);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((columna) => hoja.getCell(4, columna).value),
    ["FECHA", "CHOFER", "RUT", "PATENTE", "RUTA", "H.SALIDA", "H.LLEGADA", "KM/INI", "KM/TERM", "KM/RECO", "OBSERVACION", "FIRMA"]
  );
  assert.equal(hoja.getCell("A5").value, "09/10/2026");
  assert.equal(hoja.getCell("B5").value, "Ana");
  ["A5", "B5", "J5", "K5"].forEach((direccion) => {
    assert.equal(hoja.getCell(direccion).alignment.horizontal, "center");
    assert.equal(hoja.getCell(direccion).alignment.vertical, "middle");
  });
  assert.equal(hoja.getCell("A5").alignment.shrinkToFit, true);
  assert.equal(hoja.getCell("J5").value, 150);
  assert.equal(hoja.getCell("A5").border.top.style, "thin");
  assert.equal(hoja.getCell("A6").border, undefined);
  assert.equal(hoja.getCell("A18").border, undefined);
  assert.equal(hoja.pageSetup.orientation, "landscape");
  assert.equal(hoja.getImages().length, 1);
});

test("el Excel crece más allá de 14 filas con el mismo formato", async () => {
  const filas = Array.from({ length: 20 }, (_, indice) => ({ n_fila: indice + 1, chofer: `C${indice + 1}` }));
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await armarExcel(3, filas));
  const hoja = libro.getWorksheet("Hoja1");
  assert.equal(hoja.getCell("B24").value, "C20");
  assert.equal(hoja.getCell("L24").border.bottom.style, "thin");
});

test("la firma como imagen solo acepta PNG y se reconoce por su nombre", () => {
  const logo = fs.readFileSync(path.join(__dirname, "assets", "logo-bitacora.png"));
  const medidas = dimensionesPng(logo);
  assert.ok(medidas.ancho > 0 && medidas.alto > 0);
  assert.equal(dimensionesPng(Buffer.from("no es una imagen")), null);
  assert.equal(nombreFirma("img:firma-3-2-1700000000000.png"), "firma-3-2-1700000000000.png");
  assert.equal(nombreFirma("img:../secreto.png"), null);
  assert.equal(nombreFirma("Juan Perez"), null);
});

test("el Excel pone la firma como imagen dentro de la celda y deja el texto como texto", async () => {
  const logo = fs.readFileSync(path.join(__dirname, "assets", "logo-bitacora.png"));
  const filas = [
    { n_fila: 1, firma: "img:firma-5-1-1700000000000.png" },
    { n_fila: 2, firma: "J. Perez" },
  ];
  const imagenes = new Map([["firma-5-1-1700000000000.png", logo]]);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await armarExcel(5, filas, imagenes));
  const hoja = libro.getWorksheet("Hoja1");
  assert.equal(hoja.getImages().length, 2);
  assert.equal(hoja.getCell("L5").value, null);
  assert.equal(hoja.getCell("L6").value, "J. Perez");
  assert.equal(hoja.getCell("L6").alignment.horizontal, "center");
  assert.equal(hoja.getCell("L6").alignment.vertical, "middle");
  assert.equal(hoja.getCell("L5").alignment, undefined);
  const firma = hoja.getImages().map((imagen) => imagen.range.tl).find((tl) => tl.nativeCol === 11);
  assert.equal(firma.nativeRow, 4);
});

test("subir una firma sin clave, sin archivo o con otro formato se rechaza", async () => {
  assert.equal((await pedir("POST", "/api/bitacora/folios/1/filas/1/firma", { clave: "no" })).status, 403);
  assert.equal((await pedir("POST", "/api/bitacora/folios/1/filas/1/firma", { clave: "Berfre2026" })).status, 400);
  assert.equal((await pedir("POST", "/api/bitacora/folios/abc/filas/1/firma", { clave: "Berfre2026" })).status, 400);
});

test("consultar un folio inválido responde 400 sin tocar la base", async () => {
  const respuesta = await pedir("GET", "/api/bitacora/folios/abc");
  assert.equal(respuesta.status, 400);
});

test("generar un folio o guardar una fila sin clave responde 403", async () => {
  assert.equal((await pedir("POST", "/api/bitacora/folios", { clave: "no" })).status, 403);
  assert.equal((await pedir("PUT", "/api/bitacora/folios/1/filas/1", { clave: "no", datos: {} })).status, 403);
  assert.equal((await pedir("DELETE", "/api/bitacora/folios/1/filas/1", { clave: "no" })).status, 403);
  assert.equal((await pedir("DELETE", "/api/bitacora/folios/1", { clave: "no", confirmacion: "1" })).status, 403);
});

test("eliminar un folio exige que la confirmación coincida con su número", async () => {
  const sinConfirmar = await pedir("DELETE", "/api/bitacora/folios/5", { clave: "Berfre2026" });
  assert.equal(sinConfirmar.status, 400);
  const distinta = await pedir("DELETE", "/api/bitacora/folios/5", { clave: "Berfre2026", confirmacion: "6" });
  assert.equal(distinta.status, 400);
  const invalido = await pedir("DELETE", "/api/bitacora/folios/abc", { clave: "Berfre2026", confirmacion: "abc" });
  assert.equal(invalido.status, 400);
});
