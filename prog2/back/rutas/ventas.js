const { leerContratistas, guardarContratistas, añadirVenta } = require("../fuenteDatos");
const { uploadXlsx, conColores, enviarPlanilla } = require("../compartido");

module.exports = function rutasVentas(app) {
  app.post("/api/ventas", (req, res) => {
    uploadXlsx.fields([
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
        enviarPlanilla(res, buffer, `attachment; filename=${encodeURIComponent(nombre)}`);
      } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo generar la planilla de ventas." });
      }
    });
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
