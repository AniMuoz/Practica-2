process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

// ---------- Supabase falso: tablas en memoria con el mismo encadenado de consultas ----------

let tablas;
let siguiente;
let fallos;
let operaciones;

function reiniciarBd() {
  tablas = { bitacora_folios: [], bitacora_filas: [], bitacora_firmas_historial: [], bitacora_log: [] };
  siguiente = { bitacora_folios: 1, bitacora_firmas_historial: 1, bitacora_log: 1 };
  fallos = {};
  operaciones = [];
}

function consulta(tabla) {
  const e = { op: "select", filtros: [], orden: null, limite: null, rango: null, valores: null, opciones: null, head: false, contar: false, unico: null, devolver: false };
  const b = {
    select(_columnas, opciones) {
      if (e.op === "insert") e.devolver = true;
      if (opciones && opciones.head) e.head = true;
      if (opciones && opciones.count) e.contar = true;
      return b;
    },
    insert(valores) { e.op = "insert"; e.valores = valores; return b; },
    upsert(valores, opciones) { e.op = "upsert"; e.valores = valores; e.opciones = opciones; return b; },
    update(valores) { e.op = "update"; e.valores = valores; return b; },
    delete() { e.op = "delete"; return b; },
    eq(campo, valor) { e.filtros.push((fila) => fila[campo] === valor); return b; },
    is(campo, valor) { e.filtros.push((fila) => (valor === null ? fila[campo] == null : fila[campo] === valor)); return b; },
    gt(campo, valor) { e.filtros.push((fila) => fila[campo] > valor); return b; },
    order(campo, { ascending = true } = {}) { e.orden = { campo, ascending }; return b; },
    limit(n) { e.limite = n; return b; },
    range(desde, hasta) { e.rango = [desde, hasta]; return b; },
    maybeSingle() { e.unico = "maybe"; return b; },
    single() { e.unico = "single"; return b; },
    then(resolver, rechazar) {
      return Promise.resolve(ejecutar()).then(resolver, rechazar);
    },
  };

  function ejecutar() {
    operaciones.push({ tabla, op: e.op });
    const fallo = fallos[`${tabla}.${e.op}`];
    if (fallo) return { data: null, count: null, error: fallo };
    const filas = tablas[tabla];
    const coincide = (fila) => e.filtros.every((filtro) => filtro(fila));

    if (e.op === "insert") {
      const nueva = { ...e.valores };
      if (tabla === "bitacora_folios") {
        nueva.folio = siguiente.bitacora_folios++;
        nueva.creado_en = new Date(Date.UTC(2026, 0, 1) + nueva.folio * 1000).toISOString();
        nueva.eliminado_en = null;
      }
      if (tabla === "bitacora_firmas_historial") {
        nueva.id = siguiente.bitacora_firmas_historial++;
        nueva.quitada_en = new Date(Date.UTC(2026, 0, 1) + nueva.id * 1000).toISOString();
      }
      if (tabla === "bitacora_log") {
        for (const v of [].concat(e.valores)) filas.push({ ...v, id: siguiente.bitacora_log++, creado_en: new Date(Date.UTC(2026, 0, 1) + siguiente.bitacora_log * 1000).toISOString() });
        return { data: null, error: null };
      }
      filas.push(nueva);
      return { data: e.devolver ? { ...nueva } : null, error: null };
    }
    if (e.op === "upsert") {
      const claves = String(e.opciones?.onConflict || "").split(",");
      const existente = filas.find((fila) => claves.every((clave) => fila[clave] === e.valores[clave]));
      if (existente) Object.assign(existente, e.valores);
      else filas.push({ ...e.valores });
      return { data: null, error: null };
    }
    if (e.op === "update") {
      filas.filter(coincide).forEach((fila) => Object.assign(fila, e.valores));
      return { data: null, error: null };
    }
    if (e.op === "delete") {
      tablas[tabla] = filas.filter((fila) => !coincide(fila));
      return { data: null, error: null };
    }

    let resultado = filas.filter(coincide).map((fila) => ({ ...fila }));
    const total = resultado.length;
    if (e.orden) {
      const { campo, ascending } = e.orden;
      resultado.sort((a, c) => (a[campo] < c[campo] ? -1 : a[campo] > c[campo] ? 1 : 0) * (ascending ? 1 : -1));
    }
    if (e.rango) resultado = resultado.slice(e.rango[0], e.rango[1] + 1);
    if (e.limite != null) resultado = resultado.slice(0, e.limite);
    if (e.head) return { data: null, count: total, error: null };
    if (e.unico) return { data: resultado[0] ?? null, error: null };
    return { data: resultado, count: e.contar ? total : null, error: null };
  }
  return b;
}

