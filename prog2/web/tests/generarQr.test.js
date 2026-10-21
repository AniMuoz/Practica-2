import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estadoQr, marcaRombo, sinQr, urlQr, URL_BASE_QR } from "../src/generarQr.js";

describe("generarQr", () => {
  it("urlQr concatena base y codigo", () => {
    assert.equal(urlQr("123"), `${URL_BASE_QR}123`);
    assert.equal(urlQr("9", "http://x/"), "http://x/9");
  });
  it("sinQr deja solo las filas con QR vacio", () => {
    const filas = [{ Codigo: 1, QR: "" }, { Codigo: 2, QR: "qr_2.png" }, { Codigo: 3 }, { Codigo: 4, QR: "  " }];
    assert.deepEqual(sinQr(filas).map((f) => f.Codigo), [1, 3, 4]);
  });

  it("estadoQr detecta QR desactualizados segun el rombo", () => {
    assert.equal(estadoQr({ QR: "" }), "sin_qr");
    assert.equal(estadoQr({ QR: "1-qr.png", Rombo: "" }), "ok");
    assert.equal(estadoQr({ QR: "1-qr.png", Rombo: "1-rombo-ab.png" }), "desactualizado");
    const marca = marcaRombo("1-rombo-ab.png");
    assert.equal(estadoQr({ QR: `1-qr-r${marca}.png`, Rombo: "1-rombo-ab.png" }), "ok");
    assert.equal(estadoQr({ QR: `1-qr-r${marca}.png`, Rombo: "1-rombo-cd.png" }), "desactualizado");
    assert.equal(estadoQr({ QR: `1-qr-r${marca}.png`, Rombo: "" }), "desactualizado");
  });
});
