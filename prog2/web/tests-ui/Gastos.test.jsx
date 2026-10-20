import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gastos from "../src/Gastos.jsx";

vi.mock("../src/Navbar.jsx", () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  window.fetch = vi.fn(async () => new Response(JSON.stringify({ topicos: ["COMBUSTIBLE", "OTROS"] }), { status: 200 }));
});
afterEach(() => cleanup());

function llenar(monto) {
  fireEvent.change(screen.getByLabelText("Tópico"), { target: { value: "COMBUSTIBLE" } });
  fireEvent.change(screen.getByLabelText("Proveedor"), { target: { value: "Copec" } });
  fireEvent.change(screen.getByLabelText("N° Boleta"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("Fecha Boleta"), { target: { value: "2024-12-01" } });
  fireEvent.change(screen.getByLabelText("Monto"), { target: { value: monto } });
  fireEvent.click(screen.getByText("Agregar"));
}

describe("Gastos", () => {
  it("agrega una boleta a la tabla", async () => {
    render(<Gastos />);
    await screen.findByText("OTROS");
    llenar("15000");
    expect(await screen.findByText("Copec")).toBeTruthy();
    expect(screen.getByText("01/12/2024")).toBeTruthy();
    expect(screen.getByText("Guardar Datos sin procesar")).toBeTruthy();
  });
  it("rechaza un monto no entero", async () => {
    render(<Gastos />);
    await screen.findByText("OTROS");
    llenar("12,5");
    expect((await screen.findByRole("alert")).textContent).toMatch(/entero/);
  });
  it("exige todos los campos", async () => {
    render(<Gastos />);
    fireEvent.click(screen.getByText("Agregar"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/completar/);
  });
});
