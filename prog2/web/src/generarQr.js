import QRCode from "qrcode";

export const URL_BASE_QR = "https://inventariom501.proyectobodegam501.workers.dev/";
export const MAX_BYTES_QR = 100 * 1024;

export function urlQr(codigo, base = URL_BASE_QR) {
  return `${base}${codigo}`;
}

export function sinQr(filas) {
  return filas.filter((fila) => String(fila.QR ?? "").trim() === "");
}

function aBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG."))), "image/png")
  );
}

// QR con el codigo impreso abajo, igual que programa_5. Reduce el tamano si supera 100 KB.
export async function crearQrPng(codigo, base = URL_BASE_QR) {
  let ancho = 400;
  let blob;
  for (let intento = 0; intento < 4; intento++) {
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, urlQr(codigo, base), { width: ancho, margin: 4, errorCorrectionLevel: "M" });
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