const { supabase } = require("../supabase");
supabase.from = (tabla) => consulta(tabla);

// Almacenamiento de imágenes falso.
const imagenes = require("../imagenesSupabase");
let subidas;
let quitadas;
let almacen;
let falloBajada;
imagenes.subirImagen = async (nombre, buffer, tipo) => {
  subidas.push({ nombre, tipo });
  almacen.set(nombre, buffer);
};
imagenes.quitarImagen = async (nombre) => {
  quitadas.push(nombre);
  almacen.delete(nombre);
};
imagenes.bajarImagen = async (nombre) => {
  if (falloBajada) throw new Error("storage caído");
  return almacen.get(nombre) ?? null;
};

const bitacora = require("../bitacora");
const CLAVE = require("../nucleoDatos").CLAVE_DATOS;

test.mock.method(console, "error", () => {});
test.beforeEach(() => {
  reiniciarBd();
  subidas = [];
  quitadas = [];
  almacen = new Map();
  falloBajada = false;
});

function png(ancho = 100, alto = 50, largo = 33) {
  const buffer = Buffer.alloc(largo);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(ancho, 16);
  buffer.writeUInt32BE(alto, 20);
  return buffer;
}

const VIAJE = { fecha: "2026-10-09", chofer: "Ana", rut: "12.345.678-5", patente: "AB1234", ruta: "A-B", h_salida: "08:00", h_llegada: "10:00", km_ini: "100", km_term: "150" };

async function folioConFila(datos = VIAJE) {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await bitacora.guardarFila(CLAVE, folio, 1, datos);
  return folio;
}

async function folioConFirma() {
  const folio = await folioConFila();
  const { fila } = await bitacora.subirFirma(CLAVE, folio, 1, png(), "12345678-5");
  return { folio, fila };
}

// ---------- folios ----------

test("crearFolio exige la clave y entrega folios consecutivos sin filas", async () => {
  await assert.rejects(bitacora.crearFolio("mala"), { status: 403 });
  assert.equal(tablas.bitacora_folios.length, 0);
  const primero = await bitacora.crearFolio(CLAVE);
  const segundo = await bitacora.crearFolio(CLAVE);
  assert.equal(primero.folio, 1);
  assert.equal(segundo.folio, 2);
  assert.deepEqual(primero.filas, []);
  assert.ok(primero.creado_en);
});

test("los fallos de Supabase se traducen: tablas faltantes a 503 y el resto a 502", async () => {
  for (const code of ["PGRST205", "42P01", "42703"]) {
    fallos["bitacora_folios.insert"] = { code, message: "x" };
    await assert.rejects(bitacora.crearFolio(CLAVE), { status: 503, message: /esquema\.sql/ });
  }
  fallos["bitacora_folios.insert"] = { code: "XX", message: "sin red" };
  await assert.rejects(bitacora.crearFolio(CLAVE), { status: 502, message: "Supabase no respondió." });
  fallos["bitacora_folios.insert"] = { code: "XX" };
  await assert.rejects(bitacora.crearFolio(CLAVE), { status: 502, message: "Supabase no respondió." });
});

test("ultimoFolio informa el mayor folio y cuántos siguen activos", async () => {
  assert.deepEqual(await bitacora.ultimoFolio(), { ultimo: null, total: 0 });
  await bitacora.crearFolio(CLAVE);
  await bitacora.crearFolio(CLAVE);
  await bitacora.crearFolio(CLAVE);
  await bitacora.eliminarFolio(CLAVE, 2, "2");
  assert.deepEqual(await bitacora.ultimoFolio(), { ultimo: 3, total: 2 });
  fallos["bitacora_folios.select"] = { code: "XX", message: "x" };
  await assert.rejects(bitacora.ultimoFolio(), { status: 502 });
});

test("leerFolio distingue folio inexistente, eliminado y válido", async () => {
  await assert.rejects(bitacora.leerFolio("abc"), { status: 400 });
  await assert.rejects(bitacora.leerFolio(5), { status: 404, message: "El folio 5 no existe." });
  const folio = await folioConFila();
  const leido = await bitacora.leerFolio(String(folio));
  assert.equal(leido.folio, folio);
  assert.equal(leido.filas.length, 1);
  assert.equal(leido.filas[0].km_reco, "50");
  assert.equal(leido.filas[0].firma_estado, "sin_firma");
  assert.deepEqual(leido.historial_firmas, []);
  await bitacora.eliminarFolio(CLAVE, folio, String(folio));
  await assert.rejects(bitacora.leerFolio(folio), { status: 410, message: "Folio eliminado" });
});

