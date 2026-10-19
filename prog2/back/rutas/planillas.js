const { exportarTabla, stockEnBodega, exportarStockBodega, stockRegional, exportarStockRegional, planillaInventario, planillaInventarioPorBodega, exportarPlanillaInventario, exportarInventarioBodega, stockDetallado, exportarStockDetallado } = require("../fuenteDatos");
const { conColores, nombreConFecha, enviarPlanilla } = require("../compartido");

module.exports = function rutasPlanillas(app) {
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
        soloStockCero: req.query.stockCero === "1",
        soloInventarioOComentario: req.query.inventario === "1",
        soloMarcados: req.query.marcado === "1",
        ignorarNulo: req.query.ignorarNulo === "1",
        texto: req.query.q,
      });
      const personalizado = String(req.query.nombre ?? "").replace(/[\\/:*?"<>|]/g, "").trim();
      enviarPlanilla(
        res,
        buffer,
        personalizado
          ? `attachment; filename=${encodeURIComponent(`${personalizado}.xlsx`)}`
          : nombreConFecha("INVENTARIO")
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla." });
    }
  });

  app.get("/api/bodega", (_req, res) => {
    try {
      res.json(stockEnBodega());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer el stock de bodega." });
    }
  });

  app.get("/api/bodega/excel", async (req, res) => {
    try {
      const buffer = await exportarStockBodega(conColores(req.query.colores));
      enviarPlanilla(res, buffer, nombreConFecha("PLANILLA M501"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla de bodega." });
    }
  });

  app.get("/api/regional", (_req, res) => {
    try {
      res.json(stockRegional());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer el stock regional." });
    }
  });

  app.get("/api/regional/excel", async (req, res) => {
    try {
      const buffer = await exportarStockRegional(conColores(req.query.colores));
      enviarPlanilla(res, buffer, nombreConFecha("PLANILLA STOCK REGIONAL"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla regional." });
    }
  });

  app.get("/api/inventario", (_req, res) => {
    try {
      res.json(planillaInventario());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer la planilla de inventario." });
    }
  });

  app.get("/api/inventario/excel", async (req, res) => {
    try {
      const origen = req.query.inventario === "1" ? "inventario" : req.query.existencia === "1" ? "libre" : "";
      const buffer = await exportarPlanillaInventario(conColores(req.query.colores), origen);
      enviarPlanilla(res, buffer, nombreConFecha("PLANILLA DE INVENTARIO M501"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla de inventario." });
    }
  });

  app.get("/api/inventario-bodega", (_req, res) => {
    try {
      const { bodegas } = planillaInventarioPorBodega();
      res.json({ bodegas });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer el inventario por bodega." });
    }
  });

  app.get("/api/inventario-bodega/excel", async (req, res) => {
    try {
      const codigo = String(req.query.bodega ?? "").trim();
      const origen = req.query.inventario === "1" ? "inventario" : req.query.existencia === "1" ? "libre" : "";
      const buffer = await exportarInventarioBodega(codigo, conColores(req.query.colores), origen);
      enviarPlanilla(res, buffer, nombreConFecha(`PLANILLA DE INVENTARIO ${codigo}`));
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudo generar la planilla de la bodega." });
    }
  });

  app.get("/api/stock-detallado", (_req, res) => {
    try {
      res.json(stockDetallado());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer el stock detallado." });
    }
  });

  app.get("/api/stock-detallado/excel", async (req, res) => {
    try {
      const buffer = await exportarStockDetallado(conColores(req.query.colores));
      enviarPlanilla(res, buffer, nombreConFecha("Prueba_de_stock_detallado"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar el stock detallado." });
    }
  });
};
