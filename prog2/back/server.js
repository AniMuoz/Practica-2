const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/mensaje", (_req, res) => {
  res.json({ texto: "Prueba de proyecto berfre" });
});

app.listen(PORT, () => {
  console.log(`API en http://localhost:${PORT}`);
});
