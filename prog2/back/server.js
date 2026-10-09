const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { leerTabla, buscarMaterial, marcarMaterial, buscarMateriales, actualizarMaterial, limpiarInventarioComentarios, claveCorrecta, actualizarDatos, guardarImagen, exportarTabla, agregarMaterial, eliminarMaterial, importarPlanilla, importarSap, importarPrecios, importarUbicaciones, importarDosColumnas, stockEnBodega, exportarStockBodega, stockRegional, exportarStockRegional, planillaInventario, planillaInventarioPorBodega, exportarPlanillaInventario, exportarInventarioBodega, stockDetallado, exportarStockDetallado, revisarReserva, exportarRevisionReserva, leerContratistas, guardarContratistas, añadirVenta, importarReservas, buscarReservas, exportarRevisionPorReserva, leerUltimasCargas, registrarCarga, precargarDatos } = require("./fuenteDatos");
const { supabase } = require("./supabase");
const bitacora = require("./bitacora");
const { subirImagen, bajarImagen, quitarImagen, asegurarCubo } = require("./imagenesSupabase");

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

const uploadFirma = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png") cb(null, true);
    else cb(new Error("La imagen de la firma debe ser un archivo PNG."));
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
const PORT = Number(process.env.PORT) || 3001;

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
app.get("/api/imagenes/:nombre", async (req, res) => {
  const nombre = path.basename(req.params.nombre);
  if (!nombre || nombre === "." || nombre === "..") {
    res.status(404).end();
    return;
  }
  try {
    const remoto = await bajarImagen(nombre);
    if (remoto) {
      res.type(path.extname(nombre));
      res.send(remoto);
      return;
    }
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message });
    return;
  }
  const local = path.join(carpetaImagenes, nombre);
  if (fs.existsSync(local)) {
    res.sendFile(local);
    return;
  }
  res.status(404).end();
});

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

function respuestaConexion(error) {
  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    return { status: 502, cuerpo: { conectado: false, error: error.message } };
  }
  return { status: 200, cuerpo: { conectado: true } };
}

app.get("/api/supabase", async (_req, res) => {
  const { error } = await supabase.from("planillas").select("nombre").limit(1);
  const respuesta = respuestaConexion(error);
  res.status(respuesta.status).json(respuesta.cuerpo);
});

