import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

// Evita perder trabajo: bloquea la navegacion y el cierre de la pestana mientras haya cambios sin
// guardar o una importacion en curso, y ofrece "seguir aqui" / "salir sin guardar".
// `hayCambios` e `importando` son booleanos; `descartar` limpia el estado sin guardar de cada seccion.
export function useSalidaSegura({ importando, hayCambios, descartar }) {
  const [salidaPendiente, setSalidaPendiente] = useState(null);
  // Se pone en true antes de navegar a proposito (p. ej. tras crear un material) para no pedir confirmacion.
  const permitirSalida = useRef(false);
  const hayCambiosRef = useRef(false);
  const importandoRef = useRef(false);
  const descartarRef = useRef(descartar);
  hayCambiosRef.current = hayCambios;
  importandoRef.current = importando;
  descartarRef.current = descartar;

  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !permitirSalida.current &&
      (importandoRef.current || hayCambiosRef.current) &&
      currentLocation.pathname !== nextLocation.pathname
  );

  // Ejecuta `accion` ahora, o la deja pendiente de confirmacion si hay cambios sin guardar.
  function intentarSalir(accion) {
    if (importandoRef.current) return;
    if (!hayCambiosRef.current) {
      accion();
      return;
    }
    setSalidaPendiente(() => accion);
  }

  function seguirAqui() {
    if (bloqueo.state === "blocked") bloqueo.reset();
    setSalidaPendiente(null);
  }

  function salirSinGuardar() {
    descartarRef.current();
    if (salidaPendiente) {
      const seguir = salidaPendiente;
      setSalidaPendiente(null);
      seguir();
    }
    if (bloqueo.state === "blocked") bloqueo.proceed();
  }

  useEffect(() => {
    if (!hayCambios && !importando) return undefined;
    function avisarCierre(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisarCierre);
    return () => window.removeEventListener("beforeunload", avisarCierre);
  }, [hayCambios, importando]);

  return {
    mostrarAviso: bloqueo.state === "blocked" || Boolean(salidaPendiente),
    permitirSalida,
    intentarSalir,
    seguirAqui,
    salirSinGuardar,
  };
}
