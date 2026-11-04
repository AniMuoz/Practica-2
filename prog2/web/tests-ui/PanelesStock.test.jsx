import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PanelReserva from "../src/paginas/admin/paneles/PanelReserva.jsx";
import PanelMovimientos from "../src/paginas/admin/paneles/PanelMovimientos.jsx";
import PanelInventario from "../src/paginas/admin/paneles/PanelInventario.jsx";
import PanelBodega from "../src/paginas/admin/paneles/PanelBodega.jsx";
import PanelPlanilla from "../src/paginas/admin/paneles/PanelPlanilla.jsx";
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
test("PanelMovimientos añade un codigo y recarga, y pide confirmacion para eliminar", async () => {
  const llamadas = [];
  globalThis.fetch = vi.fn(async (url, opciones) => {
    llamadas.push([url, opciones?.method]);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const recargar = vi.fn(async () => {});
  const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(
    <PanelMovimientos
      {...propsBase({ filas: [["1", "100", "x"]], tabla: { columnas: ["n", "Codigo", "Otro"], filas: [] } })}
      clave="k"
      recargar={recargar}
      copiarExistencia
      copiarInventario
      alternarExistencia={() => {}}
      alternarInventario={() => {}}
    />
  );
  fireEvent.change(screen.getByLabelText("Añadir código"), { target: { value: "200" } });
  fireEvent.submit(screen.getByLabelText("Añadir código").closest("form"));
  await vi.waitFor(() => expect(recargar).toHaveBeenCalledWith(true));
  expect(llamadas[0][0]).toContain("/api/movimientos/codigo");
  fireEvent.click(screen.getByText("Eliminar"));
  expect(confirmar).toHaveBeenCalled();
  expect(llamadas).toHaveLength(1);
  confirmar.mockRestore();
});
test("PanelReserva no pinta nada oculto y conserva la busqueda al ocultarse", async () => {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ columnas: ["Código"], filas: [["100"]], marcadosCodigo: [false], repeticiones: [1], total: 1, coincidencias: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  const { container, rerender } = render(<PanelReserva visible={false} colores clasePlanilla={undefined} />);
  expect(container.innerHTML).toBe("");
  rerender(<PanelReserva visible colores clasePlanilla={undefined} />);
  fireEvent.change(screen.getByLabelText("Número de reserva"), { target: { value: "55" } });
  fireEvent.click(screen.getByText("Buscar reserva"));
  await screen.findByText("100");
  rerender(<PanelReserva visible={false} colores clasePlanilla={undefined} />);
  rerender(<PanelReserva visible colores clasePlanilla={undefined} />);
  expect(screen.getByText("100")).toBeTruthy();
});