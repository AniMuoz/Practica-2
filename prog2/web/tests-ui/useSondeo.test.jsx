import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { INACTIVIDAD_MS, useSondeo } from "../src/lib/useSondeo.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("lee al montar y repite cada intervalo", async () => {
  const leer = vi.fn().mockResolvedValue();
  renderHook(() => useSondeo(leer, 1000));
  await vi.advanceTimersByTimeAsync(0);
  expect(leer).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(leer).toHaveBeenCalledTimes(2);
});

test("sin lectura inmediata espera al primer intervalo", async () => {
  const leer = vi.fn().mockResolvedValue();
  renderHook(() => useSondeo(leer, 1000, true, false));
  expect(leer).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(leer).toHaveBeenCalledTimes(1);
});

test("si falla espacia los reintentos (backoff)", async () => {
  const leer = vi.fn().mockRejectedValue(new Error("x"));
  renderHook(() => useSondeo(leer, 1000));
  await vi.advanceTimersByTimeAsync(0);
  expect(leer).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(leer).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(leer).toHaveBeenCalledTimes(2);
});

test("se pausa tras la inactividad y retoma al usar la pagina", async () => {
  const leer = vi.fn().mockResolvedValue();
  renderHook(() => useSondeo(leer, 30000));
  await vi.advanceTimersByTimeAsync(INACTIVIDAD_MS + 1);
  const llamadas = leer.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120000);
  expect(leer).toHaveBeenCalledTimes(llamadas);
  document.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(0);
  expect(leer).toHaveBeenCalledTimes(llamadas + 1);
});

test("inactivo no lee nada", async () => {
  const leer = vi.fn().mockResolvedValue();
  renderHook(() => useSondeo(leer, 1000, false));
  await vi.advanceTimersByTimeAsync(5000);
  expect(leer).not.toHaveBeenCalled();
});
