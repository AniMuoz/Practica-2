import { createContext, useContext, useEffect, useState } from "react";

const ColoresPlanillaContext = createContext(null);

export function ColoresPlanillaProvider({ children }) {
  const [colores, setColores] = useState(() => localStorage.getItem("coloresPlanilla") !== "0");
  const [oscuro, setOscuro] = useState(() => localStorage.getItem("modoOscuro") === "1");

  useEffect(() => {
    document.documentElement.classList.toggle("oscuro", oscuro);
  }, [oscuro]);

  function cambiarColores(activo) {
    localStorage.setItem("coloresPlanilla", activo ? "1" : "0");
    setColores(activo);
  }

  function cambiarOscuro(activo) {
    localStorage.setItem("modoOscuro", activo ? "1" : "0");
    setOscuro(activo);
  }

  return (
    <ColoresPlanillaContext.Provider value={{ colores, cambiarColores, oscuro, cambiarOscuro }}>
      {children}
    </ColoresPlanillaContext.Provider>
  );
}

export function useColoresPlanilla() {
  return useContext(ColoresPlanillaContext);
}
