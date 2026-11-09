const crypto = require("crypto");
const fs = require("fs");
const { leerTabla, buscarMaterial, marcarMaterial, buscarMateriales, actualizarMaterial, limpiarInventarioComentarios, claveCorrecta, actualizarDatos, guardarImagen, agregarMaterial, eliminarMaterial, importarPlanilla, importarSap, importarPrecios, importarUbicaciones, importarDosColumnas, importarReservas, importarMovimientos, leerUltimasCargas, registrarCarga } = require("../servicios/fuenteDatos");
const { claveDe, bodegaActual } = require("../servicios/nucleoDatos");

// Inventario y comentario solo existen en M501.
function soloM501(res) {
  if (bodegaActual() === "M501") return false;
  res.status(400).json({ error: "Inventario y comentario solo se editan en la bodega M501." });
  return true;
}
const { uploadXlsx, upload, emitir, esImagenReal, esHeicReal, convertirHeicAJpeg } = require("../utils/compartido");
const { subirImagen } = require("../supabase/imagenesSupabase");
const { exigirAdmin } = require("../seguridad/auth");

module.exports = function rutasMateriales(app) {
  // Una sola importación masiva a la vez: evita que dos cargas se pisen en Supabase.
  let importacionEnCurso = false;

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
      if (importacionEnCurso) {
        res.status(409).json({ error: "Ya hay una carga en curso. Espera a que termine e inténtalo de nuevo." });
        return;
      }
      importacionEnCurso = true;
      try {
        const modo = req.body.modo || "completa";
        const clave = claveDe(req);
        let resultado;
        if (modo === "completa") resultado = await importarPlanilla(clave, req.file.buffer);
        else if (modo === "sap") resultado = await importarSap(clave, req.file.buffer);
        else if (modo === "precios") resultado = await importarPrecios(clave, req.file.buffer);
        else if (modo === "ubicaciones") resultado = await importarUbicaciones(clave, req.file.buffer);
        else if (modo === "dos-columnas") resultado = await importarDosColumnas(clave, req.file.buffer, req.body.columna);
        else if (modo === "reservas") resultado = await importarReservas(clave, req.file.buffer);
        else if (modo === "movimientos") resultado = await importarMovimientos(clave, req.file.buffer);
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
      } finally {
        importacionEnCurso = false;
      }
    });
  });

  app.delete("/api/material/:codigo", async (req, res) => {
    try {
      const resultado = await eliminarMaterial(req.params.codigo, claveDe(req));
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
      const resultado = await agregarMaterial(claveDe(req), req.body.datos);
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

  // El admin con sesión abierta no digita la clave: el servidor la aplica solo en memoria (claveDe).
  app.get("/api/acceso", async (req, res) => {
    try {
      await exigirAdmin(req);
      res.json({ ok: true });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo verificar el acceso." });
    }
  });

  app.post("/api/acceso", (req, res) => {
    try {
      if (!claveCorrecta(req.body && req.body.clave)) {
        res.status(403).json({ error: "Contraseña incorrecta." });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo verificar la clave." });
    }
  });

  app.post("/api/tabla/limpiar-inventario", async (req, res) => {
    if (soloM501(res)) return;
    try {
      const tabla = await limpiarInventarioComentarios(claveDe(req));
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
    if (soloM501(res)) return;
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
        claveDe(req),
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
      const resultado = await guardarImagen(req.params.codigo, req.body.campo, "", claveDe(req));
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
        let contenido = await fs.promises.readFile(req.file.path);
        let mimetype = req.file.mimetype;
        if (esHeicReal(contenido)) {
          try {
            contenido = await convertirHeicAJpeg(contenido);
          } catch {
            await fs.promises.unlink(req.file.path).catch(() => {});
            res.status(400).json({ error: "No se pudo convertir la imagen HEIC." });
            return;
          }
          await fs.promises.writeFile(req.file.path, contenido);
          mimetype = "image/jpeg";
        }
        if (!esImagenReal(contenido)) {
          await fs.promises.unlink(req.file.path).catch(() => {});
          res.status(400).json({ error: "El archivo no es una imagen válida." });
          return;
        }
        await subirImagen(req.file.filename, contenido, mimetype);
        const resultado = await guardarImagen(req.params.codigo, req.body.campo, req.file.filename, claveDe(req));
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
