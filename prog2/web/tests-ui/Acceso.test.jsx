import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respuesta = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status });

let fetchFalso;
let Acceso;

beforeEach(async () => {
  vi.resetModules();
  fetchFalso = vi.fn();
  // Acceso.jsx guarda window.fetch al importarse, asi que el falso debe estar antes del import.
  window.fetch = fetchFalso;
  Acceso = (await import("../src/Acceso.jsx")).default;
});

afterEach(() => cleanup());

describe("Acceso", () => {
  it("muestra el formulario cuando /api/sesion responde 401", async () => {
    fetchFalso.mockResolvedValue(respuesta(401, { error: "Sesion no iniciada." }));
    render(<Acceso>contenido privado</Acceso>);
    expect(await screen.findByRole("heading", { name: /iniciar sesi/i })).toBeTruthy();
    expect(screen.queryByText("contenido privado")).toBeNull();
  });

  it("muestra el contenido cuando ya hay sesion", async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { usuario: "ana", rol: "admin" }));
    render(<Acceso>contenido privado</Acceso>);
    expect(await screen.findByText("contenido privado")).toBeTruthy();
  });

  it("inicia sesion con credenciales correctas", async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta(401, {}))
      .mockResolvedValueOnce(respuesta(200, { usuario: "ana", rol: "operador" }));
    render(<Acceso>contenido privado</Acceso>);
    const usuario = await screen.findByPlaceholderText("Usuario");
    await userEvent.type(usuario, "ana");
    await userEvent.type(screen.getByPlaceholderText("Contraseña"), "clave-segura-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("contenido privado")).toBeTruthy();
    const [url, opciones] = fetchFalso.mock.calls[1];
    expect(url).toBe("/api/login");
    expect(JSON.parse(opciones.body)).toEqual({ usuario: "ana", clave: "clave-segura-1" });
  });

  it("muestra el error del servidor si el login falla", async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta(401, {}))
      .mockResolvedValueOnce(respuesta(401, { error: "Usuario o contraseña incorrectos." }));
    render(<Acceso>contenido privado</Acceso>);
    await userEvent.type(await screen.findByPlaceholderText("Usuario"), "ana");
    await userEvent.type(screen.getByPlaceholderText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(screen.getByText("Usuario o contraseña incorrectos.")).toBeTruthy());
    expect(screen.queryByText("contenido privado")).toBeNull();
  });

  it("deshabilita Entrar mientras falten usuario o clave", async () => {
    fetchFalso.mockResolvedValue(respuesta(401, {}));
    render(<Acceso>x</Acceso>);
    const boton = await screen.findByRole("button", { name: "Entrar" });
    expect(boton.disabled).toBe(true);
  });
});
