import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests de caracterizacion de Admin: fijan el comportamiento actual antes de dividir el archivo.
let oyenteSse;
vi.mock("../src/lib/eventos.js", () => ({
  suscribirEventos: (oyente) => {
    oyenteSse = oyente;
    return () => {
      oyenteSse = null;
    };
  },
}));
vi.mock("../src/componentes/Acceso.jsx", () => ({ useSesion: () => ({ rol: "admin", usuario: "ana" }) }));
vi.mock("../src/componentes/Navbar.jsx", () => ({ default: () => null }));
vi.mock("../src/componentes/Recorrido.jsx", () => ({ iniciarRecorrido: () => {}, recorridoPendiente: () => false }));

import Admin from "../src/paginas/Admin.jsx";
import { ColoresPlanillaProvider } from "../src/componentes/ColoresPlanilla.jsx";

const TABLA = { columnas: ["Codigo", "Descripcion"], filas: [] };
let llamadas;

function json(datos, status = 200) {
  return new Response(JSON.stringify(datos), { status });
}

function cuantas(ruta) {
  return llamadas.filter((url) => url === ruta).length;
}

function montar() {
  const router = createMemoryRouter([{ path: "/", element: <Admin /> }]);
  return render(
    <ColoresPlanillaProvider>
      <RouterProvider router={router} />
    </ColoresPlanillaProvider>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  llamadas = [];
  oyenteSse = null;
  window.confirm = vi.fn(() => true);
  window.matchMedia = vi.fn((consulta) => ({
    matches: false,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  window.fetch = vi.fn(async (url) => {
    const ruta = String(url);
    llamadas.push(ruta);
    if (ruta === "/api/acceso") return json({ clave: "k" });
    if (ruta === "/api/tabla") return json(TABLA);
    if (ruta === "/api/tabla/ultimas-cargas") return json({ cargas: {} });
    if (ruta === "/api/contratistas") return json({ filas: [{ nombre: "Ana" }] });
    if (ruta.startsWith("/api/")) return json({ columnas: ["Codigo"], filas: [], marcados: [] });
    return json({});
  });
});

afterEach(() => cleanup());

describe("Admin", () => {
  it("al entrar pide el acceso y luego la tabla y las ultimas cargas", async () => {
    montar();
    expect(await screen.findByText("Stock en bodega")).toBeTruthy();
    await waitFor(() => expect(cuantas("/api/tabla")).toBeGreaterThan(0));
    expect(llamadas[0]).toBe("/api/acceso");
    expect(cuantas("/api/tabla/ultimas-cargas")).toBe(1);
    expect(cuantas("/api/bodega")).toBe(0);
  });

  it("abrir un panel carga solo sus datos", async () => {
    montar();
    fireEvent.click(await screen.findByText("Stock en bodega"));
    await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
    expect(cuantas("/api/inventario")).toBe(0);
  });

  it("al abrir otro panel el anterior se cierra y deja de refrescarse por SSE", async () => {
    montar();
    fireEvent.click(await screen.findByText("Stock en bodega"));
    await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
    fireEvent.click(screen.getByText("Planilla de inventario"));
    await waitFor(() => expect(cuantas("/api/inventario")).toBe(1));

    oyenteSse.alMensaje({ tipo: "recarga" });
    await waitFor(() => expect(cuantas("/api/inventario")).toBe(2));
    expect(cuantas("/api/bodega")).toBe(1);
  });

  it("varios avisos SSE seguidos producen una sola recarga", async () => {
    montar();
    fireEvent.click(await screen.findByText("Stock en bodega"));
    await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
    oyenteSse.alMensaje({ tipo: "fila" });
    oyenteSse.alMensaje({ tipo: "recarga" });
    oyenteSse.alMensaje({ tipo: "otra-cosa" });
    await waitFor(() => expect(cuantas("/api/bodega")).toBe(2));
    await new Promise((r) => setTimeout(r, 400));
    expect(cuantas("/api/bodega")).toBe(2);
  });

  it("los eventos que no son de tabla no recargan nada", async () => {
    montar();
    fireEvent.click(await screen.findByText("Stock en bodega"));
    await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
    oyenteSse.alMensaje({ tipo: "buzon" });
    await new Promise((r) => setTimeout(r, 400));
    expect(cuantas("/api/bodega")).toBe(1);
  });

  it("abrir contratistas pide la lista y la muestra", async () => {
    montar();
    fireEvent.click(await screen.findByText("Editar contratistas"));
    await waitFor(() => expect(cuantas("/api/contratistas")).toBe(1));
    expect(await screen.findByDisplayValue("Ana")).toBeTruthy();
  });

  describe("cambios sin guardar", () => {
    async function escribirEnFormulario() {
      fireEvent.click(await screen.findByText("Añadir/cargar datos"));
      fireEvent.change(await screen.findByLabelText("Descripcion"), { target: { value: "Perno" } });
    }

    it("avisa al cambiar de panel y permite seguir en la pagina", async () => {
      montar();
      await escribirEnFormulario();
      fireEvent.click(screen.getByText("Stock en bodega"));
      expect(await screen.findByText("Hay cambios sin guardar")).toBeTruthy();
      fireEvent.click(screen.getByText("Seguir en esta página"));
      expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
      expect(screen.getByLabelText("Descripcion").value).toBe("Perno");
      expect(cuantas("/api/bodega")).toBe(0);
    });

    it("al salir sin guardar descarta el formulario y abre el otro panel", async () => {
      montar();
      await escribirEnFormulario();
      fireEvent.click(screen.getByText("Stock en bodega"));
      fireEvent.click(await screen.findByText("Salir sin guardar"));
      await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
      expect(screen.queryByLabelText("Descripcion")).toBeNull();
      expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
    });

    it("sin cambios cambia de panel sin preguntar", async () => {
      montar();
      fireEvent.click(await screen.findByText("Añadir/cargar datos"));
      await screen.findByLabelText("Descripcion");
      fireEvent.click(screen.getByText("Stock en bodega"));
      await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
      expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
    });

    it("registra el aviso al cerrar la pestana solo si hay cambios", async () => {
      montar();
      fireEvent.click(await screen.findByText("Añadir/cargar datos"));
      await screen.findByLabelText("Descripcion");
      const limpio = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(limpio);
      expect(limpio.defaultPrevented).toBe(false);
      fireEvent.change(screen.getByLabelText("Descripcion"), { target: { value: "x" } });
      const sucio = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(sucio);
      expect(sucio.defaultPrevented).toBe(true);
    });

    it("tambien avisa si hay contratistas editados sin guardar", async () => {
      montar();
      fireEvent.click(await screen.findByText("Editar contratistas"));
      fireEvent.change(await screen.findByDisplayValue("Ana"), { target: { value: "Bea" } });
      fireEvent.click(screen.getByText("Stock en bodega"));
      expect(await screen.findByText("Hay cambios sin guardar")).toBeTruthy();
      fireEvent.click(screen.getByText("Salir sin guardar"));
      await waitFor(() => expect(cuantas("/api/bodega")).toBe(1));
    });
  });

  it("un error al leer un panel muestra el aviso del servidor", async () => {
    const original = window.fetch;
    window.fetch = vi.fn(async (url, op) =>
      String(url) === "/api/bodega" ? json({ error: "Supabase caido" }, 502) : original(url, op)
    );
    montar();
    fireEvent.click(await screen.findByText("Stock en bodega"));
    expect(await screen.findByText("Supabase caido")).toBeTruthy();
  });
});
