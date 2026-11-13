// Presencia en memoria: quien hizo una peticion reciente y en que bodega la esta mirando.
const VENTANA_MS = 2 * 60 * 1000;
const activos = new Map();

function registrar(usuario, rol, bodega, ahora = Date.now()) {
  if (!usuario) return;
  activos.set(usuario, { usuario, rol: rol || "operador", bodega, ultimaVez: ahora });
}

function activosDe(bodega, ahora = Date.now()) {
  return [...activos.values()]
    .filter((r) => r.bodega === bodega && ahora - r.ultimaVez <= VENTANA_MS)
    .sort((a, b) => a.usuario.localeCompare(b.usuario))
    .map((r) => ({ usuario: r.usuario, rol: r.rol, hace_seg: Math.max(0, Math.round((ahora - r.ultimaVez) / 1000)) }));
}

function limpiar(ahora = Date.now()) {
  for (const [clave, r] of activos) if (ahora - r.ultimaVez > VENTANA_MS) activos.delete(clave);
}

function reiniciar() {
  activos.clear();
}

setInterval(limpiar, 60 * 1000).unref();

module.exports = { registrar, activosDe, limpiar, reiniciar, VENTANA_MS };
