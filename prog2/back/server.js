const express = require("express");
const cors = require("cors");
const { leerTabla, buscarMaterial } = require("./fuenteDatos");

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

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
