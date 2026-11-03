import assert from "node:assert/strict";
import test from "node:test";
import { filtrarYOrdenarPorCodigo, nombresContratistas, textoUltimaCarga } from "../src/admin/utilidades.js";

test("textoUltimaCarga avisa si no hay carga o la fecha es invalida", () => {
  const aviso = "Todavía no hay una carga registrada para esta opción.";
  assert.equal(textoUltimaCarga(undefined), aviso);
  assert.equal(textoUltimaCarga(""), aviso);
  assert.equal(textoUltimaCarga("no es fecha"), aviso);
});

test("textoUltimaCarga formatea una fecha valida", () => {
  assert.match(textoUltimaCarga("2026-10-01T15:30:00Z"), /^Último cambio: \d{2}\/\d{2}\/2026/);
});

test("nombresContratistas descarta nombres vacios y tolera null", () => {
  assert.deepEqual(nombresContratistas([{ nombre: "Ana" }, { nombre: "" }, {}, { nombre: "Luis" }]), ["Ana", "Luis"]);
  assert.deepEqual(nombresContratistas(null), []);
});

test("filtrarYOrdenarPorCodigo filtra, ordena y reordena los marcados", () => {
  const filas = [["x", "3"], ["x", "1"], ["x", "9"], ["x", "2"]];
  const marcados = [true, false, true, false];
  const codigos = new Set(["1", "2", "3"]);
  const orden = new Map([["2", 0], ["3", 1], ["1", 2]]);
  const r = filtrarYOrdenarPorCodigo(filas, 1, marcados, codigos, orden);
  assert.deepEqual(r.filas.map((f) => f[1]), ["2", "3", "1"]);
  assert.deepEqual(r.marcados, [false, true, false]);
  assert.equal(filtrarYOrdenarPorCodigo(filas, 1, undefined, codigos, orden).marcados, undefined);
  assert.deepEqual(filas.map((f) => f[1]), ["3", "1", "9", "2"]);
});
