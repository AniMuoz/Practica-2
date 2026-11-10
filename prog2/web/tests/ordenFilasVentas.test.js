import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { OPCIONES_ORDEN, ordenarFilasVentas } from "../src/lib/ordenFilasVentas.js";

const back = createRequire(import.meta.url)("../../back/servicios/ordenFilasVentas.js");

describe("ordenFilasVentas: copias de back y web", () => {
  it("tienen las mismas opciones y reglas de orden", () => {
    assert.deepEqual(OPCIONES_ORDEN, back.OPCIONES_ORDEN);
  });

  it("ordenan igual todas las filas con cada orden", () => {
    const filas = [
      { codigo: "10", ubicacion: "B-2", descripcion: "tuerca", entregar: "3", pos: 1 },
      { codigo: "2", ubicacion: "", descripcion: "Perno", entregar: "10", pos: 2 },
      { codigo: "33", ubicacion: "A-1", descripcion: "arandela", entregar: "1", pos: 3 },
    ];
    for (const [orden] of OPCIONES_ORDEN) {
      assert.deepEqual(ordenarFilasVentas(filas, orden), back.ordenarFilasVentas(filas, orden), orden);
    }
  });
});
