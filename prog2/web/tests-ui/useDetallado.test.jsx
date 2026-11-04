import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { useDetallado } from "../src/paginas/admin/hooks/useDetallado.js";

function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), { status });
}

const FILAS = [
  ["", "A1", "", "", "", "", "", "", "", "", "", "viejo1"],
  ["", "A2", "", "", "", "", "", "", "", "", "", "viejo2"],
  ["", "A3", "", "", "", "", "", "", "", "", "", "viejo3"],
];

let suspender;
let reanudar;

// Une el hook con un estado real de tabla, igual que hace Admin con useCargaPlanilla.
function montar() {
  suspender = vi.fn();
  reanudar = vi.fn();
  const codigos = new Set(["A1", "A2", "A3"]);
  const orden = new Map([["A1", 0], ["A2", 1], ["A3", 2]]);
  return renderHook(() => {
    const [detallado, setDetallado] = useState({ columnas: [], filas: FILAS });
    const api = useDetallado({
      clave: "k",
      detallado,
      setDetallado,
      codigosFiltrados: codigos,
      ordenCodigos: orden,
      suspenderRefresco: suspender,
      reanudarRefresco: reanudar,
    });
    return { detallado, ...api };
  });
}

beforeEach(() => {
  window.confirm = vi.fn(() => true);
  window.fetch = vi.fn(async () => json({ ok: true }));
});

test("actualizarCeldaDetallado cambia solo la fila del codigo y deja el cambio pendiente", () => {
  const { result } = montar();
  act(() => result.current.actualizarCeldaDetallado("A2", 11, "Col", "nuevo"));
  expect(result.current.detallado.filas.map((f) => f[11])).toEqual(["viejo1", "nuevo", "viejo3"]);
  expect(result.current.pendientesDetallado).toBe(1);
  expect(window.fetch).not.toHaveBeenCalled();
});

test("volver al valor original quita el pendiente", () => {
  const { result } = montar();
  act(() => result.current.actualizarCeldaDetallado("A1", 11, "Col", "editado"));
  act(() => result.current.actualizarCeldaDetallado("A1", 11, "Col", "viejo1"));
  expect(result.current.pendientesDetallado).toBe(0);
});

test("guardarCambiosDetallado no envia nada si no hay pendientes", async () => {
  const { result } = montar();
  await act(async () => {
    await result.current.guardarCambiosDetallado();
  });
  expect(window.fetch).not.toHaveBeenCalled();
});

test("guardarCambiosDetallado envia el PUT y, si el servidor falla, revierte y deja el error", async () => {
  window.fetch.mockImplementation(async () => json({ error: "sin permiso" }, 403));
  const { result } = montar();
  act(() => result.current.actualizarCeldaDetallado("A1", 11, "Col", "editado"));
  await act(async () => {
    await result.current.guardarCambiosDetallado();
  });
  const [url, opciones] = window.fetch.mock.calls[0];
  expect(url).toBe("/api/stock-detallado");
  expect(opciones.method).toBe("PUT");
  expect(JSON.parse(opciones.body)).toEqual({ clave: "k", codigo: "A1", datos: { Col: "editado" } });
  await waitFor(() => expect(result.current.errorDetallado).toBe("sin permiso"));
  expect(result.current.detallado.filas[0][11]).toBe("viejo1");
  expect(result.current.pendientesDetallado).toBe(0);
});

test("pegarColumnaDetallado deja el pegado normal si es una sola linea", () => {
  const { result } = montar();
  let r;
  act(() => {
    r = result.current.pegarColumnaDetallado(0, 11, "Col", "solo uno");
  });
  expect(r).toBeNull();
  expect(window.fetch).not.toHaveBeenCalled();
});

test("pegarColumnaDetallado rechaza mas de 500 filas", () => {
  const { result } = montar();
  let r;
  act(() => {
    r = result.current.pegarColumnaDetallado(0, 11, "Col", Array(501).fill("x").join("\n"));
  });
  expect(r).toBe(false);
  expect(result.current.errorDetallado).toBe("Se pueden pegar hasta 500 filas a la vez.");
});

test("pegarColumnaDetallado reparte hacia abajo sin guardar hasta pulsar Guardar", async () => {
  const { result } = montar();
  let r;
  act(() => {
    r = result.current.pegarColumnaDetallado(1, 11, "Col", "uno\ndos\ntres\n");
  });
  // Desde la segunda fila visible solo caben dos valores.
  expect(r).toBe("uno");
  expect(result.current.detallado.filas.map((f) => f[11])).toEqual(["viejo1", "uno", "dos"]);
  expect(result.current.pendientesDetallado).toBe(2);
  expect(window.fetch).not.toHaveBeenCalled();
  expect(suspender).not.toHaveBeenCalled();

  await act(async () => {
    await result.current.guardarCambiosDetallado();
  });
  expect(suspender).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(2));
  expect(window.fetch.mock.calls.map(([, o]) => JSON.parse(o.body).codigo)).toEqual(["A2", "A3"]);
  await waitFor(() => expect(reanudar).toHaveBeenCalledTimes(1));
  expect(result.current.pendientesDetallado).toBe(0);
});

test("guardarCambiosDetallado revierte las filas que fallan al guardar", async () => {
  window.fetch.mockImplementation(async (_url, o) =>
    JSON.parse(o.body).codigo === "A3" ? json({ error: "fallo A3" }, 500) : json({ ok: true })
  );
  const { result } = montar();
  act(() => {
    result.current.pegarColumnaDetallado(1, 11, "Col", "uno\ndos");
  });
  await act(async () => {
    await result.current.guardarCambiosDetallado();
  });
  await waitFor(() => expect(result.current.errorDetallado).toBe("fallo A3"));
  expect(result.current.detallado.filas.map((f) => f[11])).toEqual(["viejo1", "uno", "viejo3"]);
  expect(reanudar).toHaveBeenCalledTimes(1);
});

test("pegar valores iguales a los actuales no deja pendientes", () => {
  const { result } = montar();
  act(() => {
    result.current.pegarColumnaDetallado(0, 11, "Col", "viejo1\nviejo2");
  });
  expect(result.current.pendientesDetallado).toBe(0);
  expect(window.fetch).not.toHaveBeenCalled();
});

test("descartarCambiosDetallado restaura los valores originales", () => {
  const { result } = montar();
  act(() => result.current.actualizarCeldaDetallado("A1", 11, "Col", "editado"));
  act(() => result.current.descartarCambiosDetallado());
  expect(result.current.detallado.filas[0][11]).toBe("viejo1");
  expect(result.current.pendientesDetallado).toBe(0);
});

test("limpiarColumnaDetallado pide confirmacion, vacia la columna y no hace nada si se cancela", async () => {
  const { result } = montar();
  window.confirm.mockReturnValueOnce(false);
  act(() => result.current.limpiarColumnaDetallado("Col", 11));
  expect(window.fetch).not.toHaveBeenCalled();
  act(() => result.current.limpiarColumnaDetallado("Col", 11));
  await waitFor(() => expect(result.current.detallado.filas.every((f) => f[11] === "")).toBe(true));
  expect(window.fetch.mock.calls[0][0]).toBe("/api/stock-detallado/columna");
  expect(window.fetch.mock.calls[0][1].method).toBe("DELETE");
});
