import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import PanelContratistas from "../src/admin/PanelContratistas.jsx";

afterEach(cleanup);

function Contenedor({ inicial, alPedirConfirmacion = () => {} }) {
  const [contratistas, setContratistas] = useState(inicial);
  const [aviso, setAviso] = useState("");
  return (
    <PanelContratistas
      contratistas={contratistas}
      setContratistas={setContratistas}
      cargando={false}
      guardando={false}
      aviso={aviso}
      setAviso={setAviso}
      alPedirConfirmacion={alPedirConfirmacion}
      colores={false}
    />
  );
}

test("muestra los contratistas y agrega una fila con el siguiente id", async () => {
  render(<Contenedor inicial={[{ id: "1", nombre: "Ana" }, { id: "5", nombre: "Luis" }]} />);
  expect(screen.getAllByRole("textbox")).toHaveLength(4);
  await userEvent.click(screen.getByRole("button", { name: "Agregar" }));
  expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(3);
  expect(screen.getAllByRole("textbox").some((campo) => campo.value === "6")).toBe(true);
});

test("quita una fila", async () => {
  render(<Contenedor inicial={[{ id: "1", nombre: "Ana" }, { id: "2", nombre: "Luis" }]} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Quitar" })[0]);
  expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(1);
});

test("guardar con datos validos pide confirmacion", async () => {
  const pedir = vi.fn();
  render(<Contenedor inicial={[{ id: "1", nombre: "Ana" }]} alPedirConfirmacion={pedir} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(pedir).toHaveBeenCalledTimes(1);
});

test("guardar con un nombre vacio muestra el error y no pide confirmacion", async () => {
  const pedir = vi.fn();
  render(<Contenedor inicial={[{ id: "1", nombre: " " }]} alPedirConfirmacion={pedir} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(pedir).not.toHaveBeenCalled();
  expect(screen.getByText("La fila 1 necesita un nombre.")).toBeTruthy();
});
