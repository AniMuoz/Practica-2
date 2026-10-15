process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const XLSX = require("xlsx");

// importaciones.js toma estas funciones al cargarse: se reemplazan antes por una tabla en memoria.
const nucleo = require("./nucleoDatos");
const COLS = nucleo.ENCABEZADO_MATERIALES;
const CLAVE = nucleo.CLAVE_DATOS;

let estado;
let guardado;
nucleo.editarMateriales = () => {
  const matriz = estado.map((fila) => fila.slice());
  return { matriz, porCodigo: nucleo.mapaPorCodigo(matriz, COLS.indexOf("Codigo")) };
};
nucleo.guardarMateriales = (matriz) => {
  guardado = matriz;
};

const {
  importarPlanilla,
  importarSap,
  importarPrecios,
  importarUbicaciones,
  importarDosColumnas,
} = require("./importaciones");

function fila(datos) {
  return COLS.map((columna) => datos[columna] ?? "");
}

function reiniciar() {
  guardado = null;
  estado = [
    COLS.slice(),
    fila({ Codigo: "100", Descripcion: "Perno", Stock: "5", Precio: "10", Rombo: "r.png", Marcado: "1" }),
    fila({ Codigo: "200", Descripcion: "Tuerca", Stock: "2" }),
  ];
}

