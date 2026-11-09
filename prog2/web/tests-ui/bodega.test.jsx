import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "../src/componentes/Navbar.jsx";
import { ColoresPlanillaProvider } from "../src/componentes/ColoresPlanilla.jsx";
import { bodegaPrincipal, conBodega } from "../src/lib/bodega.js";

vi.mock("../src/componentes/Acceso.jsx", () => ({ useSesion: () => ({ rol: "operador", usuario: "ana" }) }));

beforeEach(() => {
  localStorage.clear();
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
});
afterEach(() => cleanup());

describe("selector de bodega", () => {
  it("bodega por defecto M501 y conBodega no cambia la ruta", () => {
    expect(bodegaPrincipal()).toBe("M501");
    expect(conBodega("/api/x?a=1")).toBe("/api/x?a=1");
  });

  it("conBodega agrega principal cuando la bodega es otra", () => {
    localStorage.setItem("bodega-principal", "M503");
    expect(conBodega("/api/x?a=1")).toBe("/api/x?a=1&principal=M503");
    expect(conBodega("/api/x")).toBe("/api/x?principal=M503");
  });

  it("la navbar muestra 5 bodegas y guarda la elegida", () => {
    const recargar = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: recargar } });
    render(<ColoresPlanillaProvider><MemoryRouter><Navbar /></MemoryRouter></ColoresPlanillaProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Bodega principal: M501/ }));
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "M504" }));
    expect(localStorage.getItem("bodega-principal")).toBe("M504");
    expect(recargar).toHaveBeenCalled();
  });
});