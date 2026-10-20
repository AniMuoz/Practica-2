import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/Navbar.jsx", () => ({ default: () => null }));

const respuesta = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status });
let Acceso;
let GeneradorQr;

async function montar(rol) {
  window.fetch = vi.fn(async (url) =>
    String(url).includes("/api/sesion") ? respuesta(200, { usuario: "u", rol }) : respuesta(200, { columnas: [], filas: [] })
  );
  vi.resetModules();
  Acceso = (await import("../src/Acceso.jsx")).default;
  GeneradorQr = (await import("../src/GeneradorQr.jsx")).default;
  render(
    <Acceso>
      <MemoryRouter initialEntries={["/qr"]}>
        <Routes>
          <Route path="/qr" element={<GeneradorQr />} />
          <Route path="/" element={<p>tabla principal</p>} />
        </Routes>
      </MemoryRouter>
    </Acceso>
  );
}

beforeEach(() => {});
afterEach(() => cleanup());

describe("GeneradorQr", () => {
  it("redirige al operador", async () => {
    await montar("operador");
    expect(await screen.findByText("tabla principal")).toBeTruthy();
  });
  it("muestra la pagina al admin", async () => {
    await montar("admin");
    expect(await screen.findByRole("heading", { name: /generador de qr/i })).toBeTruthy();
  });
});
