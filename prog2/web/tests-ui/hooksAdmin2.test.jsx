import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

let oyente;
vi.mock("../src/lib/eventos.js", () => ({
  suscribirEventos: (o) => {
    oyente = o;
    return () => {
      oyente = null;
    };
  },
}));

import { usePaneles } from "../src/paginas/admin/hooks/usePaneles.js";
import { useRefrescoSse } from "../src/paginas/admin/hooks/useRefrescoSse.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("usePaneles abre varios y cerrarOtros deja solo los permitidos", () => {
  const { result } = renderHook(() => usePaneles());
  expect(Object.values(result.current.abierto).every((v) => v === false)).toBe(true);
  act(() => {
    result.current.fijar("carga", true);
    result.current.fijar("formulario", true);
    result.current.fijar("bodega", true);
  });
  expect(result.current.abierto).toMatchObject({ carga: true, formulario: true, bodega: true });
  act(() => result.current.cerrarOtros(["carga", "formulario"]));
  expect(result.current.abierto).toMatchObject({ carga: true, formulario: true, bodega: false });
  act(() => result.current.cerrarOtros(["regional"]));
  expect(Object.values(result.current.abierto).some(Boolean)).toBe(false);
});

test("usePaneles no cambia el estado si nada cambia", () => {
  const { result } = renderHook(() => usePaneles());
  const antes = result.current.abierto;
  act(() => result.current.fijar("bodega", false));
  act(() => result.current.cerrarOtros([]));
  expect(result.current.abierto).toBe(antes);
});

test("useRefrescoSse junta varios avisos en una recarga y usa la ultima funcion", () => {
  const primera = vi.fn();
  const segunda = vi.fn();
  const { rerender } = renderHook(({ fn }) => useRefrescoSse(fn), { initialProps: { fn: primera } });
  rerender({ fn: segunda });
  oyente.alMensaje({ tipo: "fila" });
  oyente.alMensaje({ tipo: "recarga" });
  oyente.alMensaje({ tipo: "buzon" });
  vi.advanceTimersByTime(200);
  expect(primera).not.toHaveBeenCalled();
  expect(segunda).toHaveBeenCalledTimes(1);
});

test("useRefrescoSse: suspender frena el refresco y reanudar lo libera tras un instante", () => {
  const refrescar = vi.fn();
  const { result } = renderHook(() => useRefrescoSse(refrescar));
  act(() => result.current.suspender());
  oyente.alMensaje({ tipo: "recarga" });
  vi.advanceTimersByTime(1000);
  expect(refrescar).not.toHaveBeenCalled();
  act(() => result.current.reanudar());
  oyente.alMensaje({ tipo: "recarga" });
  vi.advanceTimersByTime(300);
  expect(refrescar).not.toHaveBeenCalled();
  vi.advanceTimersByTime(200);
  oyente.alMensaje({ tipo: "recarga" });
  vi.advanceTimersByTime(200);
  expect(refrescar).toHaveBeenCalledTimes(1);
});
