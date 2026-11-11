import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ sesion: { rol: "admin", usuario: "ana" } }));

vi.mock("../src/componentes/Acceso.jsx", () => ({ useSesion: () => estado.sesion }));
vi.mock("../src/lib/eventos.js", () => ({ suscribirEventos: () => () => {} }));

import Personal from "../src/paginas/Personal.jsx";
import Buzon from "../src/componentes/Buzon.jsx";
import { ColoresPlanillaProvider } from "../src/componentes/ColoresPlanilla.jsx";
import { Recorrido } from "../src/componentes/Recorrido.jsx";

function json(datos) {
  return new Response(JSON.stringify(datos), { status: 200, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  estado.sesion = { rol: "admin", usuario: "ana" };
  localStorage.clear();
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const ruta = String(url);
      if (ruta.includes("/api/usuarios")) return json({ usuarios: [{ usuario: "ana", rol: "admin", creado_en: "2026-01-01" }] });
      if (ruta.includes("/api/buzon")) return json({ mensajes: [], novedades: {}, total: 0 });
      return json({});
    })
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function montar(ui, ruta = "/") {
  return render(
    <ColoresPlanillaProvider>
      <MemoryRouter initialEntries={[ruta]}>
        {ui}
        <Recorrido />
      </MemoryRouter>
    </ColoresPlanillaProvider>
  );
}

describe("recorridos de personal y buzón", () => {
  it("abre el recorrido de personal al entrar", async () => {
    montar(<Personal />, "/personal");
    expect(await screen.findByRole("dialog", { name: "Crear usuario" })).toBeTruthy();
  });

  it("abre el recorrido de buzón del administrador en los estados", async () => {
    montar(<Buzon />, "/buzon");
    expect(await screen.findByRole("dialog", { name: "Estados" })).toBeTruthy();
  });

  it("abre el recorrido de buzón del operador en el formulario", async () => {
    estado.sesion = { rol: "operador", usuario: "pedro" };
    montar(<Buzon />, "/buzon");
    expect(await screen.findByRole("dialog", { name: "Nuevo mensaje" })).toBeTruthy();
  });

  it("el botón de ayuda de buzón abre ese recorrido", async () => {
    localStorage.setItem("tutorial-buzon", "1");
    montar(<Buzon />, "/buzon");
    await userEvent.click(await screen.findByRole("button", { name: "Ayuda" }));
    expect(await screen.findByRole("dialog", { name: "Estados" })).toBeTruthy();
  });

  it("no repite el recorrido de personal si ya se completó", async () => {
    localStorage.setItem("tutorial-personal", "1");
    montar(<Personal />, "/personal");
    await new Promise((resolver) => setTimeout(resolver, 30));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("admin ext", () => {
  beforeEach(() => {
    localStorage.setItem("recorridoVisto:personal", "1");
    estado.sesion = { rol: "admin_ext", usuario: "ext", bodega: "M501" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const ruta = String(url);
        if (ruta.includes("/api/usuarios")) return json({ usuarios: [{ usuario: "pepe", rol: "operador", bodega: "M502", creado_en: "2026-01-01" }] });
        return json({ mensajes: [], novedades: {} });
      })
    );
  });

  it("en Personal solo puede crear operadores eligiendo bodega y no ve acciones sobre otros usuarios", async () => {
    montar(<Personal />, "/personal");
    expect(await screen.findByText("pepe")).toBeTruthy();
    expect(screen.getByLabelText("Bodega").tagName).toBe("SELECT");
    expect(screen.queryByText("Eliminar")).toBeNull();
    expect(screen.queryByText("Admin ext")).toBeNull();
  });
});
