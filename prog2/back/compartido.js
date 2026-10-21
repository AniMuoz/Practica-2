const fs = require("fs");
const path = require("path");
const multer = require("multer");

const carpetaImagenes = path.join(__dirname, "imagenes");
fs.mkdirSync(carpetaImagenes, { recursive: true });

function subidaEnMemoria(extension, mensaje, limite = 15 * 1024 * 1024) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limite },
    fileFilter: (_req, file, cb) => {
      if (file.originalname.toLowerCase().endsWith(extension)) cb(null, true);
      else cb(new Error(mensaje));
    },
  });
}

const uploadXlsx = subidaEnMemoria(".xlsx", "Solo se aceptan archivos .xlsx.");
const uploadPdf = subidaEnMemoria(".pdf", "Solo se aceptan archivos PDF.");

const uploadFirma = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") cb(null, true);
    else cb(new Error("La imagen de la firma debe ser un archivo PNG o JPG."));
  },
});

// La extension sale del tipo declarado, no del nombre del archivo que manda el cliente.
const EXTENSION_POR_TIPO = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };

// Comprueba los primeros bytes: el mimetype lo declara el cliente y se puede falsear.
function esImagenReal(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const inicio = (...bytes) => bytes.every((byte, i) => buffer[i] === byte);
  return (
    inicio(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) ||
    inicio(0xff, 0xd8, 0xff) ||
    buffer.toString("ascii", 0, 3) === "GIF" ||
    (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")
  );
}

const upload = multer({
  storage: multer.diskStorage({
    destination: carpetaImagenes,
    filename: (req, file, cb) => {
      const nombres = { QR: "qr", Foto: "foto", Rombo: "rombo" };
      const campo = nombres[req.body.campo] || "rombo";
      const codigo = String(req.params.codigo).replace(/[^\w.-]/g, "_");
      const extension = EXTENSION_POR_TIPO[file.mimetype] || ".png";
      // El rombo lleva marca de tiempo para que cambiarlo cambie siempre su nombre.
      // El QR lleva la marca del rombo que incrusta (rombo_usado) para detectar QR desactualizados.
      let sufijo = "";
      if (req.body.campo === "Rombo") sufijo = `-${Date.now().toString(36)}`;
      else if (req.body.campo === "QR" && req.body.rombo_usado) {
        sufijo = `-r${String(req.body.rombo_usado).replace(/[^\w]/g, "").slice(-24)}`;
      }
      cb(null, `${codigo}-${campo}${sufijo}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes PNG, JPG, WEBP o GIF."));
  },
});

function conColores(valor) {
  return valor !== "0";
}

function fechaArchivo() {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, "0");
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${dia}-${mes}-${hoy.getFullYear()}`;
}

function nombreConFecha(nombre) {
  return `attachment; filename=${encodeURIComponent(`${nombre} ${fechaArchivo()}.xlsx`)}`;
}

function enviarPlanilla(res, buffer, disposition) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", disposition);
  res.send(Buffer.from(buffer));
}

// Clientes conectados a /api/eventos (SSE) y difusion de cambios a todos ellos.
const clientesEventos = new Set();

function emitir(evento) {
  const mensaje = `data: ${JSON.stringify(evento)}\n\n`;
  for (const cliente of clientesEventos) {
    cliente.write(mensaje);
  }
}

module.exports = {
  carpetaImagenes,
  uploadXlsx,
  uploadPdf,
  uploadFirma,
  upload,
  esImagenReal,
  conColores,
  nombreConFecha,
  enviarPlanilla,
  clientesEventos,
  emitir,
};
