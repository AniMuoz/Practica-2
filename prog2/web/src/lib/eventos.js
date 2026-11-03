// Conexion SSE unica por pestaña: todos los componentes comparten un solo EventSource a /api/eventos
// (cada conexion es una request larga del Worker y ocupa un cupo en el servidor).

let fuente = null;
const oyentes = new Set();

// Un oyente que falla no impide que los demas reciban el evento.
function notificar(nombre, dato) {
  for (const o of oyentes) {
    try {
      if (o[nombre]) o[nombre](dato);
    } catch (error) {
      console.error(error);
    }
  }
}

function abrir() {
  fuente = new EventSource("/api/eventos");
  fuente.onopen = () => notificar("alAbrir");
  fuente.onmessage = (evento) => {
    let data;
    try {
      data = JSON.parse(evento.data);
    } catch {
      return;
    }
    notificar("alMensaje", data);
  };
}

// Se suscribe a los eventos; devuelve la funcion para cancelar. La conexion se cierra al irse el ultimo oyente.
export function suscribirEventos({ alMensaje, alAbrir } = {}) {
  const oyente = { alMensaje, alAbrir };
  oyentes.add(oyente);
  if (!fuente) abrir();
  else if (fuente.readyState === 1 && alAbrir) alAbrir();
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0 && fuente) {
      fuente.close();
      fuente = null;
    }
  };
}
