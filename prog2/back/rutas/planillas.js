const { exportarTabla, stockEnBodega, exportarStockBodega, stockRegional, exportarStockRegional, planillaInventario, exportarPlanillaInventario, planillaMovimientos, exportarMovimientos, agregarCodigoMovimiento, eliminarCodigoMovimiento, editarCodigoMovimiento, stockDetallado, exportarStockDetallado } = require("../fuenteDatos");
const { conColores, nombreConFecha, enviarPlanilla } = require("../compartido");

// Filtros de la tabla principal enviados al descargar una planilla (solo si filtrar=1).
function filtrosDeConsulta(q) {
  if (q.filtrar !== "1") return null;
  return {
    orden: q.orden,
    bodega: q.bodega,
    subUbicacion: q.subUbicacion,
    stockMinimo: q.stockMinimo,
    soloConPrecio: q.precio === "1",
    soloConUbicacion: q.ubicacion === "1",
    soloStockCritico: q.critico === "1",
    soloStockCero: q.stockCero === "1",
    soloInventarioOComentario: q.filtroInventario === "1",
    soloMarcados: q.marcado === "1",
    soloConRombo: q.rombo === "1",
    ignorarNulo: q.ignorarNulo === "1",
    texto: q.q,
  };
}

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
        soloConRombo: req.query.rombo === "1",
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
      const buffer = await exportarStockBodega(conColores(req.query.colores), filtrosDeConsulta(req.query));
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
      const buffer = await exportarStockRegional(conColores(req.query.colores), filtrosDeConsulta(req.query));
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
      const buffer = await exportarPlanillaInventario(conColores(req.query.colores), origen, filtrosDeConsulta(req.query));
      enviarPlanilla(res, buffer, nombreConFecha("PLANILLA DE INVENTARIO M501"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla de inventario." });
    }
  });

  app.get("/api/movimientos", (_req, res) => {
    try {
      res.json(planillaMovimientos());
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo leer la planilla de movimientos." });
    }
  });

  app.post("/api/movimientos/codigo", (req, res) => {
    try {
      res.status(201).json(agregarCodigoMovimiento(req.body && req.body.clave, req.body && req.body.codigo));
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo añadir el código." });
    }
  });

  app.delete("/api/movimientos/codigo", (req, res) => {
    try {
      res.json(eliminarCodigoMovimiento(req.body && req.body.clave, req.body && req.body.codigo));
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo eliminar el código." });
    }
  });

  app.put("/api/movimientos/codigo", (req, res) => {
    try {
      res.json(editarCodigoMovimiento(req.body && req.body.clave, req.body && req.body.codigoAnterior, req.body && req.body.codigoNuevo));
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo editar el código." });
    }
  });

  app.get("/api/movimientos/excel", async (req, res) => {
    try {
      const origen = req.query.inventario === "1" ? "inventario" : req.query.existencia === "1" ? "libre" : "";
      const buffer = await exportarMovimientos(conColores(req.query.colores), origen, filtrosDeConsulta(req.query));
      enviarPlanilla(res, buffer, nombreConFecha("PLANILLA DE MOVIMIENTOS"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar la planilla de movimientos." });
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
      const buffer = await exportarStockDetallado(conColores(req.query.colores), filtrosDeConsulta(req.query));
      enviarPlanilla(res, buffer, nombreConFecha("Prueba_de_stock_detallado"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "No se pudo generar el stock detallado." });
    }
  });
};
