import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Ventas, { nombreDescarga, nombreDescargaAnual } from "../src/Ventas.jsx";

const HOY = new Date();
const FILA = {
  id: 7, lote: 111, pos: 10, codigo: "100", descripcion: "Perno", ubicacion: "0102-A", m501: 10, m502: 0, m503: 0, m504: 0, m505: 0,
  solicitado: 4, entregar: 4, med: "UN", tiras: null, dif: 6, comp: "VERDADERO", kg_u: 0.5, kg_total: 2, precio_u: 100, precio_total: 400,
  contratista: "Ana", movimiento: "VENTA", almacen: "M501", n_venta: "55", cant_gd: 4, gd_esval: "", estado: "", fecha: "1/10/2026",
  dif_pend: 0, gd_esval2: "", fecha_gd: "", observacion: "", rojo: false,
};

let llamadas;
beforeEach(() => {
  llamadas = [];
  window.confirm = vi.fn(() => true);
  window.fetch = vi.fn(async (url, opciones = {}) => {
    llamadas.push({ url, metodo: opciones.method || "GET", cuerpo: opciones.body });
    const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status });
    if (String(url).startsWith("/api/ventas/meses")) return json({ meses: [{ id: 1, anio: HOY.getFullYear(), mes: HOY.getMonth() + 1 }, { id: 2, anio: 2025, mes: 12 }] });
    if (String(url).startsWith("/api/ventas/planilla")) {
      return String(url).includes("anio=2025")
        ? json({ existe: false, filas: [] })
        : json({ existe: true, id: 1, filas: [FILA, { ...FILA, id: 8, pos: 20, codigo: "200", descripcion: "Tuerca" }] });
    }
    if (opciones.method === "PATCH") return json({ fila: { ...FILA, estado: "Entregado" } });
    return json({});
  });
});
afterEach(() => cleanup());

describe("Ventas", () => {
  it("muestra la preview de la planilla del mes", async () => {
    render(<Ventas listaContratistas={["Ana"]} />);
    expect(await screen.findByText("Perno")).toBeTruthy();
    expect(screen.queryByText(/Archivo de ventas existente/)).toBeNull();
    expect(screen.getByText("Descargar Excel")).toBeTruthy();
  });

  it("al elegir un mes anterior consulta esa planilla", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.change(screen.getByLabelText("Mes de la planilla"), { target: { value: "2025-12" } });
    await screen.findByText(/No hay planilla de diciembre 2025/);
    expect(llamadas.some((l) => l.url === "/api/ventas/planilla?anio=2025&mes=12")).toBe(true);
  });

  it("solo permite editar tras presionar Editar y guarda con el mismo botón", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    expect(screen.queryByLabelText("editar estado fila 10")).toBeNull();
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.change(screen.getByLabelText("editar estado fila 10"), { target: { value: "Entregado" } });
    expect(llamadas.some((l) => l.metodo === "PATCH")).toBe(false);
    fireEvent.click(screen.getByText("Guardar"));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === "PATCH" && l.url === "/api/ventas/filas/7")).toBe(true));
    expect(JSON.parse(llamadas.find((l) => l.metodo === "PATCH").cuerpo)).toEqual({ estado: "Entregado" });
    await screen.findByText("Editar");
    expect(screen.queryByLabelText("editar estado fila 10")).toBeNull();
  });

  it("reparte hacia abajo varias filas de una columna pegadas desde Excel", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.paste(screen.getByLabelText("editar estado fila 10"), { clipboardData: { getData: () => "Listo\nPendiente\n" } });
    expect(screen.getByLabelText("editar estado fila 10").value).toBe("Listo");
    expect(screen.getByLabelText("editar estado fila 20").value).toBe("Pendiente");
    fireEvent.click(screen.getByText("Guardar"));
    await waitFor(() => expect(llamadas.filter((l) => l.metodo === "PATCH").length).toBe(2));
    expect(JSON.parse(llamadas.find((l) => l.url.endsWith("/8")).cuerpo)).toEqual({ estado: "Pendiente" });
  });

  it("propaga el valor de una celda hacia abajo dentro de la orden", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.change(screen.getByLabelText("editar estado fila 10"), { target: { value: "Entregado" } });
    fireEvent.click(screen.getByLabelText("copiar hacia abajo estado fila 10"));
    expect(screen.getByLabelText("editar estado fila 20").value).toBe("Entregado");
  });

  it("al guardar sin cambios no envía nada", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.click(screen.getByText("Guardar"));
    await screen.findByText("Editar");
    expect(llamadas.some((l) => l.metodo === "PATCH")).toBe(false);
  });
  it("elimina una orden completa tras confirmar", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.click(screen.getByText("Eliminar orden"));
    await waitFor(() => expect(llamadas.some((l) => l.metodo === "DELETE" && l.url === "/api/ventas/ordenes/1/111")).toBe(true));
  });

  it("avisa de cambios sin guardar en el formulario", async () => {
    const aviso = vi.fn();
    render(<Ventas listaContratistas={[]} onSinGuardar={aviso} />);
    await screen.findByText("Perno");
    fireEvent.change(screen.getByPlaceholderText("Ej: 12345"), { target: { value: "99" } });
    await waitFor(() => expect(aviso).toHaveBeenLastCalledWith(true));
  });

  it("copia solo el rango de celdas seleccionado, sin la columna Quitar ni la cabecera de orden", async () => {
    render(<Ventas listaContratistas={[]} />);
    const perno = await screen.findByText("Perno");
    // Deja que React termine de enganchar los listeners de la tabla (efectos pendientes).
    await act(async () => {});
    const fila = perno.closest("tr");
    const celdas = fila.cells;
    document.elementFromPoint = () => celdas[2];
    fireEvent.mouseDown(celdas[1], { button: 0 });
    fireEvent.mouseMove(celdas[2], { button: 0 });
    fireEvent.mouseUp(celdas[2]);
    const datos = {};
    const evento = new Event("copy", { bubbles: true, cancelable: true });
    evento.clipboardData = { setData: (tipo, valor) => { datos[tipo] = valor; } };
    document.dispatchEvent(evento);
    expect(datos["text/plain"]).toBe("100\tPerno");
  });

  it("ofrece descargar la planilla anual del año a la vista", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    expect(screen.getByText("Descargar planilla anual")).toBeTruthy();
    const selector = screen.getByLabelText("Año de la planilla anual");
    await waitFor(() => expect([...selector.options].map((o) => o.value)).toContain("2025"));
    fireEvent.change(selector, { target: { value: "2025" } });
    window.URL.createObjectURL = vi.fn(() => "blob:x");
    window.URL.revokeObjectURL = vi.fn();
    fireEvent.click(screen.getByText("Descargar planilla anual"));
    fireEvent.click(await screen.findByText("Descargar planilla completa"));
    await waitFor(() => expect(llamadas.some((l) => l.url.startsWith("/api/ventas/descargar-anual?anio=2025"))).toBe(true));
    expect(nombreDescargaAnual(2026, new Date(2026, 9, 5))).toBe("VENTAS ANUAL 2026 05-10-2026.xlsx");
  });

  it("nombra la descarga VENTAS dd-mm-aaaa.xlsx", () => {
    expect(nombreDescarga(new Date(2026, 9, 5))).toBe("VENTAS 05-10-2026.xlsx");
  });
});
