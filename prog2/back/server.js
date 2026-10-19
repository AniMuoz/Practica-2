const fs = require("fs");
const path = require("path");
const express = require("express");
const { precargarDatos: precargar } = require("./fuenteDatos");
const { supabase } = require("./supabase");
const { protegerApi, rutasAuth, contarUsuarios } = require("./auth");
const { subirImagen, bajarImagen, asegurarCubo } = require("./imagenesSupabase");
const { middlewareCors, cabecerasSeguras, limitarPeticiones, MAX_EVENTOS } = require("./seguridad");
const { carpetaImagenes, clientesEventos, conColores } = require("./compartido");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.disable("x-powered-by");
app.use(cabecerasSeguras);
app.use(middlewareCors());
app.use(express.json({ limit: "1mb" }));
// Comprobacion de vida para Render/Docker: publica, sin sesion y sin tocar Supabase.
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});
if (require.main === module) {
  app.use("/api", limitarPeticiones);
  app.use("/api", protegerApi);
}
rutasAuth(app);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/imagenes/:nombre", async (req, res) => {
  const nombre = path.basename(req.params.nombre);
  if (!nombre || nombre === "." || nombre === "..") {
    res.status(404).end();
    return;
  }
  try {
    const remoto = await bajarImagen(nombre);
    if (remoto) {
      res.type(path.extname(nombre));
      res.send(remoto);
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(error.status || 502).json({ error: error.message });
    return;
  }
  const local = path.join(carpetaImagenes, nombre);
  if (fs.existsSync(local)) {
    res.sendFile(local);
    return;
  }
  res.status(404).end();
});

app.get("/api/eventos", (req, res) => {
  if (clientesEventos.size >= MAX_EVENTOS) {
    res.status(503).json({ error: "Demasiadas conexiones abiertas." });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": conectado\n\n");
  clientesEventos.add(res);
  const pulso = setInterval(() => {
    res.write(": pulso\n\n");
  }, 15000);
  req.on("close", () => {
    clearInterval(pulso);
    clientesEventos.delete(res);
  });
});

function respuestaConexion(error) {
  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    return { status: 502, cuerpo: { conectado: false, error: error.message } };
  }
  return { status: 200, cuerpo: { conectado: true } };
}

app.get("/api/supabase", async (_req, res) => {
  const { error } = await supabase.from("planillas").select("nombre").limit(1);
  const respuesta = respuestaConexion(error);
  res.status(respuesta.status).json(respuesta.cuerpo);
});

// Las rutas se registran por tema, en el mismo orden en que estaban en este archivo.
require("./rutas/planillas")(app);
require("./rutas/reservas")(app);
require("./rutas/ventas")(app);
require("./rutas/bitacora")(app);
require("./rutas/materiales")(app);

process.on("unhandledRejection", (motivo) => {
  console.error("Promesa rechazada sin manejar:", motivo);
});

if (require.main === module) {
  asegurarCubo()
    .then(async () => {
      const archivos = fs.existsSync(carpetaImagenes) ? fs.readdirSync(carpetaImagenes) : [];
      for (const nombre of archivos) {
        const ruta = path.join(carpetaImagenes, nombre);
        if (!fs.statSync(ruta).isFile()) continue;
        if (!/\.(png|jpe?g|webp|gif)$/i.test(nombre)) continue;
        await subirImagen(nombre, fs.readFileSync(ruta), undefined);
      }
    })
    .catch((error) => {
      console.error(error.message);
    })
    .finally(async () => {
      precargar();
      try {
        if ((await contarUsuarios()) === 0) {
          console.warn("No hay usuarios: nadie podrá iniciar sesión. Crea uno con: node crearUsuario.js <usuario> <contraseña>");
        }
      } catch (error) {
        console.warn(error.message);
      }
      const servidor = app.listen(PORT, "0.0.0.0", () => {
        console.log(`API en http://localhost:${PORT}`);
      });
      // Render envia SIGTERM al redesplegar: se cierran las conexiones SSE y se termina limpio.
      let cerrando = false;
      const cerrar = (senal) => {
        if (cerrando) return;
        cerrando = true;
        console.log(`${senal} recibido, cerrando el servidor.`);
        for (const cliente of clientesEventos) cliente.end();
        servidor.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 10000).unref();
      };
      process.on("SIGTERM", () => cerrar("SIGTERM"));
      process.on("SIGINT", () => cerrar("SIGINT"));
    });
}

module.exports = { app, conColores, respuestaConexion };
