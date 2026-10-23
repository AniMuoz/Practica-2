const { leerContratistas, guardarContratistas } = require("../fuenteDatos");
const { uploadXlsx, conColores, enviarPlanilla } = require("../compartido");
const ventasBd = require("../ventasBd");
const { exigirAdmin } = require("../auth");

module.exports = function rutasVentas(app) {
  function responder(res, error, mensaje) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
  }

  app.post("/api/ventas", (req, res) => {
    uploadXlsx.fields([{ name: "orden", maxCount: 1 }])(req, res, async (errorCarga) => {
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
        const resultado = await ventasBd.anadirVenta({
          ordenBuffer: orden?.buffer,
          contratistaIdx: Number(req.body.contratista),
          movTipo: Number(req.body.movimiento),
          almacen: req.body.almacen,
          codVenta: req.body.codVenta,
          itemsManuales,
          usuario: req.usuario,
        });
        res.status(201).json(resultado);
      } catch (error) {
        responder(res, error, "No se pudo guardar la venta.");
      }
    });
  });

  app.get("/api/ventas/meses", async (_req, res) => {
    try {
      res.json({ meses: await ventasBd.listarMeses() });
    } catch (error) {
      responder(res, error, "No se pudieron leer las planillas.");
    }
  });

  app.get("/api/ventas/planilla", async (req, res) => {
    try {
      res.json(await ventasBd.obtenerPlanilla(req.query.anio, req.query.mes));
    } catch (error) {
      responder(res, error, "No se pudo leer la planilla de ventas.");
    }
  });

  app.get("/api/ventas/descargar", async (req, res) => {
    try {
      const { buffer, nombre } = await ventasBd.exportarPlanilla(req.query.anio, req.query.mes, req.usuario, conColores(req.query.colores), req.query.tipo);
      enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
    } catch (error) {
      responder(res, error, "No se pudo generar la planilla de ventas.");
    }
  });

  app.get("/api/ventas/descargar-anual", async (req, res) => {
    try {
      const { buffer, nombre } = await ventasBd.exportarAnual(req.query.anio, req.usuario, conColores(req.query.colores), req.query.tipo);
      enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
    } catch (error) {
      responder(res, error, "No se pudo generar la planilla anual.");
    }
  });

  app.get("/api/ventas/auditoria", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json({ planillas: await ventasBd.listarPlanillasAuditoria() });
    } catch (error) {
      responder(res, error, "No se pudo leer la auditoría de ventas.");
    }
  });

  app.get("/api/ventas/auditoria/log", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json(await ventasBd.listarLog(req.query || {}));
    } catch (error) {
      responder(res, error, "No se pudo leer el log de ventas.");
    }
  });

  app.get("/api/ventas/auditoria/:id", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json(await ventasBd.leerAuditoria(req.params.id));
    } catch (error) {
      responder(res, error, "No se pudo leer la planilla.");
    }
  });

  app.patch("/api/ventas/filas/:id", async (req, res) => {
    try {
      res.json(await ventasBd.editarFila(req.params.id, req.body, req.usuario));
    } catch (error) {
      responder(res, error, "No se pudo guardar la fila.");
    }
  });

  app.delete("/api/ventas/filas/:id", async (req, res) => {
    try {
      res.json(await ventasBd.quitarFila(req.params.id, req.usuario));
    } catch (error) {
      responder(res, error, "No se pudo quitar la fila.");
    }
  });

  app.delete("/api/ventas/ordenes/:planilla/:lote", async (req, res) => {
    try {
      res.json(await ventasBd.quitarOrden(req.params.planilla, req.params.lote, req.usuario));
    } catch (error) {
      responder(res, error, "No se pudo quitar la orden.");
    }
  });

  app.get("/api/contratistas", (_req, res) => {
    try {
      res.json(leerContratistas());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudieron leer los contratistas." });
    }
  });

  app.put("/api/contratistas", (req, res) => {
    try {
      res.json(guardarContratistas(req.body.clave, req.body.filas));
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudieron guardar los contratistas." });
    }
  });
};