test("leerFolio entrega las filas ordenadas por número", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, chofer: "Uno" });
  await bitacora.guardarFila(CLAVE, folio, 2, { ...VIAJE, chofer: "Dos" });
  await bitacora.guardarFila(CLAVE, folio, 3, { ...VIAJE, chofer: "Tres" });
  tablas.bitacora_filas.reverse();
  const { filas } = await bitacora.leerFolio(folio);
  assert.deepEqual(filas.map((fila) => fila.chofer), ["Uno", "Dos", "Tres"]);
});

// ---------- filas ----------

test("guardarFila valida clave, números, datos y que el folio exista", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await assert.rejects(bitacora.guardarFila("mala", folio, 1, VIAJE), { status: 403 });
  await assert.rejects(bitacora.guardarFila(CLAVE, "x", 1, VIAJE), { status: 400, message: /Folio/ });
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 0, VIAJE), { status: 400, message: /Fila/ });
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 1, null), { status: 400 });
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 1, { fecha: "31/12/2026" }), { status: 400 });
  await assert.rejects(bitacora.guardarFila(CLAVE, 99, 1, VIAJE), { status: 404 });
  assert.equal(tablas.bitacora_filas.length, 0);
});

test("solo se puede agregar la fila siguiente a la última guardada", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 2, VIAJE), { status: 400, message: "La siguiente fila disponible es la 1." });
  await bitacora.guardarFila(CLAVE, folio, 1, VIAJE);
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 3, VIAJE), { status: 400, message: "La siguiente fila disponible es la 2." });
  await bitacora.guardarFila(CLAVE, folio, 2, VIAJE);
  assert.equal(tablas.bitacora_filas.length, 2);
});

test("guardarFila crea y luego actualiza la misma fila recalculando el recorrido", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  const creada = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, km_reco: "999", ajeno: "x" });
  assert.equal(creada.fila.n_fila, 1);
  assert.equal(creada.fila.km_reco, "50");
  assert.equal(creada.fila.firma_estado, "sin_firma");
  assert.equal(creada.fila.ajeno, undefined);
  const editada = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, km_term: "300" });
  assert.equal(editada.fila.km_reco, "200");
  assert.equal(tablas.bitacora_filas.length, 1);
  assert.equal(tablas.bitacora_filas[0].km_term, "300");
});

test("la imagen de firma no se puede escribir a mano", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: "img:firma-1-1-1.png" }), { status: 400, message: /botón de imagen/ });
  const conTexto = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: "Juan Pérez" });
  assert.equal(conTexto.fila.firma, "Juan Pérez");
  assert.equal(conTexto.fila.firma_estado, "sin_firma");
});

test("una firma de imagen no se puede borrar ni cambiar desde guardarFila", async () => {
  const { folio, fila } = await folioConFirma();
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: "" }), { status: 400, message: /Quitar imagen/ });
  await assert.rejects(bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: "otra" }), { status: 400, message: /Quitar imagen/ });
  const igual = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: fila.firma });
  assert.equal(igual.fila.firma, fila.firma);
});

test("editar los datos del viaje después de firmar deja la firma vencida", async () => {
  const { folio, fila } = await folioConFirma();
  assert.equal(fila.firma_estado, "vigente");
  const editada = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: fila.firma, chofer: "Otro Chofer" });
  assert.equal(editada.fila.firma_estado, "vencida");
  assert.equal((await bitacora.leerFolio(folio)).filas[0].firma_estado, "vencida");
});

test("editar solo la observación no vence la firma", async () => {
  const { folio, fila } = await folioConFirma();
  const editada = await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, firma: fila.firma, observacion: "nota" });
  assert.equal(editada.fila.firma_estado, "vigente");
});

// ---------- firmas ----------

