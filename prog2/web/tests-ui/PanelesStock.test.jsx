import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PanelInventario from "../src/admin/PanelInventario.jsx";
import PanelBodega from "../src/admin/PanelBodega.jsx";
import PanelPlanilla from "../src/admin/PanelPlanilla.jsx";
import PanelRegional from "../src/admin/PanelRegional.jsx";

afterEach(() => cleanup());

const TABLA = { columnas: ["Codigo", "Descripcion", "Libre"], filas: [] };
const FILAS = [["100", "Perno", 5]];

function propsBase(extra = {}) {
  return {
    tabla: TABLA,
    filas: FILAS,
    cargando: false,
    aviso: "",
    hrefExcel: "/api/bodega/excel?x=1",
    filtros: <div>filtros-aqui</div>,
    colores: true,
    clasePlanilla: undefined,
    ...extra,
  };
}

test("PanelPlanilla muestra titulo, descarga y filtros, y oculta el contenido mientras carga", () => {
  render(
    <PanelPlanilla titulo="Titulo" hrefExcel="/x" filtros={<span>f</span>} cargando textoCargando="Cargando..." aviso="">
      <p>contenido</p>
    </PanelPlanilla>
  );
  expect(screen.getByText("Titulo")).toBeTruthy();
  expect(screen.getByText("Descargar planilla").getAttribute("href")).toBe("/x");
  expect(screen.getByText("f")).toBeTruthy();
  expect(screen.getByText("Cargando...")).toBeTruthy();
  expect(screen.queryByText("contenido")).toBeNull();
});

test("PanelPlanilla muestra el aviso de error en lugar del contenido", () => {
  render(
    <PanelPlanilla titulo="T" hrefExcel="/x" cargando={false} textoCargando="..." aviso="Supabase caido">
      <p>contenido</p>
    </PanelPlanilla>
  );
  expect(screen.getByText("Supabase caido")).toBeTruthy();
  expect(screen.queryByText("contenido")).toBeNull();
});

test("PanelBodega muestra las filas, los filtros y el enlace de descarga", () => {
  render(<PanelBodega {...propsBase()} />);
  expect(screen.getByText("Bodega M501")).toBeTruthy();
  expect(screen.getByText("filtros-aqui")).toBeTruthy();
  expect(screen.getByText("Perno")).toBeTruthy();
  expect(screen.getByText("Descargar planilla").getAttribute("href")).toBe("/api/bodega/excel?x=1");
});

test("PanelBodega sin filas explica que no hay stock", () => {
  render(<PanelBodega {...propsBase({ filas: [] })} />);
  expect(screen.getByText("No hay stock de M501 cargado.")).toBeTruthy();
});

test("PanelRegional muestra el titulo y el mensaje de vacio propios", () => {
  const { unmount } = render(<PanelRegional {...propsBase()} />);
  expect(screen.getByText("Stock por bodega")).toBeTruthy();
  expect(screen.getByText("Perno")).toBeTruthy();
  unmount();
  render(<PanelRegional {...propsBase({ filas: [] })} />);
  expect(screen.getByText("No hay stock regional cargado.")).toBeTruthy();
});

test("PanelInventario avisa al usar los interruptores y resalta las celdas vacias", () => {
  const alternarExistencia = vi.fn();
  const alternarInventario = vi.fn();
  const { container } = render(
    <PanelInventario
      {...propsBase({ filas: [["100", "Perno", "", "7"]], tabla: { columnas: ["a", "b", "c", "d"], filas: [] } })}
      copiarExistencia={false}
      copiarInventario
      alternarExistencia={alternarExistencia}
      alternarInventario={alternarInventario}
    />
  );
  expect(screen.getByText("Inventario por lugar")).toBeTruthy();
  fireEvent.click(screen.getByText("Libre utilización"));
  fireEvent.click(screen.getByText("Inventario"));
  expect(alternarExistencia).toHaveBeenCalledTimes(1);
  expect(alternarInventario).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll("td.celda-color")).toHaveLength(1);
  expect(screen.getByText("Descargar planilla")).toBeTruthy();
});