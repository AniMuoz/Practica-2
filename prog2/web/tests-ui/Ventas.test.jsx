import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Ventas, { nombreDescarga, tablaComoTsv } from "../src/Ventas.jsx";

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
        : json({ existe: true, id: 1, filas: [FILA] });
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

  it("guarda una celda editada con PATCH", async () => {
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.doubleClick(screen.getByLabelText("estado fila 10"));
    const celda = screen.getByLabelText("editar estado fila 10");
    fireEvent.change(celda, { target: { value: "Entregado" } });
    fireEvent.blur(celda);
    await waitFor(() => expect(llamadas.some((l) => l.metodo === "PATCH" && l.url === "/api/ventas/filas/7")).toBe(true));
    expect(JSON.parse(llamadas.find((l) => l.metodo === "PATCH").cuerpo)).toEqual({ estado: "Entregado" });
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

  it("copia la tabla como texto separado por tabuladores", async () => {
    const copiar = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copiar }, configurable: true });
    render(<Ventas listaContratistas={[]} />);
    await screen.findByText("Perno");
    fireEvent.click(screen.getByText("Copiar como Excel"));
    await waitFor(() => expect(copiar).toHaveBeenCalled());
    const [encabezado, fila] = copiar.mock.calls[0][0].split("\n");
    expect(encabezado.startsWith("Pos\tCódigo\tDescripción")).toBe(true);
    expect(fila.startsWith("10\t100\tPerno")).toBe(true);
    expect(tablaComoTsv([{ ...FILA, descripcion: "a\tb\nc" }]).split("\n")[1]).toContain("a b c");
  });

  it("nombra la descarga VENTAS dd-mm-aaaa.xlsx", () => {
    expect(nombreDescarga(new Date(2026, 9, 5))).toBe("VENTAS 05-10-2026.xlsx");
  });
});
