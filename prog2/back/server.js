const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { leerTabla, buscarMaterial, actualizarMaterial, actualizarDatos, guardarImagen, exportarTabla, agregarMaterial } = require("./fuenteDatos");

const carpetaImagenes = path.join(__dirname, "imagenes");
fs.mkdirSync(carpetaImagenes, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: carpetaImagenes,
    filename: (req, file, cb) => {
      const campo = req.body.campo === "QR" ? "qr" : "rombo";
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

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use("/api/imagenes", express.static(carpetaImagenes));

app.get("/api/mensaje", (_req, res) => {
  res.json({ texto: "Prueba de proyecto berfre" });
});

app.get("/api/tabla/excel", async (_req, res) => {
  try {
    const buffer = await exportarTabla();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=inventario.xlsx");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: "No se pudo generar la planilla." });
  }
});

app.get("/api/tabla", (_req, res) => {
  try {
    res.json(leerTabla());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer la tabla." });
  }
});

app.post("/api/material", (req, res) => {
  try {
    const resultado = agregarMaterial(req.body.clave, req.body.datos);
    res.status(201).json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo agregar el material." });
  }
});

app.get("/api/material/:codigo", (req, res) => {
  try {
    const { columnas, fila } = buscarMaterial(req.params.codigo);
    if (!fila) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    res.json({ columnas, fila });
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer el material." });
  }
});

app.put("/api/material/:codigo", (req, res) => {
  try {
    const resultado = actualizarMaterial(req.params.codigo, {
      inventario: req.body.inventario,
      comentario: req.body.comentario,
    });
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo guardar." });
  }
});

app.put("/api/material/:codigo/datos", (req, res) => {
  try {
    const resultado = actualizarDatos(
      req.params.codigo,
      req.body.clave,
      req.body.datos,
      req.body.reemplazar === true
    );
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo guardar." });
  }
});

app.delete("/api/material/:codigo/imagen", (req, res) => {
  try {
    const resultado = guardarImagen(req.params.codigo, req.body.campo, "", req.body.clave);
    if (!resultado) {
      res.status(404).json({ error: "Material no encontrado." });
      return;
    }
    res.json(resultado);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "No se pudo quitar la imagen." });
  }
});

app.post("/api/material/:codigo/imagen", (req, res) => {
  upload.single("archivo")(req, res, (errorCarga) => {
    if (errorCarga) {
      res.status(400).json({ error: errorCarga.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Falta la imagen." });
      return;
    }
    try {
      const resultado = guardarImagen(req.params.codigo, req.body.campo, req.file.filename, req.body.clave);
      if (!resultado) {
        res.status(404).json({ error: "Material no encontrado." });
        return;
      }
      res.json(resultado);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "No se pudo guardar la imagen." });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
