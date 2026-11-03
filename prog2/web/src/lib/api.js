// Cliente HTTP unico del frontend: centraliza cabeceras JSON, lectura de la respuesta y mensajes de error.

async function leerJson(res) {
  return res.json().catch(() => ({}));
}

// Devuelve el JSON de la respuesta o lanza Error con el mensaje del servidor (o `mensajeError`).
async function pedirJson(url, opciones = {}, mensajeError = "No se pudo completar la operación.") {
  const res = await fetch(url, opciones);
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
  const res = await fetch(url, opciones);
  if (!res.ok) {
    const data = await leerJson(res);
    throw new Error(data.error || mensajeError);
  }
  return res.blob();
}
