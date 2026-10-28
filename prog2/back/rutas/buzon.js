const { supabase } = require("../supabase");
const { exigirAdmin, buscarUsuario } = require("../auth");

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const ESTADOS = ["sin revisar", "revisando", "cerrado"];
const CAMPOS = "id, creado_en, usuario, titulo, descripcion, urgencia, estado";
const MAX_DESC = 200;

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

  // Cantidad de mensajes sin revisar (solo admin).
  app.get("/api/buzon/pendientes", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { count, error } = await supabase.from("buzon").select("id", { count: "exact", head: true }).eq("estado", "sin revisar");
      if (error) throw error;
      res.json({ pendientes: count || 0 });
    } catch (error) {
      responder(res, error, "No se pudo leer el buzón.");
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
      if (!descripcion || descripcion.length > MAX_DESC) throw errorHttp(400, `La descripción es obligatoria (máximo ${MAX_DESC} caracteres).`);
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

  // ── Conversación (respuestas) ────────────────────────────────────────────────

  // Leer respuestas de un mensaje.
  // Admin: puede leer cualquier mensaje. Operador: solo sus propios mensajes.
  app.get("/api/buzon/:id/respuestas", async (req, res) => {
    try {
      const id = req.params.id;
      const registro = await buscarUsuario(req.usuario);
      const esAdmin = registro && registro.rol === "admin";

      if (!esAdmin) {
        // Verificar que el mensaje pertenece al usuario.
        const { data: msg, error: errMsg } = await supabase.from("buzon").select("usuario").eq("id", id).maybeSingle();
        if (errMsg) throw errMsg;
        if (!msg) throw errorHttp(404, "Mensaje no encontrado.");
        if (msg.usuario !== req.usuario) throw errorHttp(403, "No tienes permiso para ver este mensaje.");
      }

      const { data, error } = await supabase
        .from("buzon_respuestas")
        .select("id, creado_en, autor, es_admin, texto")
        .eq("buzon_id", id)
        .order("creado_en", { ascending: true });
      if (error) throw error;
      res.json({ respuestas: data });
    } catch (error) {
      responder(res, error, "No se pudo leer las respuestas.");
    }
  });

  // Agregar respuesta a un mensaje.
  // Admin puede responder cualquier mensaje; operador solo los suyos.
  app.post("/api/buzon/:id/respuestas", async (req, res) => {
    try {
      const id = req.params.id;
      const texto = String((req.body && req.body.texto) || "").trim();
      if (!texto || texto.length > MAX_DESC) throw errorHttp(400, `La respuesta es obligatoria (máximo ${MAX_DESC} caracteres).`);

      const registro = await buscarUsuario(req.usuario);
      const esAdmin = registro && registro.rol === "admin";

      // Verificar existencia y permisos.
      const { data: msg, error: errMsg } = await supabase.from("buzon").select("usuario, estado").eq("id", id).maybeSingle();
      if (errMsg) throw errMsg;
      if (!msg) throw errorHttp(404, "Mensaje no encontrado.");
      if (!esAdmin && msg.usuario !== req.usuario) throw errorHttp(403, "No tienes permiso para responder este mensaje.");
      if (msg.estado === "cerrado") throw errorHttp(400, "No se puede responder a un mensaje cerrado.");

      const { data, error } = await supabase
        .from("buzon_respuestas")
        .insert({ buzon_id: id, autor: req.usuario, es_admin: esAdmin, texto })
        .select("id, creado_en, autor, es_admin, texto")
        .single();
      if (error) throw error;

      // Si el admin responde por primera vez, pasar automáticamente a "revisando".
      if (esAdmin && msg.estado === "sin revisar") {
        await supabase.from("buzon").update({ estado: "revisando" }).eq("id", id);
      }

      res.status(201).json({ respuesta: data });
    } catch (error) {
      responder(res, error, "No se pudo enviar la respuesta.");
    }
  });
};
