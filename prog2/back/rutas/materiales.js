const crypto = require("crypto");
const fs = require("fs");
const { leerTabla, buscarMaterial, marcarMaterial, buscarMateriales, actualizarMaterial, limpiarInventarioComentarios, claveCorrecta, actualizarDatos, guardarImagen, agregarMaterial, eliminarMaterial, importarPlanilla, importarSap, importarPrecios, importarUbicaciones, importarDosColumnas, importarReservas, leerUltimasCargas, registrarCarga } = require("../fuenteDatos");
const { uploadXlsx, upload, emitir } = require("../compartido");
const { subirImagen } = require("../imagenesSupabase");
const { exigirAdmin } = require("../auth");
const { CLAVE_DATOS } = require("../nucleoDatos");

module.exports = function rutasMateriales(app) {
  app.get("/api/tabla/ultimas-cargas", (_req, res) => {
    try {
      res.json({ cargas: leerUltimasCargas() });
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudieron leer las últimas cargas." });
    }
  });

  app.get("/api/tabla", (req, res) => {
    try {
      const tabla = leerTabla();
      const cuerpo = JSON.stringify(tabla);
      const etag = `W/"${crypto.createHash("sha1").update(cuerpo).digest("base64url")}"`;
      res.set("ETag", etag);
      // Se compara a mano: el sondeo del navegador manda Cache-Control y Express no lo trata como fresco.
      if (req.get("If-None-Match") === etag) {
        res.status(304).end();
        return;
      }
      res.type("json").send(cuerpo);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudo leer la tabla." });
    }
  });

  app.post("/api/tabla/excel", async (req, res) => {
    uploadXlsx.single("archivo")(req, res, async (errorCarga) => {
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
        console.error(error);
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
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudo eliminar el material." });
    }
  });

  app.post("/api/material", async (req, res) => {
    try {
      const resultado = await agregarMaterial(req.body.clave, req.body.datos);
      if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
      res.status(201).json(resultado);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({ error: error.message || "No se pudo agregar el material." });
    }
  });

  app.get("/api/buscar", (req, res) => {
    try {
      res.json({ resultados: buscarMateriales(req.query.q) });
    } catch (error) {
      console.error(error);
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
      console.error(error);
      res.status(500).json({ error: "No se pudo leer el material." });
    }
  });

  // El admin con sesión abierta no digita la clave de operación: el servidor se la entrega.
  app.get("/api/acceso", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json({ ok: true, clave: CLAVE_DATOS });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo verificar el acceso." });
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
      console.error(error);
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
      console.error(error);
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
      console.error(error);
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
      console.error(error);
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
      console.error(error);
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
        if (req.body.campo === "QR") await exigirAdmin(req);
        await subirImagen(req.file.filename, await fs.promises.readFile(req.file.path), req.file.mimetype);
        const resultado = await guardarImagen(req.params.codigo, req.body.campo, req.file.filename, req.body.clave);
        if (!resultado) {
          res.status(404).json({ error: "Material no encontrado." });
          return;
        }
        if (resultado?.fila) emitir({ tipo: "fila", fila: resultado.fila });
        res.json(resultado);
      } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ error: error.message || "No se pudo guardar la imagen." });
      }
    });
  });
};
