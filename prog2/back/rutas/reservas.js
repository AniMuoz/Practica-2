const { revisarReserva, exportarRevisionReserva, buscarReservas, exportarRevisionPorReserva } = require("../fuenteDatos");
const { uploadPdf, conColores, enviarPlanilla } = require("../compartido");

module.exports = function rutasReservas(app) {
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
      console.error(error);
      res.status(500).json({ error: "No se pudieron leer las reservas." });
    }
  });

  app.get("/api/reservas/excel", async (req, res) => {
    try {
      const buffer = await exportarRevisionPorReserva(req.query.reserva, conColores(req.query.colores));
      enviarPlanilla(res, buffer, "attachment; filename=Revision%20stock%20en%20reserva.xlsx");
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudo generar la revisión de reserva." });
    }
  });

  app.post("/api/reserva", (req, res) => {
    recibirReserva(req, res, async () => {
      try {
        res.json(await revisarReserva(req.file.buffer));
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "No se pudo leer la reserva." });
      }
    });
  });

  app.post("/api/reserva/excel", (req, res) => {
    recibirReserva(req, res, async () => {
      try {
        const buffer = await exportarRevisionReserva(req.file.buffer, conColores(req.body.colores));
        enviarPlanilla(res, buffer, "attachment; filename=Revision%20stock%20en%20reserva.xlsx");
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "No se pudo generar la revisión de reserva." });
      }
    });
  });
};
