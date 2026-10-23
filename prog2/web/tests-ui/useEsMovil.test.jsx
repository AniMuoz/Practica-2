import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEsMovil } from "../src/useEsMovil.js";

function simularMatchMedia(inicial) {
  let oyente = null;
  window.matchMedia = vi.fn((consulta) => ({
    matches: inicial,
    media: consulta,
    addEventListener: (_evento, fn) => {
      oyente = fn;
    },
    removeEventListener: vi.fn(),
  }));
  return (matches) => oyente({ matches });
}

afterEach(() => vi.restoreAllMocks());

test("refleja el estado inicial y reacciona a cambios de ancho", () => {
  const cambiar = simularMatchMedia(false);
  const { result } = renderHook(() => useEsMovil());
  expect(result.current).toBe(false);
  act(() => cambiar(true));
  expect(result.current).toBe(true);
});

test("usa el ancho maximo indicado", () => {
  simularMatchMedia(true);
  renderHook(() => useEsMovil(768));
  expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 768px)");
});
