const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { leerTabla, buscarMaterial, actualizarMaterial, limpiarInventarioComentarios, actualizarDatos, guardarImagen, exportarTabla, agregarMaterial, importarPlanilla, importarSap, importarPrecios, importarUbicaciones, importarDosColumnas, stockEnBodega, exportarStockBodega, stockRegional, exportarStockRegional, planillaInventario, planillaInventarioPorBodega, exportarPlanillaInventario, exportarInventarioBodega, stockDetallado, exportarStockDetallado, revisarReserva, exportarRevisionReserva, leerContratistas, guardarContratistas, añadirVenta } = require("./fuenteDatos");

const carpetaImagenes = path.join(__dirname, "imagenes");
fs.mkdirSync(carpetaImagenes, { recursive: true });

const uploadPlanilla = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const nombre = file.originalname.toLowerCase();
    if (nombre.endsWith(".xlsx")) cb(null, true);
    else cb(new Error("Solo se aceptan archivos .xlsx."));
  },
});

const uploadVenta = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".xlsx")) cb(null, true);
    else cb(new Error("Solo se aceptan archivos .xlsx."));
  },
});

const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".pdf")) cb(null, true);
    else cb(new Error("Solo se aceptan archivos PDF."));
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

const app = express();
const PORT = 3001;

const clientesEventos = new Set();

function emitir(evento) {
  const mensaje = `data: ${JSON.stringify(evento)}\n\n`;
  for (const cliente of clientesEventos) {
    cliente.write(mensaje);
  }
}

app.use(cors());
app.use(express.json());
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api/imagenes", express.static(carpetaImagenes));

app.get("/api/eventos", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": conectado\n\n");
  clientesEventos.add(res);
  const pulso = setInterval(() => {
    res.write(": pulso\n\n");
  }, 15000);
  req.on("close", () => {
    clearInterval(pulso);
    clientesEventos.delete(res);
  });
});

app.get("/api/mensaje", (_req, res) => {
  res.json({ texto: "Prueba de proyecto berfre" });
});

app.get("/api/tabla/excel", async (req, res) => {
  try {
    const buffer = await exportarTabla(conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=inventario.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar la planilla." });
  }
});

app.get("/api/bodega", (_req, res) => {
  try {
    res.json(stockEnBodega());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el stock de bodega." });
  }
});

app.get("/api/bodega/excel", async (req, res) => {
  try {
    const buffer = await exportarStockBodega(conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=PLANILLA%20M501.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar la planilla de bodega." });
  }
});

app.get("/api/regional", (_req, res) => {
  try {
    res.json(stockRegional());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el stock regional." });
  }
});

app.get("/api/regional/excel", async (req, res) => {
  try {
    const buffer = await exportarStockRegional(conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=PLANILLA%20STOCK%20REGIONAL.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar la planilla regional." });
  }
});

app.get("/api/inventario", (_req, res) => {
  try {
    res.json(planillaInventario());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer la planilla de inventario." });
  }
});

app.get("/api/inventario/excel", async (req, res) => {
  try {
    const buffer = await exportarPlanillaInventario(conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=PLANILLA%20DE%20INVENTARIO%20M501.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar la planilla de inventario." });
  }
});

app.get("/api/inventario-bodega", (_req, res) => {
  try {
    const { bodegas } = planillaInventarioPorBodega();
    res.json({ bodegas });
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el inventario por bodega." });
  }
});

app.get("/api/inventario-bodega/excel", async (req, res) => {
  try {
    const codigo = String(req.query.bodega ?? "").trim();
    const buffer = await exportarInventarioBodega(codigo, conColores(req.query.colores));
    const nombre = `PLANILLA DE INVENTARIO ${codigo}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(nombre)}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo generar la planilla de la bodega." });
  }
});

app.get("/api/stock-detallado", (_req, res) => {
  try {
    res.json(stockDetallado());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el stock detallado." });
  }
});

app.get("/api/stock-detallado/excel", async (req, res) => {
  try {
    const buffer = await exportarStockDetallado(conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Prueba_de_stock_detallado.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar el stock detallado." });
  }
});

function recibirReserva(req, res, siguiente) {
  uploadPdf.single("archivo")(req, res, (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta el PDF de la reserva." });
      return;
    }
    siguiente();
  });
}

app.post("/api/reserva", (req, res) => {
  recibirReserva(req, res, async () => {
    try {
      res.json(await revisarReserva(req.file.buffer));
    } catch (error) {
      res.status(500).json({ error: "No se pudo leer la reserva." });
    }
  });
});

app.post("/api/reserva/excel", (req, res) => {
  recibirReserva(req, res, async () => {
    try {
      const buffer = await exportarRevisionReserva(req.file.buffer, conColores(req.body.colores));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Revision%20stock%20en%20reserva.xlsx");
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ error: "No se pudo generar la revisión de reserva." });
    }
  });
});

app.post("/api/ventas", (req, res) => {
  uploadVenta.fields([
    { name: "orden", maxCount: 1 },
    { name: "ventas", maxCount: 1 },
  ])(req, res, async (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    const orden = req.files?.orden?.[0];
    if (!orden) {
      res.status(400).json({ error: "Falta el archivo de orden de venta." });
      return;
    }
    try {
      const ventas = req.files?.ventas?.[0];
      const { buffer, nombre } = await añadirVenta({
        ordenBuffer: orden.buffer,
        ventasBuffer: ventas?.buffer,
        contratistaIdx: Number(req.body.contratista),
        movTipo: Number(req.body.movimiento),
        codVenta: req.body.codVenta,
        colores: conColores(req.body.colores),
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(nombre)}`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ error: "No se pudo generar la planilla de ventas." });
    }
  });
});

