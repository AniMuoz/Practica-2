const { exigirAdminVer, responderError } = require("../seguridad/auth");
const { activosDe } = require("../servicios/presencia");

module.exports = function rutasPresencia(app) {
  app.get("/api/presencia", async (req, res) => {
    try {
      await exigirAdminVer(req);
      res.json({ usuarios: activosDe(req.bodegaActiva) });
    } catch (error) {
      responderError(res, error, "No se pudo leer la presencia.");
    }
  });
};