test("subirFirma valida clave, imagen y tamaño antes de tocar la base", async () => {
  const folio = await folioConFila();
  await assert.rejects(bitacora.subirFirma("mala", folio, 1, png(), VIAJE.rut), { status: 403 });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, undefined, VIAJE.rut), { status: 400, message: /Falta la imagen/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, Buffer.alloc(0), VIAJE.rut), { status: 400, message: /Falta la imagen/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(100, 50, 100 * 1024 + 1), VIAJE.rut), { status: 400, message: /100 KB/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, Buffer.from("no es png de verdad, es texto largo"), VIAJE.rut), { status: 400, message: /PNG o JPG/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(2001, 50), VIAJE.rut), { status: 400, message: /2000 píxeles/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(50, 2001), VIAJE.rut), { status: 400, message: /2000 píxeles/ });
  assert.equal((await bitacora.subirFirma(CLAVE, folio, 1, png(2000, 2000), VIAJE.rut)).fila.firma_estado, "vigente");
  assert.equal(subidas.length, 1);
});

test("subirFirma exige que la fila exista, tenga RUT y que el RUT confirmado coincida", async () => {
  const folio = await folioConFila();
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 2, png(), VIAJE.rut), { status: 404, message: /fila 2/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(), "99999999-9"), { status: 400, message: /no coincide/ });
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(), ""), { status: 400, message: /no coincide/ });
  const sinRut = await folioConFila({ ...VIAJE, rut: "" });
  await assert.rejects(bitacora.subirFirma(CLAVE, sinRut, 1, png(), ""), { status: 400, message: /debe tener RUT/ });
  assert.equal(subidas.length, 0);
});

test("subirFirma guarda la imagen y deja la firma vigente aceptando el RUT con otro formato", async () => {
  const folio = await folioConFila();
  const { fila } = await bitacora.subirFirma(CLAVE, folio, 1, png(), " 12345678-5 ");
  assert.match(fila.firma, /^img:firma-\d+-1-\d+\.png$/);
  assert.equal(fila.firma_estado, "vigente");
  assert.equal(subidas.length, 1);
  assert.equal(subidas[0].tipo, "image/png");
  assert.equal(`img:${subidas[0].nombre}`, fila.firma);
  const guardada = tablas.bitacora_filas[0];
  assert.equal(guardada.firma, fila.firma);
  assert.match(guardada.firma_hash, /^[0-9a-f]{64}$/);
  assert.equal(guardada.firma_datos, bitacora.hashTexto(bitacora.resumenFirma(VIAJE_CON_RECORRIDO)));
  assert.ok(guardada.firma_en);
});

const VIAJE_CON_RECORRIDO = { ...VIAJE, km_reco: "50" };

test("subirFirma no permite una segunda firma sin quitar la primera", async () => {
  const { folio } = await folioConFirma();
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(), VIAJE.rut), { status: 409, message: /Quítala antes/ });
  assert.equal(subidas.length, 1);
});

test("si falla el guardado de la firma se borra la imagen recién subida", async () => {
  const folio = await folioConFila();
  fallos["bitacora_filas.update"] = { code: "XX", message: "falló" };
  await assert.rejects(bitacora.subirFirma(CLAVE, folio, 1, png(), VIAJE.rut), { status: 502 });
  assert.equal(subidas.length, 1);
  assert.deepEqual(quitadas, [subidas[0].nombre]);
  assert.equal(tablas.bitacora_filas[0].firma, "");
});

test("quitarFirma exige motivo y una firma existente, y guarda el historial", async () => {
  const { folio, fila } = await folioConFirma();
  await assert.rejects(bitacora.quitarFirma("mala", folio, 1, "x"), { status: 403 });
  await assert.rejects(bitacora.quitarFirma(CLAVE, folio, 1, "   "), { status: 400, message: /motivo/ });
  await assert.rejects(bitacora.quitarFirma(CLAVE, folio, 5, "x"), { status: 404 });

  const resultado = await bitacora.quitarFirma(CLAVE, folio, 1, "  Firma equivocada  ");
  assert.deepEqual(resultado.fila, { n_fila: 1, firma: "", firma_hash: "", firma_datos: "", firma_en: null, firma_estado: "sin_firma" });
  assert.equal(resultado.historial_firmas.length, 1);
  assert.equal(resultado.historial_firmas[0].motivo, "Firma equivocada");
  assert.equal(resultado.historial_firmas[0].firma, fila.firma);
  assert.equal(tablas.bitacora_filas[0].firma, "");
  assert.deepEqual(quitadas, []);

  await assert.rejects(bitacora.quitarFirma(CLAVE, folio, 1, "otra vez"), { status: 400, message: /no tiene una imagen/ });
});

