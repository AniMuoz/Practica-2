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

const upload = multer({
  storage: multer.diskStorage({
    destination: carpetaImagenes,
    filename: (req, file, cb) => {
      const nombres = { QR: "qr", Foto: "foto", Rombo: "rombo" };
      const campo = nombres[req.body.campo] || "rombo";
      const codigo = String(req.params.codigo).replace(/[^\w.-]/g, "_");
      const extension = path.extname(file.originalname).toLowerCase() || ".png";
      cb(null, `${codigo}-${campo}${extension}`);
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
  conColores,
  nombreConFecha,
  enviarPlanilla,
  clientesEventos,
  emitir,
};
