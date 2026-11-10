import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estadoQr,
  evaluarLecturaQr,
  marcaRombo,
  resumenRevisionQr,
  sinQr,
  urlQr,
  URL_BASE_QR,
} from "../src/lib/generarQr.js";

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

  it("evaluarLecturaQr valida codigo y url del QR", () => {
    assert.equal(evaluarLecturaQr("10", `${URL_BASE_QR}10`).estado, "ok");
    assert.equal(evaluarLecturaQr("10", `${URL_BASE_QR}99`).estado, "url_incorrecta");
    assert.equal(evaluarLecturaQr("10", "http://otra/10").estado, "url_incorrecta");
    assert.equal(evaluarLecturaQr("10", "").estado, "ilegible");
  });

  it("resumenRevisionQr cuenta por estado", () => {
    assert.deepEqual(
      resumenRevisionQr([
        { estado: "ok" },
        { estado: "ok" },
        { estado: "url_incorrecta" },
        { estado: "ilegible" },
        { estado: "sin_imagen" },
      ]),
      { ok: 2, url_incorrecta: 1, ilegible: 1, sin_imagen: 1, sin_qr: 0 }
    );
  });
});