test("el motivo para quitar la firma se limita a 200 caracteres", async () => {
  const { folio } = await folioConFirma();
  const resultado = await bitacora.quitarFirma(CLAVE, folio, 1, "x".repeat(500));
  assert.equal(resultado.historial_firmas[0].motivo.length, 200);
});

test("tras quitar la firma se puede subir otra y el historial conserva ambas, la más reciente primero", async () => {
  const { folio } = await folioConFirma();
  await bitacora.quitarFirma(CLAVE, folio, 1, "primera");
  await new Promise((resolver) => setTimeout(resolver, 5));
  await bitacora.subirFirma(CLAVE, folio, 1, png(), VIAJE.rut);
  const resultado = await bitacora.quitarFirma(CLAVE, folio, 1, "segunda");
  assert.deepEqual(resultado.historial_firmas.map((item) => item.motivo), ["segunda", "primera"]);
  assert.equal((await bitacora.leerFolio(folio)).historial_firmas.length, 2);
});

// ---------- quitar filas y eliminar folios ----------

test("quitarFila borra la fila y sus imágenes, y recorre las filas siguientes", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  for (const [n, chofer] of [[1, "Uno"], [2, "Dos"], [3, "Tres"], [4, "Cuatro"]]) {
    await bitacora.guardarFila(CLAVE, folio, n, { ...VIAJE, chofer });
  }
  const dos = await bitacora.subirFirma(CLAVE, folio, 2, png(), VIAJE.rut);
  await bitacora.quitarFirma(CLAVE, folio, 2, "prueba");
  await new Promise((resolver) => setTimeout(resolver, 5));
  await bitacora.subirFirma(CLAVE, folio, 2, png(), VIAJE.rut);
  await bitacora.subirFirma(CLAVE, folio, 4, png(), VIAJE.rut);
  const firmaDe4 = tablas.bitacora_filas.find((fila) => fila.n_fila === 4).firma;
  const firmaVigente2 = tablas.bitacora_filas.find((fila) => fila.n_fila === 2).firma;

  const resultado = await bitacora.quitarFila(CLAVE, folio, 2);
  assert.deepEqual(resultado.filas.map((fila) => [fila.n_fila, fila.chofer]), [[1, "Uno"], [2, "Tres"], [3, "Cuatro"]]);
  assert.equal(resultado.filas[2].firma, firmaDe4);
  assert.equal(resultado.filas[2].firma_estado, "vigente");
  assert.deepEqual(resultado.historial_firmas, []);
  assert.deepEqual(quitadas.sort(), [firmaVigente2, dos.fila.firma].map((valor) => valor.replace("img:", "")).sort());
});

test("quitarFila exige clave, folio activo y números válidos", async () => {
  const folio = await folioConFila();
  await assert.rejects(bitacora.quitarFila("mala", folio, 1), { status: 403 });
  await assert.rejects(bitacora.quitarFila(CLAVE, folio, "x"), { status: 400 });
  await assert.rejects(bitacora.quitarFila(CLAVE, 77, 1), { status: 404 });
  assert.equal(tablas.bitacora_filas.length, 1);
});

test("quitar la última fila no mueve nada", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE);
  await bitacora.guardarFila(CLAVE, folio, 1, VIAJE);
  await bitacora.guardarFila(CLAVE, folio, 2, { ...VIAJE, chofer: "Dos" });
  const resultado = await bitacora.quitarFila(CLAVE, folio, 2);
  assert.deepEqual(resultado.filas.map((fila) => fila.n_fila), [1]);
});

test("eliminarFolio pide la confirmación exacta, borra filas, historial e imágenes y marca el folio", async () => {
  const { folio, fila } = await folioConFirma();
  await bitacora.quitarFirma(CLAVE, folio, 1, "x");
  await new Promise((resolver) => setTimeout(resolver, 5));
  await bitacora.subirFirma(CLAVE, folio, 1, png(), VIAJE.rut);
  await assert.rejects(bitacora.eliminarFolio("mala", folio, String(folio)), { status: 403 });
  await assert.rejects(bitacora.eliminarFolio(CLAVE, folio, "999"), { status: 400, message: /confirmacion/ });
  await assert.rejects(bitacora.eliminarFolio(CLAVE, folio, undefined), { status: 400 });
  assert.equal(tablas.bitacora_filas.length, 1);

  assert.deepEqual(await bitacora.eliminarFolio(CLAVE, folio, ` ${folio} `), { folio, eliminado: true });
  assert.equal(tablas.bitacora_filas.length, 0);
  assert.equal(tablas.bitacora_firmas_historial.length, 0);
  assert.equal(quitadas.length, 2);
  assert.ok(quitadas.includes(fila.firma.replace("img:", "")));
  assert.ok(tablas.bitacora_folios[0].eliminado_en);
  await assert.rejects(bitacora.eliminarFolio(CLAVE, folio, String(folio)), { status: 410 });
});

