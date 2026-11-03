import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCargaPlanilla } from "../src/admin/useCargaPlanilla.js";
import { useContratistas } from "../src/admin/useContratistas.js";
import { useUltimasCargas } from "../src/admin/useUltimasCargas.js";

function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), { status });
}

beforeEach(() => {
  window.fetch = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

test("useCargaPlanilla carga la tabla y apaga el spinner", async () => {
  window.fetch.mockResolvedValue(json({ columnas: ["A"], filas: [[1]] }));
  const { result } = renderHook(() => useCargaPlanilla("/api/bodega", "No se pudo."));
  act(() => {
    result.current.recargar();
  });
  expect(result.current.cargando).toBe(true);
  await waitFor(() => expect(result.current.cargando).toBe(false));
  expect(result.current.tabla).toEqual({ columnas: ["A"], filas: [[1]], marcados: [] });
});

test("useCargaPlanilla en modo silencioso no muestra spinner y un error deja el aviso", async () => {
  window.fetch.mockResolvedValue(json({ error: "caido" }, 502));
  const { result } = renderHook(() => useCargaPlanilla("/api/bodega", "No se pudo."));
  act(() => {
    result.current.recargar(true);
  });
  expect(result.current.cargando).toBe(false);
  await waitFor(() => expect(result.current.aviso).toBe("caido"));
});

test("useUltimasCargas guarda las cargas y tolera un error", async () => {
  window.fetch.mockResolvedValueOnce(json({ cargas: { completa: "2026-10-01" } }));
  const { result } = renderHook(() => useUltimasCargas());
  await act(() => result.current.cargarUltimasCargas());
  expect(result.current.ultimasCargas).toEqual({ completa: "2026-10-01" });
  window.fetch.mockResolvedValueOnce(json({ error: "x" }, 500));
  await act(() => result.current.cargarUltimasCargas());
  expect(result.current.ultimasCargas).toEqual({ completa: "2026-10-01" });
});

test("useContratistas: abrir fija la base, editar marca cambios y descartar los revierte", async () => {
  window.fetch.mockResolvedValue(json({ filas: [{ nombre: "Ana" }, { nombre: "" }] }));
  const { result } = renderHook(() => useContratistas());
  act(() => result.current.abrir());
  await waitFor(() => expect(result.current.cargando).toBe(false));
  expect(result.current.listaContratistas).toEqual(["Ana"]);
  expect(result.current.hayCambios()).toBe(false);
  act(() => result.current.setContratistas([{ nombre: "Luis" }]));
  expect(result.current.hayCambios()).toBe(true);
  act(() => result.current.descartar());
  expect(result.current.contratistas).toEqual([{ nombre: "Ana" }, { nombre: "" }]);
});

test("useContratistas: guardar manda la clave y las filas, y un error deja el aviso", async () => {
  const { result } = renderHook(() => useContratistas());
  window.fetch.mockResolvedValueOnce(json({ filas: [{ nombre: "Ana" }] }));
  act(() => result.current.abrir());
  await waitFor(() => expect(result.current.cargando).toBe(false));

  window.fetch.mockResolvedValueOnce(json({ filas: [{ nombre: "Ana" }] }));
  act(() => result.current.guardarConfirmado("k"));
  await waitFor(() => expect(result.current.aviso).toBe("Contratistas guardados."));
  const [, opciones] = window.fetch.mock.calls.at(-1);
  expect(opciones.method).toBe("PUT");
  expect(JSON.parse(opciones.body)).toEqual({ clave: "k", filas: [{ nombre: "Ana" }] });

  window.fetch.mockResolvedValueOnce(json({ error: "clave mala" }, 403));
  act(() => result.current.guardarConfirmado("k"));
  await waitFor(() => expect(result.current.aviso).toBe("clave mala"));
});

test("useContratistas.refrescar solo toca las filas si el panel esta abierto", async () => {
  const { result } = renderHook(() => useContratistas());
  window.fetch.mockImplementation(async () => json({ filas: [{ nombre: "Ana" }] }));
  await act(() => result.current.refrescar(false));
  expect(result.current.listaContratistas).toEqual(["Ana"]);
  expect(result.current.contratistas).toEqual([]);
  await act(() => result.current.refrescar(true));
  expect(result.current.contratistas).toEqual([{ nombre: "Ana" }]);
  window.fetch.mockImplementation(async () => json({ error: "x" }, 500));
  await act(() => result.current.refrescar(true));
  expect(result.current.aviso).toBe("No se pudieron leer los contratistas.");
});
