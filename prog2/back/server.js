const express = require("express");
const cors = require("cors");
const { leerTabla, buscarMaterial, actualizarMaterial } = require("./fuenteDatos");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/mensaje", (_req, res) => {
  res.json({ texto: "Prueba de proyecto berfre" });
});

app.get("/api/tabla", (_req, res) => {
  try {
    res.json(leerTabla());
  } catch (error) {
    res.status(500).json({ error: "No se pudo leer la tabla." });
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

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
