import { useEffect, useRef } from "react";

export const INACTIVIDAD_MS = 120000;
export const REFRESCO_MIN_MS = 20000;
const MAX_FACTOR = 4;

// Sondeo que ahorra requests: solo corre con la pestaña visible, se pausa tras 2 min sin uso,
// no repite una lectura reciente al volver (< REFRESCO_MIN_MS) y espacia los reintentos si falla.
// `leer` puede devolver una promesa; si se rechaza se aplica backoff exponencial.
export function useSondeo(leer, intervaloMs, activo = true, inmediato = true) {
  const leerRef = useRef(leer);
  leerRef.current = leer;

  useEffect(() => {
    if (!activo) return undefined;
    let temporizador = null;
    let inactividad = null;
    let ultima = 0;
    let factor = 1;
    let pausado = false;
    let vivo = true;
    let enVuelo = false;

    const visible = () => document.visibilityState === "visible";

    const programar = () => {
      clearTimeout(temporizador);
      temporizador = null;
      if (!vivo || pausado || !visible()) return;
      temporizador = setTimeout(ejecutar, intervaloMs * factor);
    };

    function ejecutar() {
      if (enVuelo) return;
      enVuelo = true;
      ultima = Date.now();
      Promise.resolve()
        .then(() => leerRef.current())
        .then(
          () => {
            factor = 1;
          },
          () => {
            factor = Math.min(factor * 2, MAX_FACTOR);
          }
        )
        .finally(() => {
          enVuelo = false;
          programar();
        });
    }

    const programarPausa = () => {
      clearTimeout(inactividad);
      inactividad = setTimeout(() => {
        pausado = true;
        clearTimeout(temporizador);
        temporizador = null;
      }, INACTIVIDAD_MS);
    };

    // Tras una pausa (inactividad u oculta) se lee de inmediato solo si el dato ya esta viejo.
    const retomar = () => {
      clearTimeout(temporizador);
      temporizador = null;
      if (Date.now() - ultima >= REFRESCO_MIN_MS) ejecutar();
      else programar();
    };

    const reanudar = () => {
      programarPausa();
      if (!pausado || !visible()) return;
      pausado = false;
      retomar();
    };

    const alCambiarVisibilidad = () => {
      if (!visible()) {
        clearTimeout(temporizador);
        temporizador = null;
        return;
      }
      programarPausa();
      pausado = false;
      retomar();
    };

    programarPausa();
    if (visible()) {
      if (inmediato) ejecutar();
      else {
        ultima = Date.now();
        programar();
      }
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    document.addEventListener("pointerdown", reanudar);
    document.addEventListener("keydown", reanudar);
    document.addEventListener("scroll", reanudar, true);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      clearTimeout(inactividad);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      document.removeEventListener("pointerdown", reanudar);
      document.removeEventListener("keydown", reanudar);
      document.removeEventListener("scroll", reanudar, true);
    };
  }, [intervaloMs, activo]);
}
