const { supabase } = require("../supabase/supabase");
const { exigirAdmin, buscarUsuario } = require("../seguridad/auth");
const { emitir } = require("../utils/compartido");
const { bodegaActual } = require("../servicios/nucleoDatos");

const URGENCIAS = ["leve", "media", "alta", "urgente"];
const ESTADOS = ["sin revisar", "revisando", "cerrado"];
const CAMPOS = "id, creado_en, usuario, titulo, descripcion, urgencia, estado, bodega";
const MAX_DESC = 200;

// Consulta base de mensajes de la bodega activa: toda lectura de admin pasa por aqui.
function mensajesDeBodega(columnas, opciones) {
  return supabase.from("buzon").select(columnas, opciones).eq("bodega", bodegaActual());
}

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

  // Historial del propio usuario (sus mensajes, sin filtrar por bodega activa:
  // un operador solo escribe en su bodega asignada).
  app.get("/api/buzon/mios", async (req, res) => {
    try {
      const { data, error } = await supabase.from("buzon").select(CAMPOS).eq("usuario", req.usuario).order("creado_en", { ascending: false });
      if (error) throw error;
      res.json({ mensajes: data });
    } catch (error) {
      responder(res, error, "No se pudo leer el historial.");
    }
  });

  // Cantidad de mensajes sin revisar de la bodega activa (solo admin).
  app.get("/api/buzon/pendientes", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { count, error } = await mensajesDeBodega("id", { count: "exact", head: true }).eq("estado", "sin revisar");
      if (error) throw error;
      res.json({ pendientes: count || 0 });
    } catch (error) {
      responder(res, error, "No se pudo leer el buzón.");
    }
  });

  // Novedades de respuestas para el usuario que llama:
  //   - Operador → id de la última respuesta de admin en CADA uno de sus mensajes.
  //   - Admin → solo mensajes de la bodega activa; además el estado del mensaje
  //     para pintar badges en las tabs.
  app.get("/api/buzon/novedades", async (req, res) => {
    try {
      const registro = await buscarUsuario(req.usuario);
      const esAdmin = registro && registro.rol === "admin";

      if (esAdmin) {
        const { data, error } = await supabase
          .from("buzon_respuestas")
          .select("id, buzon_id, buzon:buzon_id!inner(estado, bodega)")
          .eq("es_admin", false)
          .eq("buzon.bodega", bodegaActual())
          .order("id", { ascending: false });
        if (error) throw error;

        const porMensaje = {};
        for (const r of data || []) {
          if (!porMensaje[r.buzon_id]) {
            porMensaje[r.buzon_id] = { ultimaId: r.id, estado: r.buzon?.estado ?? null };
          }
        }
        res.json({ novedades: porMensaje });
      } else {
        const { data: msgs, error: errMsgs } = await supabase
          .from("buzon")
          .select("id")
          .eq("usuario", req.usuario);
        if (errMsgs) throw errMsgs;

        const ids = (msgs || []).map((m) => m.id);
        if (ids.length === 0) return res.json({ novedades: {} });

        const { data, error } = await supabase
          .from("buzon_respuestas")
          .select("id, buzon_id")
          .eq("es_admin", true)
          .in("buzon_id", ids)
          .order("id", { ascending: false });
        if (error) throw error;

        const porMensaje = {};
        for (const r of data || []) {
          if (!porMensaje[r.buzon_id]) porMensaje[r.buzon_id] = r.id;
        }
        res.json({ novedades: porMensaje });
      }
    } catch (error) {
      responder(res, error, "No se pudieron leer las novedades.");
    }
  });

  // Todos los mensajes de la bodega activa (solo admin).
  app.get("/api/buzon", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { data, error } = await mensajesDeBodega(CAMPOS)
        .order("creado_en", { ascending: false });
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
      // Operador: middleware fuerza su bodega asignada. Admin: usa la bodega activa de la barra.
      const bodega = bodegaActual();
      const { data, error } = await supabase
        .from("buzon")
        .insert({ usuario: req.usuario, titulo, descripcion, urgencia, bodega })
        .select(CAMPOS)
        .single();
      if (error) throw error;
      emitir({ tipo: "buzon", bodega });
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
      const { data, error } = await supabase
        .from("buzon")
        .update({ estado })
        .eq("id", req.params.id)
        .eq("bodega", bodegaActual())
        .select(CAMPOS)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw errorHttp(404, "Mensaje no encontrado.");
      emitir({ tipo: "buzon", bodega: data.bodega });
      res.json({ mensaje: data });
    } catch (error) {
      responder(res, error, "No se pudo cambiar el estado.");
    }
  });

  app.delete("/api/buzon/:id", async (req, res) => {
    try {
      await exigirAdmin(req);
      const { data, error } = await mensajesDeBodega("estado, bodega").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!data) throw errorHttp(404, "Mensaje no encontrado.");
      if (data.estado !== "cerrado") throw errorHttp(400, "Solo se pueden eliminar mensajes cerrados.");
      const borrado = await supabase.from("buzon").delete().eq("id", req.params.id).eq("bodega", bodegaActual());
      if (borrado.error) throw borrado.error;
      emitir({ tipo: "buzon", bodega: data.bodega });
      res.json({ ok: true });
    } catch (error) {
      responder(res, error, "No se pudo eliminar el mensaje.");
    }
  });

  // ── Conversación (respuestas) ────────────────────────────────────────────────

  // Admin: solo mensajes de la bodega activa. Operador: solo los suyos.
  app.get("/api/buzon/:id/respuestas", async (req, res) => {
    try {
      const id = req.params.id;
      const registro = await buscarUsuario(req.usuario);
      const esAdmin = registro && registro.rol === "admin";

      const { data: msg, error: errMsg } = await supabase
        .from("buzon")
        .select("usuario, bodega")
        .eq("id", id)
        .maybeSingle();
      if (errMsg) throw errMsg;
      if (!msg) throw errorHttp(404, "Mensaje no encontrado.");
      if (esAdmin) {
        if (msg.bodega !== bodegaActual()) throw errorHttp(404, "Mensaje no encontrado.");
      } else if (msg.usuario !== req.usuario) {
        throw errorHttp(403, "No tienes permiso para ver este mensaje.");
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

  // Admin responde solo en su bodega activa; operador solo en los suyos.
  app.post("/api/buzon/:id/respuestas", async (req, res) => {
    try {
      const id = req.params.id;
      const texto = String((req.body && req.body.texto) || "").trim();
      if (!texto || texto.length > MAX_DESC) throw errorHttp(400, `La respuesta es obligatoria (máximo ${MAX_DESC} caracteres).`);

      const registro = await buscarUsuario(req.usuario);
      const esAdmin = registro && registro.rol === "admin";

      const { data: msg, error: errMsg } = await supabase
        .from("buzon")
        .select("usuario, estado, bodega")
        .eq("id", id)
        .maybeSingle();
      if (errMsg) throw errMsg;
      if (!msg) throw errorHttp(404, "Mensaje no encontrado.");
      if (esAdmin) {
        if (msg.bodega !== bodegaActual()) throw errorHttp(404, "Mensaje no encontrado.");
      } else if (msg.usuario !== req.usuario) {
        throw errorHttp(403, "No tienes permiso para responder este mensaje.");
      }
      if (msg.estado === "cerrado") throw errorHttp(400, "No se puede responder a un mensaje cerrado.");

      const { data, error } = await supabase
        .from("buzon_respuestas")
        .insert({ buzon_id: id, autor: req.usuario, es_admin: esAdmin, texto })
        .select("id, creado_en, autor, es_admin, texto")
        .single();
      if (error) throw error;

      if (esAdmin && msg.estado === "sin revisar") {
        await supabase.from("buzon").update({ estado: "revisando" }).eq("id", id);
      }

      emitir({ tipo: "buzon", bodega: msg.bodega });
      res.status(201).json({ respuesta: data });
    } catch (error) {
      responder(res, error, "No se pudo enviar la respuesta.");
    }
  });
};
