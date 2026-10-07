const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const XLSX = require("xlsx");
const { DatabaseSync } = require("node:sqlite");
const { crearBase } = require("./crearBase");
const {
  conStockCritico,
  conMarcado,
  sinFilasVacias,
  textoBusqueda,
  columnaExcel,
  valorStock,
  claveUbicacion,
  codigoBodega,
  aplicarExistencia,
  aplicarFiltrosTabla,
  enteroReserva,
  numeroReserva,
  enteroCelda,
  numeroEnTitulo,
  itemsDesdeManual,
  itemsDesdeOrden,
  itemsDesdeTraspaso,
  textoFecha,
  claveCarga,
  actualizarMaterial,
  agregarMaterial,
  guardarContratistas,
  importarPlanilla,
  importarDosColumnas,
  importarReservas,
  buscarMateriales,
} = require("./fuenteDatos");

test("conStockCritico inserta la columna antes de Rombo", () => {
  const matriz = conStockCritico([
    ["Codigo", "Rombo"],
    ["100", "img.png"],
  ]);
  assert.deepEqual(matriz[0], ["Codigo", "Stock critico", "Rombo"]);
  assert.equal(matriz[1][1], "");
  assert.equal(matriz[1][2], "img.png");
});

test("conStockCritico no duplica la columna", () => {
  const matriz = [["Codigo", "Stock critico"]];
  assert.equal(conStockCritico(matriz), matriz);
  assert.deepEqual(conStockCritico([]), []);
});

test("conMarcado agrega la marca de los códigos conocidos", () => {
  const { matriz, agregada } = conMarcado([
    ["Codigo", "Descripcion"],
    ["10", "Tubo"],
  ]);
  assert.equal(agregada, true);
  assert.equal(matriz[0].at(-1), "Marcado");
  assert.equal(matriz[1].at(-1), "");
});

test("sinFilasVacias conserva el encabezado y descarta filas en blanco", () => {
  assert.deepEqual(sinFilasVacias([["Codigo"], ["  "], ["1"]]), [["Codigo"], ["1"]]);
  assert.deepEqual(sinFilasVacias([]), []);
});

test("textoBusqueda ignora acentos y mayúsculas", () => {
  assert.equal(textoBusqueda("  Árbol "), "arbol");
  assert.equal(textoBusqueda(null), "");
});

test("columnaExcel convierte el índice a letras", () => {
  assert.equal(columnaExcel(0), "A");
  assert.equal(columnaExcel(25), "Z");
  assert.equal(columnaExcel(26), "AA");
});

test("valorStock deja números enteros y conserva texto", () => {
  assert.equal(valorStock("12"), 12);
  assert.equal(valorStock("  "), null);
  assert.equal(valorStock("12 kg"), "12 kg");
});

test("claveUbicacion y codigoBodega agrupan por los dos primeros dígitos", () => {
  assert.deepEqual(claveUbicacion(""), [1, 0]);
  assert.deepEqual(claveUbicacion("03-A"), [0, 3]);
  assert.deepEqual(claveUbicacion("pasillo"), [0, 999]);
  assert.equal(codigoBodega("03-A"), "03");
  assert.equal(codigoBodega("pasillo"), "Sin bodega");
});

test("aplicarExistencia copia libre utilización o inventario", () => {
  const fila = ["c", "d", "ub", "sub", 4, "", "9"];
  assert.equal(aplicarExistencia([fila], "libre")[0][5], 4);
  assert.equal(aplicarExistencia([fila], "inventario")[0][5], "9");
  assert.equal(aplicarExistencia([fila], "")[0][5], "");
  assert.equal(aplicarExistencia([fila], "")[0].length, 6);
});

test("aplicarFiltrosTabla exige stock y aplica bodega, mínimo, nulo y orden", () => {
  const filas = [
    { Codigo: "20", Descripcion: "Beta", Stock: "5", "Ubicación": "01-A", "Sub-ubicación": "01-A", Precio: "", "Stock critico": "4", Inventario: "", Comentario: "", Marcado: "" },
    { Codigo: "3", Descripcion: "NULO", Stock: "1", "Ubicación": "02-B", "Sub-ubicación": "02", Precio: "10", "Stock critico": "4", Inventario: "1", Comentario: "", Marcado: "1" },
    { Codigo: "100", Descripcion: "Alfa", Stock: "", "Ubicación": "01-A", "Sub-ubicación": "01-A", Precio: "1", "Stock critico": "", Inventario: "", Comentario: "", Marcado: "" },
  ];
  const resultado = aplicarFiltrosTabla(filas, {
    bodega: "01",
    stockMinimo: "5",
    ignorarNulo: true,
    orden: "codigo-asc",
  });
  assert.deepEqual(resultado.map((fila) => fila.Codigo), ["20"]);

  const criticos = aplicarFiltrosTabla(filas, { soloStockCritico: true, soloConPrecio: true, soloMarcados: true, soloInventarioOComentario: true });
  assert.deepEqual(criticos.map((fila) => fila.Codigo), ["3"]);

  const porNombre = aplicarFiltrosTabla(
    [
      { Codigo: "1", Descripcion: "zeta", Stock: "1" },
      { Codigo: "2", Descripcion: "alfa", Stock: "1" },
    ],
    { orden: "descripcion" }
  );
  assert.deepEqual(porNombre.map((fila) => fila.Descripcion), ["alfa", "zeta"]);
});

