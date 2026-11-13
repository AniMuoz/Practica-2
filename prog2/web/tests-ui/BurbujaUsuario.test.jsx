import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BurbujaUsuario from "../src/componentes/BurbujaUsuario.jsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("el admin abre la lista de activos de la bodega", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ usuarios: [{ usuario: "ana", rol: "admin", hace_seg: 5 }, { usuario: "luis", rol: "operador", hace_seg: 130 }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<BurbujaUsuario usuario="ana" puedeVerActivos />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "ana" }));
  await waitFor(() => expect(screen.getByText(/luis/)).toBeTruthy());
  expect(screen.getByText(/\(tú\)/)).toBeTruthy();
  expect(screen.getByText("hace 2 min")).toBeTruthy();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/presencia");
});

test("el operador ve la burbuja pero no puede abrirla", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<BurbujaUsuario usuario="luis" puedeVerActivos={false} />);
  expect(screen.getByText("luis")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
