import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sinQr, urlQr, URL_BASE_QR } from "../src/generarQr.js";

describe("generarQr", () => {
  it("urlQr concatena base y codigo", () => {
    assert.equal(urlQr("123"), `${URL_BASE_QR}123`);
    assert.equal(urlQr("9", "http://x/"), "http://x/9");
  });
  it("sinQr deja solo las filas con QR vacio", () => {
    const filas = [{ Codigo: 1, QR: "" }, { Codigo: 2, QR: "qr_2.png" }, { Codigo: 3 }, { Codigo: 4, QR: "  " }];
    assert.deepEqual(sinQr(filas).map((f) => f.Codigo), [1, 3, 4]);
  });
});
