import { beforeEach, expect, test, vi } from "vitest";
import { suscribirEventos } from "../src/eventos.js";

let creadas;

beforeEach(() => {
  creadas = [];
  globalThis.EventSource = class {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.close = vi.fn();
      creadas.push(this);
    }
  };
});

test("varios oyentes comparten una sola conexion y se cierra con el ultimo", () => {
  const a = vi.fn();
  const b = vi.fn();
  const cancelarA = suscribirEventos({ alMensaje: a });
  const cancelarB = suscribirEventos({ alMensaje: b });
  expect(creadas).toHaveLength(1);
  creadas[0].onmessage({ data: JSON.stringify({ tipo: "buzon" }) });
  expect(a).toHaveBeenCalledWith({ tipo: "buzon" });
  expect(b).toHaveBeenCalledWith({ tipo: "buzon" });
  creadas[0].onmessage({ data: "no json" });
  expect(a).toHaveBeenCalledTimes(1);
  cancelarA();
  expect(creadas[0].close).not.toHaveBeenCalled();
  cancelarB();
  expect(creadas[0].close).toHaveBeenCalled();
  suscribirEventos({})();
  expect(creadas).toHaveLength(2);
});