// ---------- exportación ----------

test("exportarFolio arma el Excel con los datos, el número de folio y la firma como imagen", async () => {
  const { folio, fila } = await folioConFirma();
  const { buffer, nombre } = await bitacora.exportarFolio(folio);
  assert.equal(nombre, `Bitacora folio ${folio}.xlsx`);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  assert.equal(hoja.getCell("K1").value, `FOLIO Nº ${folio}`);
  assert.equal(hoja.getCell(5, 2).value, "Ana");
  assert.equal(hoja.getCell(5, 1).value, "09/10/2026");
  assert.equal(hoja.getCell(5, 10).value, 50);
  assert.equal(hoja.getCell(5, 12).value, null);
  assert.equal(hoja.getImages().length, 2);
  assert.ok(almacen.has(fila.firma.replace("img:", "")));
});

test("exportarFolio sigue funcionando si la imagen de la firma no se puede descargar", async () => {
  const { folio } = await folioConFirma();
  falloBajada = true;
  const { buffer } = await bitacora.exportarFolio(folio);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  assert.equal(libro.worksheets[0].getImages().length, 1);
  almacen.clear();
  falloBajada = false;
  const sinImagen = await bitacora.exportarFolio(folio);
  assert.ok(sinImagen.buffer.length > 0);
});

test("exportarFolio rechaza folios inválidos, inexistentes o eliminados", async () => {
  await assert.rejects(bitacora.exportarFolio("x"), { status: 400 });
  await assert.rejects(bitacora.exportarFolio(3), { status: 404 });
  const { folio } = await bitacora.crearFolio(CLAVE);
  await bitacora.eliminarFolio(CLAVE, folio, String(folio));
  await assert.rejects(bitacora.exportarFolio(folio), { status: 410 });
});

test("la auditor�a lista folios activos y eliminados y abre el detalle de uno eliminado", async () => {
  const activo = await folioConFila();
  const eliminado = await folioConFila();
  await bitacora.eliminarFolio(CLAVE, eliminado, String(eliminado));
  const lista = await bitacora.listarAuditoria();
  assert.deepEqual(lista.map((f) => f.folio), [eliminado, activo]);
  assert.ok(lista[0].eliminado_en);
  assert.equal(lista[1].eliminado_en, null);
  const detalle = await bitacora.leerAuditoria(eliminado);
  assert.ok(detalle.eliminado_en);
  assert.equal((await bitacora.leerAuditoria(activo)).filas.length, 1);
  assert.ok(Array.isArray(detalle.historial_firmas));
  await assert.rejects(bitacora.leerFolio(eliminado), { status: 410 });
  await assert.rejects(bitacora.leerAuditoria(999), { status: 404 });
});

test("cada cambio de la bitácora queda en el log con el usuario", async () => {
  const { folio } = await bitacora.crearFolio(CLAVE, "ana");
  await bitacora.guardarFila(CLAVE, folio, 1, VIAJE, "ana");
  await bitacora.guardarFila(CLAVE, folio, 1, VIAJE, "ana");
  await bitacora.guardarFila(CLAVE, folio, 1, { ...VIAJE, km_term: "200" }, "beto");
  await bitacora.quitarFila(CLAVE, folio, 1, "beto");
  await bitacora.eliminarFolio(CLAVE, folio, String(folio), "ana");
  const { eventos } = await bitacora.listarLog({});
  const acciones = eventos.map((e) => `${e.usuario}:${e.accion}`).reverse();
  assert.equal(acciones[0], "ana:crear_folio");
  assert.equal(acciones[1], "ana:anadir_fila");
  assert.equal(acciones.filter((a) => a === "ana:editar_celda").length, 9);
  const km = eventos.find((e) => e.usuario === "beto" && e.accion === "editar_celda");
  assert.deepEqual([km.campo, km.valor_anterior, km.valor_nuevo], ["km_term", "150", "200"]);
  assert.ok(acciones.includes("beto:quitar_fila"));
  assert.ok(acciones.includes("ana:eliminar_folio"));
  assert.equal(tablas.bitacora_log.length > 0, true);
});