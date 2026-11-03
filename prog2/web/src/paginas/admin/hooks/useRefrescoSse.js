import { useEffect, useRef } from "react";
import { suscribirEventos } from "../../../lib/eventos.js";

export const ESPERA_REFRESCO_MS = 200;
export const ESPERA_REANUDAR_MS = 400;

// Refresca las vistas cuando el servidor avisa por SSE que cambio la tabla ("recarga" o "fila").
// Varios avisos seguidos se juntan en una sola recarga. `suspender()` frena el refresco (p. ej. durante
// un pegado masivo, para que las celdas no parpadeen) y `reanudar()` lo libera tras un instante.
// `refrescar` puede cambiar en cada render: siempre se llama a la ultima version.
export function useRefrescoSse(refrescar) {
  const refrescarRef = useRef(refrescar);
  refrescarRef.current = refrescar;
  const suspendidos = useRef(0);
  const pendiente = useRef(0);

  useEffect(() => {
    const cancelar = suscribirEventos({
      alMensaje: (data) => {
        if (data.tipo !== "recarga" && data.tipo !== "fila") return;
        if (suspendidos.current > 0) return;
        window.clearTimeout(pendiente.current);
        pendiente.current = window.setTimeout(() => refrescarRef.current(), ESPERA_REFRESCO_MS);
      },
    });
    return () => {
      window.clearTimeout(pendiente.current);
      cancelar();
    };
  }, []);

  function suspender() {
    suspendidos.current += 1;
    window.clearTimeout(pendiente.current);
  }

  function reanudar() {
    window.setTimeout(() => {
      suspendidos.current = Math.max(0, suspendidos.current - 1);
    }, ESPERA_REANUDAR_MS);
  }

  return { suspender, reanudar };
}
