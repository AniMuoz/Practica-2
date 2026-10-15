process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "clave-de-prueba";
process.env.CLAVE_DATOS = process.env.CLAVE_DATOS || "clave-datos-de-prueba";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CAMPOS_MATERIAL,
  CAMPOS_RESERVA,
  CLAVE_DATOS,
  claveColumna,
  indiceCampo,
  ubicarColumnas,
  registrosMaterial,
  matrizMaterial,
  registrosReserva,
  matrizReserva,
  tablaDesdeMatriz,
  filasBodegaDesdeMatriz,
  mapaPorCodigo,
  indicePorCodigo,
  claveCorrecta,
  exigirClave,
} = require("./nucleoDatos");

test("claveColumna ignora acentos, mayúsculas, espacios y símbolos", () => {
  assert.equal(claveColumna("Ubicación"), "ubicacion");
  assert.equal(claveColumna("  Sub-ubicación "), "sububicacion");
  assert.equal(claveColumna("Nº reserva"), "nreserva");
  assert.equal(claveColumna("Ctd.en UM entrada"), "ctdenumentrada");
  assert.equal(claveColumna(null), "");
  assert.equal(claveColumna(undefined), "");
  assert.equal(claveColumna(123), "123");
});

test("indiceCampo encuentra el encabezado sin importar el formato", () => {
  const encabezados = ["Codigo", "DESCRIPCIÓN", "Sub-ubicacion"];
  assert.equal(indiceCampo(encabezados, "descripcion"), 1);
  assert.equal(indiceCampo(encabezados, "Sub-ubicación"), 2);
  assert.equal(indiceCampo(encabezados, "Precio"), -1);
});

test("ubicarColumnas halla los encabezados aunque no estén en la primera fila", () => {
  const matriz = [
    ["Reporte SAP"],
    ["Material", "Texto breve", "Libre utilización"],
    ["100", "Perno", 4],
  ];
  const { fila, indices } = ubicarColumnas(matriz, { codigo: ["material"], libre: ["libre utilizacion"] });
  assert.equal(fila, 1);
  assert.deepEqual(indices, { codigo: 0, libre: 2 });
});

test("ubicarColumnas prefiere el título exacto y si no usa el que contiene el texto", () => {
  const exacto = ubicarColumnas([["Texto breve de material", "Material"]], { codigo: ["material"] });
  assert.equal(exacto.indices.codigo, 1);
  const contenido = ubicarColumnas([["Cod", "Stock libre (M501)"]], { libre: ["libre"] });
  assert.equal(contenido.indices.libre, 1);
});

test("ubicarColumnas prueba las alternativas en orden de preferencia", () => {
  const { indices } = ubicarColumnas([["Item", "Cantidad"]], { cantidad: ["solicitado", "cantidad"] });
  assert.equal(indices.cantidad, 1);
});

test("ubicarColumnas informa qué columnas faltan con un error 400", () => {
  assert.throws(
    () => ubicarColumnas([["Material", "Otra"]], { codigo: ["material"], precio: ["precio"], peso: ["peso"] }),
    (error) => error.status === 400 && /faltan: precio, peso/.test(error.message)
  );
});

test("ubicarColumnas solo busca el encabezado en las primeras 10 filas", () => {
  const relleno = Array.from({ length: 10 }, () => ["x"]);
  const matriz = [...relleno, ["Material"]];
  assert.throws(() => ubicarColumnas(matriz, { codigo: ["material"] }), { status: 400 });
  const aTiempo = [...relleno.slice(1), ["Material"]];
  assert.equal(ubicarColumnas(aTiempo, { codigo: ["material"] }).fila, 9);
});

test("ubicarColumnas con una matriz vacía falla con 400", () => {
  assert.throws(() => ubicarColumnas([], { codigo: ["material"] }), { status: 400 });
});

test("registrosMaterial normaliza encabezados, recorta el código y no repite códigos", () => {
  const registros = registrosMaterial([
    ["codigo", "DESCRIPCIÓN", "Stock"],
    [" 100 ", "Perno", 5],
    ["", "sin código", 1],
    ["200", "Tuerca", 2],
    ["100", "Perno nuevo", 7],
  ]);
  assert.equal(registros.length, 2);
  const perno = registros.find((registro) => registro.codigo === "100");
  assert.equal(perno.descripcion, "Perno nuevo");
  assert.equal(perno.stock, "7");
  assert.equal(perno.precio, "");
  assert.equal(registros.some((registro) => registro.descripcion === "sin código"), false);
  assert.deepEqual(Object.keys(perno), CAMPOS_MATERIAL.map(([, campo]) => campo));
});

test("registrosMaterial con una matriz vacía no devuelve nada", () => {
  assert.deepEqual(registrosMaterial([]), []);
  assert.deepEqual(registrosMaterial([["Codigo"]]), []);
});