app.get("/api/tabla/excel", async (req, res) => {
  try {
    const buffer = await exportarTabla(conColores(req.query.colores), {
      orden: req.query.orden,
      bodega: req.query.bodega,
      subUbicacion: req.query.subUbicacion,
      stockMinimo: req.query.stockMinimo,
      soloConPrecio: req.query.precio === "1",
      soloConUbicacion: req.query.ubicacion === "1",
      soloStockCritico: req.query.critico === "1",
      soloInventarioOComentario: req.query.inventario === "1",
      soloMarcados: req.query.marcado === "1",
      ignorarNulo: req.query.ignorarNulo === "1",
      texto: req.query.q,
    });
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
    const origen = req.query.inventario === "1" ? "inventario" : req.query.existencia === "1" ? "libre" : "";
    const buffer = await exportarPlanillaInventario(conColores(req.query.colores), origen);
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
    const origen = req.query.inventario === "1" ? "inventario" : req.query.existencia === "1" ? "libre" : "";
    const buffer = await exportarInventarioBodega(codigo, conColores(req.query.colores), origen);
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

app.get("/api/reservas", (req, res) => {
  try {
    res.json(buscarReservas(req.query.reserva, req.query.pagina, req.query.tamano));
  } catch (error) {
    res.status(500).json({ error: "No se pudieron leer las reservas." });
  }
});

app.get("/api/reservas/excel", async (req, res) => {
  try {
    const buffer = await exportarRevisionPorReserva(req.query.reserva, conColores(req.query.colores));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Revision%20stock%20en%20reserva.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo generar la revisión de reserva." });
  }
});

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
    const modo = req.body.modo || "orden";
    const orden = req.files?.orden?.[0];
    let itemsManuales = null;
    if (modo === "manual") {
      try {
        itemsManuales = JSON.parse(req.body.items || "[]");
      } catch {
        res.status(400).json({ error: "La lista de productos no es válida." });
        return;
      }
    } else if (!orden) {
      res.status(400).json({ error: "Falta el archivo." });
      return;
    }
    try {
      const ventas = req.files?.ventas?.[0];
      const { buffer, nombre } = await añadirVenta({
        ordenBuffer: orden?.buffer,
        ventasBuffer: ventas?.buffer,
        contratistaIdx: Number(req.body.contratista),
        movTipo: Number(req.body.movimiento),
        almacen: req.body.almacen,
        codVenta: req.body.codVenta,
        colores: conColores(req.body.colores),
        itemsManuales,
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(nombre)}`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo generar la planilla de ventas." });
    }
  });
});

app.get("/api/contratistas", (_req, res) => {
  try {
    res.json(leerContratistas());
  } catch (error) {
    res.status(500).json({ error: "No se pudieron leer los contratistas." });
  }
});

app.put("/api/contratistas", (req, res) => {
  try {
    res.json(guardarContratistas(req.body.clave, req.body.filas));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudieron guardar los contratistas." });
  }
});

function responderBitacora(res, error, mensaje) {
  res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
}

app.post("/api/bitacora/folios", async (req, res) => {
  try {
    res.status(201).json(await bitacora.crearFolio(req.body && req.body.clave));
  } catch (error) {
    responderBitacora(res, error, "No se pudo generar el folio.");
  }
});

app.get("/api/bitacora/folios/ultimo", async (_req, res) => {
  try {
    res.json(await bitacora.ultimoFolio());
  } catch (error) {
    responderBitacora(res, error, "No se pudo leer el último folio.");
  }
});

app.get("/api/bitacora/folios/:folio/excel", async (req, res) => {
  try {
    const { buffer, nombre } = await bitacora.exportarFolio(req.params.folio);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(nombre)}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    responderBitacora(res, error, "No se pudo generar la planilla del folio.");
  }
});

app.get("/api/bitacora/folios/:folio", async (req, res) => {
  try {
    res.json(await bitacora.leerFolio(req.params.folio));
  } catch (error) {
    responderBitacora(res, error, "No se pudo leer el folio.");
  }
});

app.delete("/api/bitacora/folios/:folio", async (req, res) => {
  try {
    res.json(await bitacora.eliminarFolio(req.body && req.body.clave, req.params.folio, req.body && req.body.confirmacion));
  } catch (error) {
    responderBitacora(res, error, "No se pudo eliminar el folio.");
  }
});

app.put("/api/bitacora/folios/:folio/filas/:fila", async (req, res) => {
  try {
    res.json(await bitacora.guardarFila(req.body && req.body.clave, req.params.folio, req.params.fila, req.body && req.body.datos));
  } catch (error) {
    responderBitacora(res, error, "No se pudo guardar la fila.");
  }
});

app.post("/api/bitacora/folios/:folio/filas/:fila/firma", (req, res) => {
  uploadFirma.single("archivo")(req, res, async (errorCarga) => {
    if (errorCarga) {
      const demasiado = errorCarga.code === "LIMIT_FILE_SIZE";
      res.status(400).json({ error: demasiado ? "La imagen de la firma pesa más de 1 MB." : errorCarga.message });
      return;
    }
    try {
      res.json(await bitacora.subirFirma(req.body && req.body.clave, req.params.folio, req.params.fila, req.file && req.file.buffer));
    } catch (error) {
      responderBitacora(res, error, "No se pudo guardar la imagen de la firma.");
    }
  });
});

app.delete("/api/bitacora/folios/:folio/filas/:fila", async (req, res) => {
  try {
    res.json(await bitacora.quitarFila(req.body && req.body.clave, req.params.folio, req.params.fila));
  } catch (error) {
    responderBitacora(res, error, "No se pudo quitar la fila.");
  }
});

app.get("/api/tabla/ultimas-cargas", (_req, res) => {
  try {
    res.json({ cargas: leerUltimasCargas() });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudieron leer las últimas cargas." });
  }
});

app.get("/api/tabla", (_req, res) => {
  try {
    res.json(leerTabla());
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo leer la tabla." });
  }
});

app.post("/api/tabla/excel", async (req, res) => {
  uploadPlanilla.single("archivo")(req, res, async (errorCarga) => {
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
      else if (modo === "reservas") resultado = importarReservas(req.body.clave, req.file.buffer);
      else {
        res.status(400).json({ error: "Ese formato de planilla todavía no está definido." });
        return;
      }
      await registrarCarga(modo, req.body.columna);
      emitir({ tipo: "recarga" });
      res.json(resultado);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "No se pudo importar la planilla." });
    }
  });
});

app.delete("/api/material/:codigo", async (req, res) => {
  try {
    const resultado = await eliminarMaterial(req.params.codigo, req.body.clave);
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    emitir({ tipo: "recarga" });
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo eliminar el material." });
  }
});

app.post("/api/material", async (req, res) => {
  try {
    const resultado = await agregarMaterial(req.body.clave, req.body.datos);
    if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo agregar el material." });
  }
});

app.get("/api/buscar", (req, res) => {
  try {
    res.json({ resultados: buscarMateriales(req.query.q) });
  } catch (error) {
    res.status(500).json({ error: "No se pudo buscar el material." });
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

app.post("/api/acceso", (req, res) => {
  if (!claveCorrecta(req.body && req.body.clave)) {
    res.status(403).json({ error: "Contraseña incorrecta." });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/tabla/limpiar-inventario", async (req, res) => {
  try {
    const tabla = await limpiarInventarioComentarios(req.body.clave);
    emitir({ tipo: "recarga" });
    res.json(tabla);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo limpiar inventario y comentarios." });
  }
});

app.put("/api/material/:codigo/marcado", async (req, res) => {
  try {
    const resultado = await marcarMaterial(req.params.codigo, req.body.marcado === true);
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    emitir({ tipo: "fila", fila: resultado.fila });
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo marcar el material." });
  }
});

app.put("/api/material/:codigo", async (req, res) => {
  try {
    const resultado = await actualizarMaterial(req.params.codigo, {
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

app.put("/api/material/:codigo/datos", async (req, res) => {
  try {
    const resultado = await actualizarDatos(
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

app.delete("/api/material/:codigo/imagen", async (req, res) => {
  try {
    const resultado = await guardarImagen(req.params.codigo, req.body.campo, "", req.body.clave);
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
  upload.single("archivo")(req, res, async (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta la imagen." });
      return;
    }
    try {
      await subirImagen(req.file.filename, fs.readFileSync(req.file.path), req.file.mimetype);
      const resultado = await guardarImagen(req.params.codigo, req.body.campo, req.file.filename, req.body.clave);
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

if (require.main === module) {
  asegurarCubo()
    .then(async () => {
      const archivos = fs.existsSync(carpetaImagenes) ? fs.readdirSync(carpetaImagenes) : [];
      for (const nombre of archivos) {
        const ruta = path.join(carpetaImagenes, nombre);
        if (!fs.statSync(ruta).isFile()) continue;
        if (!/\.(png|jpe?g|webp|gif)$/i.test(nombre)) continue;
        await subirImagen(nombre, fs.readFileSync(ruta), undefined);
      }
    })
    .catch((error) => {
      console.error(error.message);
    })
    .finally(() => {
      precargarDatos();
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`API en http://localhost:${PORT}`);
      });
    });
}

module.exports = { app, conColores, respuestaConexion };
