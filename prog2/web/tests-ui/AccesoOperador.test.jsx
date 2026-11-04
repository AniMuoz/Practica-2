import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import PanelDetallado from "../src/paginas/admin/paneles/PanelDetallado.jsx";
import PanelMovimientos from "../src/paginas/admin/paneles/PanelMovimientos.jsx";
import PanelContratistas from "../src/paginas/admin/paneles/PanelContratistas.jsx";

afterEach(cleanup);

const accion = () => {};
const detalladoProps = {
  tabla: { columnas: ["n", "Codigo", "Stock Max"], filas: [] },
  filtrado: { filas: [["1", "100", "5"]], marcados: [] },
  cargando: false,
  aviso: "",
  error: "",
  hrefExcel: "/api/stock-detallado/excel",
  filtros: <div>filtros-aqui</div>,
  colores: false,
  oscuro: false,
  limpiarColumna: accion,
  actualizarCelda: accion,
  pegarColumna: accion,
  onGuardar: accion,
};

test("Stock detallado: el administrador puede editar y guardar", () => {
  render(<PanelDetallado {...detalladoProps} />);
  expect(screen.getByLabelText("Stock Max 100")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeTruthy();
});

test("Stock detallado: el operador solo ve, filtra y descarga", () => {
  render(<PanelDetallado {...detalladoProps} soloLectura />);
  expect(screen.queryByLabelText("Stock Max 100")).toBeNull();
  expect(screen.getByText("5")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("filtros-aqui")).toBeTruthy();
  expect(screen.getByText("Descargar planilla").getAttribute("href")).toBe("/api/stock-detallado/excel");
});

const movimientosProps = {
  tabla: { columnas: ["n", "Codigo"], filas: [] },
  filas: [["1", "100"]],
  cargando: false,
  aviso: "",
  recargar: accion,
  hrefExcel: "/api/movimientos/excel",
  filtros: <div>filtros-aqui</div>,
  colores: false,
  copiarExistencia: true,
  copiarInventario: true,
  alternarExistencia: accion,
  alternarInventario: accion,
  clave: "k",
};

test("Movimientos: el administrador puede añadir, editar y eliminar codigos", () => {
  render(<PanelMovimientos {...movimientosProps} />);
  expect(screen.getByLabelText("Añadir código")).toBeTruthy();
  expect(screen.getByText("Editar")).toBeTruthy();
  expect(screen.getByText("Eliminar")).toBeTruthy();
});

test("Movimientos: el operador no puede añadir, editar ni eliminar, pero si descargar", () => {
  render(<PanelMovimientos {...movimientosProps} soloLectura />);
  expect(screen.queryByLabelText("Añadir código")).toBeNull();
  expect(screen.queryByText("Editar")).toBeNull();
  expect(screen.queryByText("Eliminar")).toBeNull();
  expect(screen.getByText("Descargar planilla")).toBeTruthy();
});

function contratistasProps(extra = {}) {
  return {
    contratistas: [{ id: "1", nombre: "Ana" }],
    setContratistas: accion,
    cargando: false,
    guardando: false,
    aviso: "",
    setAviso: accion,
    alPedirConfirmacion: accion,
    colores: false,
    ...extra,
  };
}

test("Contratistas: el administrador puede editar, agregar y guardar", () => {
  render(<PanelContratistas {...contratistasProps()} />);
  expect(screen.getAllByRole("textbox").every((campo) => !campo.disabled)).toBe(true);
  expect(screen.getByRole("button", { name: "Agregar" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Guardar" })).toBeTruthy();
});

test("Contratistas: el operador ve la lista sin poder cambiarla", () => {
  render(<PanelContratistas {...contratistasProps({ soloLectura: true })} />);
  expect(screen.getAllByRole("textbox").every((campo) => campo.disabled)).toBe(true);
  expect(screen.getByRole("button", { name: "Quitar" }).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Agregar" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
});

