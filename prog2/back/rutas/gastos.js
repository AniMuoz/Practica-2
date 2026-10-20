const { uploadXlsx, enviarPlanilla } = require("../compartido");
const gastos = require("../gastos");
const { exigirAdmin } = require("../auth");

module.exports = function rutasGastos(app) {
  function responder(res, error, mensaje) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
  }

  app.get("/api/gastos/topicos", (_req, res) => {
    res.json({ topicos: gastos.TOPICOS });
  });

  app.post("/api/gastos/procesar", async (req, res) => {
    try {
      await exigirAdmin(req);
      const mes = String((req.body && req.body.mes) || "").trim();
      const buffer = await gastos.armarDetalle(req.body && req.body.gastos, mes);
      const nombre = `Detalle_gastos_pretorianos_${mes}_${gastos.nombreDia()}.xlsx`;
      enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
    } catch (error) {
      responder(res, error, "No se pudo generar la planilla de gastos.");
    }
  });

  app.post("/api/gastos/guardar", async (req, res) => {
    try {
      await exigirAdmin(req);
      const buffer = await gastos.guardarDatos(req.body && req.body.gastos);
      const nombre = `Datos_guardados_no_procesados_${gastos.nombreDia()}.xlsx`;
      enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
    } catch (error) {
      responder(res, error, "No se pudieron guardar los datos.");
    }
  });

  app.post("/api/gastos/recuperar", (req, res) => {
    uploadXlsx.single("archivo")(req, res, async (errorCarga) => {
      if (errorCarga) {
        res.status(400).json({ error: errorCarga.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Falta el archivo." });
        return;
      }
      try {
        await exigirAdmin(req);
        res.json({ gastos: await gastos.recuperarDatos(req.file.buffer) });
      } catch (error) {
        responder(res, error, "No se pudo recuperar el archivo.");
      }
    });
  });
};