test("enteros de reserva y celda truncan o valen cero", () => {
  assert.equal(enteroReserva("12abc"), 12);
  assert.equal(enteroReserva("x"), 0);
  assert.equal(enteroCelda("3.9"), 3);
  assert.equal(enteroCelda(""), 0);
  assert.equal(numeroReserva("1.250,5"), 1250.5);
  assert.equal(numeroReserva(4), 4);
  assert.equal(numeroReserva("no"), 0);
});

test("numeroEnTitulo toma el número del traspaso", () => {
  assert.equal(numeroEnTitulo("Traspaso N° 4481 del día"), "4481");
  assert.equal(numeroEnTitulo("pedido 12 y 99"), "99");
  assert.equal(numeroEnTitulo(""), "");
});

test("itemsDesdeManual descarta códigos vacíos y cantidades en cero", () => {
  assert.deepEqual(
    itemsDesdeManual([
      { codigo: " 10 ", cantidad: 2 },
      { codigo: "", cantidad: 5 },
      { codigo: "11", cantidad: 0 },
    ]),
    [{ codigo: "10", unidad: "", cantidad: 2 }]
  );
  assert.deepEqual(itemsDesdeManual(null), []);
});

function libroBuffer(filas, nombre = "Hoja1") {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre);
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" });
}

test("itemsDesdeOrden lee código, unidad y solicitado", () => {
  const buffer = libroBuffer(
    [
      ["Código", "Un", "Solicitado"],
      ["100", "UN", 3],
      ["101", "UN", 0],
    ],
    "Pedido cliente"
  );
  assert.deepEqual(itemsDesdeOrden(buffer), [{ codigo: "100", unidad: "UN", cantidad: 3 }]);
});

test("itemsDesdeTraspaso lee cantidades y el número del título", () => {
  const buffer = libroBuffer([
    [null, null, "Traspaso N° 77"],
    [],
    ["t1", "t2", "t3"],
    [],
    [null, "200", "Codo", "UN", 4, null, null, 2, null, 1],
    [null, "", "", "", "", "", "", "", "", ""],
  ]);
  const { items, numero } = itemsDesdeTraspaso(buffer);
  assert.equal(numero, "77");
  assert.equal(items.length, 1);
  assert.equal(items[0].codigo, "200");
  assert.equal(items[0].cantidad, 4);
  assert.equal(items[0].concon, 1);
});

test("textoFecha formatea Date y serial de Excel", () => {
  assert.equal(textoFecha(new Date(Date.UTC(2026, 0, 5))), "05/01/2026");
  assert.equal(textoFecha("texto"), "texto");
  const serial = textoFecha(46027);
  assert.match(serial, /^\d{2}\/\d{2}\/\d{4}$/);
});

test("claveCarga distingue el modo y la columna", () => {
  assert.equal(claveCarga("sap"), "sap");
  assert.equal(claveCarga("dos-columnas", " Precio "), "dos-columnas:Precio");
  assert.equal(claveCarga("dos-columnas", " "), "dos-columnas");
  assert.equal(claveCarga(""), "completa");
});

function estado(accion) {
  try {
    accion();
    return 0;
  } catch (error) {
    return error.status;
  }
}

test("validaciones rechazan datos antes de abrir la planilla", () => {
  assert.equal(estado(() => actualizarMaterial("1", { inventario: "1.5", comentario: "" })), 400);
  assert.equal(estado(() => actualizarMaterial("1", { inventario: "1", comentario: "x".repeat(51) })), 400);
  assert.equal(estado(() => agregarMaterial("no", { Codigo: "1" })), 403);
  assert.equal(estado(() => agregarMaterial("Berfre2026", { Codigo: "  " })), 400);
  assert.equal(estado(() => guardarContratistas("no", [])), 403);
  assert.equal(estado(() => importarPlanilla("no", Buffer.from("x"))), 403);
  assert.equal(estado(() => importarDosColumnas("Berfre2026", Buffer.from("x"), "Codigo")), 400);
  assert.equal(estado(() => importarReservas("no", Buffer.from("x"))), 403);
});

test("buscarMateriales no lee la planilla si la consulta es corta", () => {
  assert.deepEqual(buscarMateriales("a"), []);
  assert.deepEqual(buscarMateriales("  "), []);
});

test("crearBase deja el esquema vacío de materiales, contratistas y reservas", () => {
  const destino = path.join(os.tmpdir(), `berfre-test-${Date.now()}.sqlite`);
  crearBase(destino);
  const db = new DatabaseSync(destino);
  const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  assert.deepEqual(tablas.map((fila) => fila.name), ["contratistas", "materiales", "reservas", "ultimas_cargas"]);
  const columnas = db.prepare("PRAGMA table_info(materiales)").all().map((fila) => fila.name);
  assert.ok(columnas.includes("codigo"));
  assert.ok(columnas.includes("stock_critico"));
  assert.ok(columnas.includes("m505"));
  db.close();
  fs.unlinkSync(destino);
});
