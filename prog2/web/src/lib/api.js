// Cliente HTTP unico del frontend: centraliza cabeceras JSON, lectura de la respuesta y mensajes de error.
// Tambien avisa si la sesion caduco o la cuenta quedo desactivada (sin parchear window.fetch).

import { bodegaPrincipal } from "./bodega.js";

async function leerJson(res) {
  return res.json().catch(() => ({}));
}

function urlDe(input) {
  return String(typeof input === "string" ? input : input?.url || "");
}

async function avisarSesion(input, respuesta) {
  if (typeof window === "undefined") return;
  if (respuesta.status === 403) {
    const data = await respuesta.clone().json().catch(() => ({}));
    if (data && data.desactivada) window.dispatchEvent(new Event("cuenta-desactivada"));
  }
  if (respuesta.status === 401) {
    if (!/\/api\/(login|logout|sesion)/.test(urlDe(input))) {
      window.dispatchEvent(new Event("sesion-vencida"));
    }
  }
}

/** fetch de la API con avisos de sesion; usar en lugar de window.fetch para /api. */
export async function apiFetch(input, init) {
  const bodega = bodegaPrincipal();
  if (bodega !== "M501" && /^\/api\//.test(urlDe(input))) {
    const cabeceras = new Headers(init?.headers);
    cabeceras.set("X-Bodega", bodega);
    init = { ...init, headers: cabeceras };
  }
  const respuesta = await fetch(input, init);
  await avisarSesion(input, respuesta);
  return respuesta;
}

// Devuelve el JSON de la respuesta o lanza Error con el mensaje del servidor (o `mensajeError`).
async function pedirJson(url, opciones = {}, mensajeError = "No se pudo completar la operación.") {
  const res = await apiFetch(url, opciones);
  const data = await leerJson(res);
  if (!res.ok) {
    const error = new Error(data.error || mensajeError);
    error.status = res.status;
    throw error;
  }
  return data;
}

export function obtenerJson(url, mensajeError) {
  return pedirJson(url, { cache: "no-store" }, mensajeError);
}

export function enviarJson(url, cuerpo, mensajeError, metodo = "POST") {
  return pedirJson(
    url,
    { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) },
    mensajeError
  );
}

export function enviarFormulario(url, formulario, mensajeError, metodo = "POST") {
  return pedirJson(url, { method: metodo, body: formulario }, mensajeError);
}

// Dispara en el navegador la descarga de un Blob con el nombre indicado.
export function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

// Descarga un archivo (Excel, etc.) como Blob; los errores del servidor llegan como JSON.
export async function descargarBlob(url, opciones = {}, mensajeError = "No se pudo descargar.") {
  const res = await apiFetch(url, opciones);
  if (!res.ok) {
    const data = await leerJson(res);
    throw new Error(data.error || mensajeError);
  }
  return res.blob();
}