app.get("/api/contratistas", (_req, res) => {
  try {
    res.json(leerContratistas());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer los contratistas." });
  }
});

app.put("/api/contratistas", (req, res) => {
  try {
    res.json(guardarContratistas(req.body.clave, req.body.filas));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo guardar los contratistas." });
  }
});

app.get("/api/tabla", (_req, res) => {
  try {
    res.json(leerTabla());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer la tabla." });
  }
});

app.post("/api/tabla/excel", (req, res) => {
  uploadPlanilla.single("archivo")(req, res, (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo .xlsx." });
      return;
    }
    try {
      const modo = req.body.modo || "completa";
      let resultado;
      if (modo === "completa") resultado = importarPlanilla(req.body.clave, req.file.buffer);
      else if (modo === "sap") resultado = importarSap(req.body.clave, req.file.buffer);
      else if (modo === "precios") resultado = importarPrecios(req.body.clave, req.file.buffer);
      else if (modo === "ubicaciones") resultado = importarUbicaciones(req.body.clave, req.file.buffer);
      else if (modo === "dos-columnas") resultado = importarDosColumnas(req.body.clave, req.file.buffer, req.body.columna);
      else {
        res.status(400).json({ error: "Ese formato de planilla todavía no está definido." });
        return;
      }
      emitir({ tipo: "recarga" });
      res.json(resultado);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "No se pudo importar la planilla." });
    }
  });
});

app.post("/api/material", (req, res) => {
  try {
    const resultado = agregarMaterial(req.body.clave, req.body.datos);
    if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo agregar el material." });
  }
});

app.get("/api/material/:codigo", (req, res) => {
  try {
    const { columnas, fila, bodegas } = buscarMaterial(req.params.codigo);
    if (!fila) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    res.json({ columnas, fila, bodegas });
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el material." });
  }
});

app.post("/api/tabla/limpiar-inventario", (req, res) => {
  try {
    const tabla = limpiarInventarioComentarios(req.body.clave);
    emitir({ tipo: "recarga" });
    res.json(tabla);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo limpiar inventario y comentarios." });
  }
});

app.put("/api/material/:codigo", (req, res) => {
  try {
    const resultado = actualizarMaterial(req.params.codigo, {
      inventario: req.body.inventario,
      comentario: req.body.comentario,
    });
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    emitir({ tipo: "fila", fila: resultado.fila });
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo guardar." });
  }
});

app.put("/api/material/:codigo/datos", (req, res) => {
  try {
    const resultado = actualizarDatos(
      req.params.codigo,
      req.body.clave,
      req.body.datos,
      req.body.reemplazar === true
    );
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    emitir({
      tipo: "fila",
      fila: resultado.fila,
      codigoAnterior: String(req.params.codigo),
    });
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo guardar." });
  }
});

app.delete("/api/material/:codigo/imagen", (req, res) => {
  try {
    const resultado = guardarImagen(req.params.codigo, req.body.campo, "", req.body.clave);
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo quitar la imagen." });
  }
});

app.post("/api/material/:codigo/imagen", (req, res) => {
  upload.single("archivo")(req, res, (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta la imagen." });
      return;
    }
    try {
      const resultado = guardarImagen(req.params.codigo, req.body.campo, req.file.filename, req.body.clave);
      if (!resultado) {
        res.status(404).json({ error: "Material no encontrado." });
        return;
      }
      if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
      res.json(resultado);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "No se pudo guardar la imagen." });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
