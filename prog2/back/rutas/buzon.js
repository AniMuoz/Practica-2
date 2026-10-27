const { supabase } = require("../supabase");
const { exigirAdmin } = require("../auth");

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const ESTADOS = ["sin revisar", "revisando", "cerrado"];
const CAMPOS = "id, creado_en, usuario, titulo, descripcion, urgencia, estado";

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

module.exports = function rutasBuzon(app) {
  function responder(res, error, mensaje) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : mensaje });
  }

  // Historial del propio usuario.
  app.get("/api/buzon/mios", async (req, res) => {
    try {
      const { data, error } = await supabase.from("buzon").select(CAMPOS).eq("usuario", req.usuario).order("creado_en", { ascending: false });
      if (error) throw error;
      res.json({ mensajes: data });
    } catch (error) {
      responder(res, error, "No se pudo leer el historial.");
    }
  });

  // Todos los mensajes (solo admin).
  app.get("/api/buzon", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { data, error } = await supabase.from("buzon").select(CAMPOS).order("creado_en", { ascending: false });
      if (error) throw error;
      res.json({ mensajes: data });
    } catch (error) {
      responder(res, error, "No se pudo leer el buzón.");
    }
  });

  app.post("/api/buzon", async (req, res) => {
    try {
      const cuerpo = req.body || {};
      const titulo = String(cuerpo.titulo || "").trim();
      const descripcion = String(cuerpo.descripcion || "").trim();
      const urgencia = String(cuerpo.urgencia || "").trim().toLowerCase();
      if (!titulo || titulo.length > 120) throw errorHttp(400, "El título es obligatorio (máximo 120 caracteres).");
      if (!descripcion || descripcion.length > 2000) throw errorHttp(400, "La descripción es obligatoria (máximo 2000 caracteres).");
      if (!URGENCIAS.includes(urgencia)) throw errorHttp(400, "Nivel de urgencia no válido.");
      const { data, error } = await supabase.from("buzon").insert({ usuario: req.usuario, titulo, descripcion, urgencia }).select(CAMPOS).single();
      if (error) throw error;
      res.status(201).json({ mensaje: data });
    } catch (error) {
      responder(res, error, "No se pudo enviar el mensaje.");
    }
  });

  app.put("/api/buzon/:id/estado", async (req, res) => {
    try {
      await exigirAdmin(req);
      const estado = String((req.body && req.body.estado) || "");
      if (!ESTADOS.includes(estado)) throw errorHttp(400, "Estado no válido.");
      const { data, error } = await supabase.from("buzon").update({ estado }).eq("id", req.params.id).select(CAMPOS).maybeSingle();
      if (error) throw error;
      if (!data) throw errorHttp(404, "Mensaje no encontrado.");
      res.json({ mensaje: data });
    } catch (error) {
      responder(res, error, "No se pudo cambiar el estado.");
    }
  });

  app.delete("/api/buzon/:id", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { data, error } = await supabase.from("buzon").select("estado").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) throw errorHttp(404, "Mensaje no encontrado.");
      if (data.estado !== "cerrado") throw errorHttp(400, "Solo se pueden eliminar mensajes cerrados.");
      const borrado = await supabase.from("buzon").delete().eq("id", req.params.id);
      if (borrado.error) throw borrado.error;
      res.json({ ok: true });
    } catch (error) {
      responder(res, error, "No se pudo eliminar el mensaje.");
    }
  });
};
