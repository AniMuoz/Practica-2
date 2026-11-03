import { useEffect, useState } from "react";

// true cuando el ancho de la ventana es menor o igual a `anchoMaximo` px; se actualiza al redimensionar.
export function useEsMovil(anchoMaximo = 800) {
  const consulta = `(max-width: ${anchoMaximo}px)`;
  const [esMovil, setEsMovil] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const lista = window.matchMedia(consulta);
    const alCambiar = (e) => setEsMovil(e.matches);
    setEsMovil(lista.matches);
    lista.addEventListener("change", alCambiar);
    return () => lista.removeEventListener("change", alCambiar);
  }, [consulta]);
  return esMovil;
}