function excel(matriz) {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Hoja1");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}

function celda(matriz, codigo, columna) {
  const registro = matriz.find((f) => f[0] === codigo);
  return registro ? registro[COLS.indexOf(columna)] : undefined;
}

const codigos = (matriz) => matriz.slice(1).map((f) => f[0]);

test.beforeEach(reiniciar);

test("todas las importaciones exigen la clave antes de leer el archivo", () => {
  const buffer = excel([["a", "b"]]);
  for (const importar of [importarPlanilla, importarSap, importarPrecios, importarUbicaciones]) {
    assert.throws(() => importar("mala", buffer), { status: 403 });
  }
  assert.throws(() => importarDosColumnas("mala", buffer, "Precio"), { status: 403 });
  assert.equal(guardado, null);
});

// ---------- importarPlanilla ----------

const FORMATO = COLS.filter((columna) => columna !== "Marcado");
const filaFormato = (datos) => FORMATO.map((columna) => datos[columna] ?? "");

test("importarPlanilla actualiza, agrega y conserva imágenes y marcado cuando vienen vacíos", () => {
  const buffer = excel([
    FORMATO,
    filaFormato({ Codigo: "100", Descripcion: "Perno V2", Stock: 9, Inventario: "3" }),
    filaFormato({ Codigo: "300", Descripcion: "Nuevo", Rombo: "n.png" }),
    filaFormato({}),
  ]);
  assert.deepEqual(importarPlanilla(CLAVE, buffer), { agregados: 1, actualizados: 1 });
  assert.deepEqual(codigos(guardado), ["100", "200", "300"]);
  assert.equal(celda(guardado, "100", "Descripcion"), "Perno V2");
  assert.equal(celda(guardado, "100", "Stock"), 9);
  assert.equal(celda(guardado, "100", "Inventario"), 3);
  assert.equal(celda(guardado, "100", "Rombo"), "r.png");
  assert.equal(celda(guardado, "100", "Marcado"), "1");
  assert.equal(celda(guardado, "300", "Rombo"), "n.png");
  assert.equal(celda(guardado, "200", "Descripcion"), "Tuerca");
});

test("importarPlanilla acepta un archivo que incluye la columna Marcado", () => {
  const buffer = excel([COLS, fila({ Codigo: "100", Descripcion: "X", Marcado: "" })]);
  importarPlanilla(CLAVE, buffer);
  assert.equal(celda(guardado, "100", "Marcado"), "");
});

test("importarPlanilla rechaza un formato distinto indicando qué falta y qué sobra", () => {
  const sinStock = FORMATO.filter((columna) => columna !== "Stock");
  assert.throws(
    () => importarPlanilla(CLAVE, excel([[...sinStock, "Extra"], sinStock.map(() => "")])),
    (error) => error.status === 400 && /faltan: Stock/.test(error.message) && /no corresponden: Extra/.test(error.message)
  );
  assert.equal(guardado, null);
});

test("importarPlanilla rechaza filas sin código o con inventario no entero y no guarda nada", () => {
  assert.throws(
    () => importarPlanilla(CLAVE, excel([FORMATO, filaFormato({ Descripcion: "sin código" })])),
    { status: 400, message: /fila 2 no tiene código/ }
  );
  for (const malo of ["1.5", "abc", "1e3"]) {
    assert.throws(
      () => importarPlanilla(CLAVE, excel([
        FORMATO,
        filaFormato({ Codigo: "100" }),
        filaFormato({ Codigo: "200", Inventario: malo }),
      ])),
      { status: 400, message: /Inventario de la fila 3/ }
    );
  }
  assert.equal(guardado, null);
});

test("importarPlanilla acepta inventario negativo y vacío", () => {
  importarPlanilla(CLAVE, excel([
    FORMATO,
    filaFormato({ Codigo: "100", Inventario: "-4" }),
    filaFormato({ Codigo: "200", Inventario: "" }),
  ]));
  assert.equal(celda(guardado, "100", "Inventario"), -4);
  assert.equal(celda(guardado, "200", "Inventario"), "");
});

// ---------- importarSap ----------

const ENC_SAP = ["Material", "Texto breve de material", "Almacén", "Libre utilización"];

test("importarSap actualiza M501 y bodegas, agrega nuevos, omite otras plantas y respeta el orden del archivo", () => {
  const buffer = excel([
    ["Reporte"],
    ENC_SAP,
    ["300", "Nuevo", "M501", 4],
    ["100", "Perno SAP", "M501", 10],
    ["100", "otra desc", "M502", 3],
    ["400", "Fuera", "M999", 1],
    ["", "", "", ""],
  ]);
  assert.deepEqual(importarSap(CLAVE, buffer), { agregados: 1, actualizados: 2, omitidos: 1 });
  assert.deepEqual(codigos(guardado), ["300", "100", "200"]);
  assert.equal(celda(guardado, "100", "Descripcion"), "Perno SAP");
  assert.equal(celda(guardado, "100", "Stock"), 10);
  assert.equal(celda(guardado, "100", "M502"), 3);
  assert.equal(celda(guardado, "300", "Stock"), 4);
  assert.equal(celda(guardado, "200", "Stock"), "2");
  assert.equal(celda(guardado, "100", "Rombo"), "r.png");
});

test("importarSap solo cambia la descripción desde las filas de M501", () => {
  importarSap(CLAVE, excel([ENC_SAP, ["100", "No debe pasar", "M503", 8]]));
  assert.equal(celda(guardado, "100", "Descripcion"), "Perno");
  assert.equal(celda(guardado, "100", "M503"), 8);
});

test("importarSap rechaza una fila de bodega válida sin código y archivos sin encabezados", () => {
  assert.throws(() => importarSap(CLAVE, excel([ENC_SAP, ["", "x", "M501", 1]])), { status: 400, message: /fila 2 no tiene código/ });
  assert.throws(() => importarSap(CLAVE, excel([["foo", "bar"], ["1", "2"]])), { status: 400, message: /encabezados esperados/ });
  assert.equal(guardado, null);
});

// ---------- importarPrecios ----------

test("importarPrecios actualiza descripción y precio y agrega códigos nuevos", () => {
  const buffer = excel([
    ["Material", "Texto breve de material", "Nuevos precios"],
    ["100", "Perno caro", 1500],
    ["500", "Nuevo", 20],
    ["", "", ""],
  ]);
  assert.deepEqual(importarPrecios(CLAVE, buffer), { agregados: 1, actualizados: 1 });
  assert.equal(celda(guardado, "100", "Precio"), 1500);
  assert.equal(celda(guardado, "100", "Descripcion"), "Perno caro");
  assert.equal(celda(guardado, "500", "Precio"), 20);
  assert.equal(celda(guardado, "200", "Precio"), "");
});

test("importarPrecios rechaza filas sin código", () => {
  assert.throws(
    () => importarPrecios(CLAVE, excel([["Material", "Descripcion", "Precio"], ["", "algo", 5]])),
    { status: 400, message: /fila 2 no tiene código/ }
  );
  assert.equal(guardado, null);
});

// ---------- importarUbicaciones ----------

test("importarUbicaciones solo toma M501 y deriva la sub-ubicación de los 4 primeros caracteres", () => {
  const buffer = excel([
    ["matnr", "lgort", "lgpbe"],
    ["100", "M501", "0102-A"],
    ["200", "M502", "9999-Z"],
    ["900", "M501", "0507-B"],
  ]);
  assert.deepEqual(importarUbicaciones(CLAVE, buffer), { agregados: 1, actualizados: 1, omitidos: 1 });
  assert.equal(celda(guardado, "100", "Ubicación"), "0102-A");
  assert.equal(celda(guardado, "100", "Sub-ubicación"), "0102");
  assert.equal(celda(guardado, "200", "Ubicación"), "");
  assert.equal(celda(guardado, "900", "Sub-ubicación"), "0507");
});

test("importarUbicaciones rechaza una fila de M501 sin código", () => {
  assert.throws(
    () => importarUbicaciones(CLAVE, excel([["matnr", "lgort", "lgpbe"], ["", "M501", "01"]])),
    { status: 400, message: /fila 2 no tiene código/ }
  );
});

// ---------- importarDosColumnas ----------

test("importarDosColumnas rechaza columnas destino no permitidas o inexistentes", () => {
  const buffer = excel([["Codigo", "Valor"], ["100", "x"]]);
  for (const destino of ["", "  ", undefined, "Codigo", "Inventario", "Comentario"]) {
    assert.throws(() => importarDosColumnas(CLAVE, buffer, destino), { status: 400, message: /columna válida/ });
  }
  assert.throws(() => importarDosColumnas(CLAVE, buffer, "Inexistente"), { status: 400, message: /columna elegida/ });
  assert.equal(guardado, null);
});

test("importarDosColumnas exige exactamente 2 columnas con encabezado", () => {
  assert.throws(() => importarDosColumnas(CLAVE, excel([["Codigo"], ["100"]]), "Precio"), { status: 400, message: /exactamente 2/ });
  assert.throws(() => importarDosColumnas(CLAVE, excel([["a", "b", "c"], [1, 2, 3]]), "Precio"), { status: 400, message: /exactamente 2/ });
});

test("importarDosColumnas actualiza la columna elegida y agrega códigos nuevos", () => {
  const buffer = excel([["Codigo", "Precio"], ["100", 777], ["999", 5], ["", ""]]);
  assert.deepEqual(importarDosColumnas(CLAVE, buffer, " Precio "), { agregados: 1, actualizados: 1 });
  assert.equal(celda(guardado, "100", "Precio"), 777);
  assert.equal(celda(guardado, "100", "Descripcion"), "Perno");
  assert.equal(celda(guardado, "999", "Precio"), 5);
});

test("importarDosColumnas rechaza una fila con valor pero sin código", () => {
  assert.throws(
    () => importarDosColumnas(CLAVE, excel([["Codigo", "Precio"], ["", 5]]), "Precio"),
    { status: 400, message: /fila 2 no tiene código/ }
  );
  assert.equal(guardado, null);
});
