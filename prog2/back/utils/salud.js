// Comprobacion de vida que SI toca Supabase: la usa un cron para que el proyecto gratuito no se pause
// por inactividad. Es publica, asi que el resultado se reutiliza unos segundos y no devuelve datos.
const CACHE_MS = 60 * 1000;
let ultimo = { hora: 0, resultado: null };

async function comprobarBase(cliente, ahora = Date.now()) {
  if (ultimo.resultado && ahora - ultimo.hora < CACHE_MS) return ultimo.resultado;
  const { error } = await cliente.from("planillas").select("nombre").limit(1);
  // Una tabla que aun no existe igual demuestra que la base responde.
  const ok = !error || error.code === "PGRST205" || error.code === "42P01";
  ultimo = { hora: ahora, resultado: { ok } };
  return ultimo.resultado;
}

function reiniciarSalud() {
  ultimo = { hora: 0, resultado: null };
}

module.exports = { comprobarBase, reiniciarSalud };
