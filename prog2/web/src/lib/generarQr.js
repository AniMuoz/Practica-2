import QRCode from "qrcode";
import jsQR from "jsqr";

export const URL_BASE_QR = "https://inventariom501.proyectobodegam501.workers.dev/";
export const MAX_BYTES_QR = 100 * 1024;

export function urlQr(codigo, base = URL_BASE_QR) {
  return `${base}${codigo}`;
}

export function sinQr(filas) {
  return filas.filter((fila) => String(fila.QR ?? "").trim() === "");
}

const EXT_IMAGEN = /\.(png|jpe?g|webp|gif)$/i;

export function tieneRombo(fila) {
  return EXT_IMAGEN.test(String(fila?.Rombo ?? "").trim());
}

// Marca corta del rombo; el servidor la guarda en el nombre del QR (-r<marca>).
export function marcaRombo(rombo) {
  return String(rombo ?? "").trim().replace(EXT_IMAGEN, "").replace(/[^\w]/g, "").slice(-24);
}

// "sin_qr" | "desactualizado" (rombo añadido, cambiado o quitado) | "ok"
export function estadoQr(fila) {
  const qr = String(fila?.QR ?? "").trim();
  if (qr === "") return "sin_qr";
  const marcaQr = /-r(\w+)\.[a-z]+$/i.exec(qr)?.[1] ?? "";
  const marca = tieneRombo(fila) ? marcaRombo(fila.Rombo) : "";
  return marcaQr === marca ? "ok" : "desactualizado";
}

export function qrDesactualizados(filas) {
  return filas.filter((fila) => estadoQr(fila) === "desactualizado");
}

// Compara el texto leído del PNG con la URL esperada (base + código).
export function evaluarLecturaQr(codigo, leido, base = URL_BASE_QR) {
  const esperado = urlQr(codigo, base);
  const texto = String(leido ?? "").trim();
  if (!texto) return { estado: "ilegible", esperado, leido: "" };
  if (texto === esperado) return { estado: "ok", esperado, leido: texto };
  return { estado: "url_incorrecta", esperado, leido: texto };
}

export function resumenRevisionQr(resultados) {
  const conteo = { ok: 0, url_incorrecta: 0, ilegible: 0, sin_imagen: 0, sin_qr: 0 };
  for (const r of resultados) conteo[r.estado] = (conteo[r.estado] || 0) + 1;
  return conteo;
}

function cargarImagen(url, mensaje = "No se pudo cargar la imagen.") {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(mensaje));
    img.src = url;
  });
}

export async function decodificarQrDesdeUrl(url) {
  const img = await cargarImagen(url, "No se pudo cargar el QR.");
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? "";
}

export async function revisarFilaQr(fila, { base = URL_BASE_QR, urlImagen = (nombre) => `/api/imagenes/${encodeURIComponent(nombre)}` } = {}) {
  const codigo = String(fila?.Codigo ?? "").trim();
  const archivo = String(fila?.QR ?? "").trim();
  const esperado = urlQr(codigo, base);
  if (!archivo) return { codigo, archivo: "", estado: "sin_qr", esperado, leido: "" };
  try {
    const leido = await decodificarQrDesdeUrl(urlImagen(archivo));
    return { codigo, archivo, ...evaluarLecturaQr(codigo, leido, base) };
  } catch {
    return { codigo, archivo, estado: "sin_imagen", esperado, leido: "" };
  }
}

function aBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG."))), "image/png")
  );
}

// QR con el codigo impreso abajo, igual que programa_5. Reduce el tamano si supera 100 KB.
// Si se indica `rombo` (nombre de archivo), se dibuja al centro del QR.
export async function crearQrPng(codigo, base = URL_BASE_QR, rombo = "") {
  let ancho = 400;
  let blob;
  const imagenRombo = rombo ? await cargarImagen(`/api/imagenes/${rombo}`) : null;
  for (let intento = 0; intento < 4; intento++) {
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, urlQr(codigo, base), { width: ancho, margin: 4, errorCorrectionLevel: imagenRombo ? "H" : "M" });
    if (imagenRombo) {
      const c = canvas.getContext("2d");
      const lado = Math.round(canvas.width * 0.28);
      const razon = Math.min(lado / imagenRombo.width, lado / imagenRombo.height);
      const w = Math.round(imagenRombo.width * razon);
      const h = Math.round(imagenRombo.height * razon);
      const x = Math.round((canvas.width - w) / 2);
      const y = Math.round((canvas.height - h) / 2);
      c.fillStyle = "white";
      c.fillRect(x - 4, y - 4, w + 8, h + 8);
      c.drawImage(imagenRombo, x, y, w, h);
    }
    const extra = Math.round(ancho * 0.1);
    const final = document.createElement("canvas");
    final.width = canvas.width;
    final.height = canvas.height + extra;
    const ctx = final.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, final.width, final.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(extra * 0.7)}px Arial`;
    ctx.fillText(String(codigo), final.width / 2, canvas.height + extra / 2 - 2);
    blob = await aBlob(final);
    if (blob.size <= MAX_BYTES_QR) return blob;
    ancho = Math.round(ancho * 0.75);
  }
  return blob;
}