test("matrizMaterial y registrosMaterial son inversas", () => {
  const filas = [
    { codigo: "1", descripcion: "A", stock: "3", rombo: "r.png" },
    { codigo: "2", descripcion: "B" },
  ];
  const matriz = matrizMaterial(filas);
  assert.deepEqual(matriz[0], CAMPOS_MATERIAL.map(([titulo]) => titulo));
  assert.equal(matriz.length, 3);
  const vuelta = registrosMaterial(matriz);
  assert.equal(vuelta[0].codigo, "1");
  assert.equal(vuelta[0].rombo, "r.png");
  assert.equal(vuelta[1].stock, "");
});

test("registrosReserva conserva todas las filas y rellena lo que falta", () => {
  const registros = registrosReserva([
    ["Nº reserva", "Material", "Cantidad necesaria"],
    [900, "100", 3],
    [901, "", ""],
  ]);
  assert.equal(registros.length, 2);
  assert.equal(registros[0].n_reserva, "900");
  assert.equal(registros[0].cantidad_necesaria, "3");
  assert.equal(registros[0].orden, "");
  assert.deepEqual(Object.keys(registros[0]), CAMPOS_RESERVA.map(([, campo]) => campo));
});

test("matrizReserva y registrosReserva son inversas", () => {
  const matriz = matrizReserva([{ n_reserva: "5", material: "77" }]);
  assert.deepEqual(matriz[0], CAMPOS_RESERVA.map(([titulo]) => titulo));
  const vuelta = registrosReserva(matriz);
  assert.equal(vuelta[0].n_reserva, "5");
  assert.equal(vuelta[0].material, "77");
});

test("tablaDesdeMatriz oculta marcado y bodegas extra, agrega columnas de imagen y descarta filas vacías", () => {
  const { columnas, filas } = tablaDesdeMatriz([
    ["Codigo", "Descripcion", "Marcado"],
    ["1", "A", "1"],
    ["", "", ""],
    ["2", "B", ""],
  ]);
  assert.deepEqual(columnas, ["Codigo", "Descripcion", "Rombo", "QR", "Foto"]);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0], { Codigo: "1", Descripcion: "A", Rombo: "", QR: "", Foto: "", Marcado: "1" });
  assert.equal(filas[1].Marcado, "");
});

test("tablaDesdeMatriz sin columna Marcado deja el marcado vacío y nombra columnas sin título", () => {
  const { columnas, filas } = tablaDesdeMatriz([["Codigo", ""], ["1", "x"]]);
  assert.ok(columnas.includes("Columna 2"));
  assert.equal(filas[0].Marcado, "");
  assert.equal(filas[0]["Columna 2"], "x");
});

test("tablaDesdeMatriz de una matriz vacía queda vacía", () => {
  assert.deepEqual(tablaDesdeMatriz([]), { columnas: [], filas: [] });
});

test("filasBodegaDesdeMatriz conserva todas las columnas, incluidas las de bodega", () => {
  const filas = filasBodegaDesdeMatriz([
    ["Codigo", "M502"],
    ["1", "8"],
    ["", ""],
  ]);
  assert.deepEqual(filas, [{ Codigo: "1", M502: "8" }]);
});

test("mapaPorCodigo guarda la primera fila de cada código", () => {
  const mapa = mapaPorCodigo([["Codigo"], ["a"], ["b"], ["a"], [5]], 0);
  assert.equal(mapa.get("a"), 1);
  assert.equal(mapa.get("b"), 2);
  assert.equal(mapa.get("5"), 4);
  assert.equal(mapaPorCodigo([["x"]], -1).size, 0);
});

test("indicePorCodigo devuelve -1 si el código no existe", () => {
  const mapa = new Map([["a", 3]]);
  assert.equal(indicePorCodigo(mapa, "a"), 3);
  assert.equal(indicePorCodigo(mapa, "z"), -1);
});

test("claveCorrecta solo acepta la clave exacta", () => {
  assert.equal(claveCorrecta(CLAVE_DATOS), true);
  assert.equal(claveCorrecta(CLAVE_DATOS + "x"), false);
  assert.equal(claveCorrecta(CLAVE_DATOS.slice(0, -1)), false);
  assert.equal(claveCorrecta(CLAVE_DATOS.toUpperCase() === CLAVE_DATOS ? CLAVE_DATOS.toLowerCase() : CLAVE_DATOS.toUpperCase()), false);
  assert.equal(claveCorrecta(""), false);
  assert.equal(claveCorrecta(undefined), false);
  assert.equal(claveCorrecta(null), false);
});

test("exigirClave lanza 403 con una clave mala y no hace nada con la buena", () => {
  assert.throws(() => exigirClave("mala"), { status: 403, message: "Contraseña incorrecta." });
  assert.doesNotThrow(() => exigirClave(CLAVE_DATOS));
});
