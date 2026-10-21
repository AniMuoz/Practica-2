const { uploadFirma, enviarPlanilla } = require("../compartido");
const bitacora = require("../bitacora");
const { exigirAdmin } = require("../auth");

module.exports = function rutasBitacora(app) {
  function responderBitacora(res, error, mensaje) {
    res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
  }

  app.get("/api/bitacora/auditoria", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json({ folios: await bitacora.listarAuditoria() });
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo leer la auditoría.");
    }
  });

  app.get("/api/bitacora/auditoria/log", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json(await bitacora.listarLog(req.query || {}));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo leer el log.");
    }
  });

  app.get("/api/bitacora/auditoria/:folio", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json(await bitacora.leerAuditoria(req.params.folio));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo leer el folio.");
    }
  });

  app.post("/api/bitacora/folios", async (req, res) => {
    try {
      res.status(201).json(await bitacora.crearFolio(req.body && req.body.clave, req.usuario));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo generar el folio.");
    }
  });

  app.get("/api/bitacora/folios/ultimo", async (_req, res) => {
    try {
      res.json(await bitacora.ultimoFolio());
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo leer el último folio.");
    }
  });

  app.get("/api/bitacora/folios/:folio/excel", async (req, res) => {
    try {
      const { buffer, nombre } = await bitacora.exportarFolio(req.params.folio, req.usuario);
      enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo generar la planilla del folio.");
    }
  });

  app.get("/api/bitacora/folios/:folio", async (req, res) => {
    try {
      res.json(await bitacora.leerFolio(req.params.folio));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo leer el folio.");
    }
  });

  app.delete("/api/bitacora/folios/:folio", async (req, res) => {
    try {
      res.json(await bitacora.eliminarFolio(req.body && req.body.clave, req.params.folio, req.body && req.body.confirmacion, req.usuario));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo eliminar el folio.");
    }
  });

  app.put("/api/bitacora/folios/:folio/filas/:fila", async (req, res) => {
    try {
      res.json(await bitacora.guardarFila(req.body && req.body.clave, req.params.folio, req.params.fila, req.body && req.body.datos, req.usuario));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo guardar la fila.");
    }
  });

  app.post("/api/bitacora/folios/:folio/filas/:fila/firma", (req, res) => {
    uploadFirma.single("archivo")(req, res, async (errorCarga) => {
      if (errorCarga) {
        const demasiado = errorCarga.code === "LIMIT_FILE_SIZE";
        res.status(400).json({ error: demasiado ? "La imagen de la firma pesa más de 100 KB." : errorCarga.message });
        return;
      }
      try {
        res.json(await bitacora.subirFirma(req.body && req.body.clave, req.params.folio, req.params.fila, req.file && req.file.buffer, req.body && req.body.rut, req.usuario));
      } catch (error) {
        console.error(error);
        responderBitacora(res, error, "No se pudo guardar la imagen de la firma.");
      }
    });
  });

  app.delete("/api/bitacora/folios/:folio/filas/:fila/firma", async (req, res) => {
    try {
      res.json(await bitacora.quitarFirma(req.body && req.body.clave, req.params.folio, req.params.fila, req.body && req.body.motivo, req.usuario));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo quitar la firma.");
    }
  });

  app.delete("/api/bitacora/folios/:folio/filas/:fila", async (req, res) => {
    try {
      res.json(await bitacora.quitarFila(req.body && req.body.clave, req.params.folio, req.params.fila, req.usuario));
    } catch (error) {
      console.error(error);
      responderBitacora(res, error, "No se pudo quitar la fila.");
    }
  });
};
