import { useState } from "react";
import { enviarJson, obtenerJson } from "../../api.js";
import { nombresContratistas } from "../utilidades.js";

// Estado y llamadas de red de contratistas. `listaContratistas` (solo nombres) tambien la usa Ventas,
// por eso el hook vive en Admin y no dentro del panel.
export function useContratistas() {
  const [contratistas, setContratistas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [listaContratistas, setListaContratistas] = useState([]);
  const [base, setBase] = useState("[]");
  const [confirmando, setConfirmando] = useState(false);

  // Fija las filas y las toma como "lo guardado" para detectar cambios sin guardar.
  function fijar(filas) {
    const lista = filas || [];
    setContratistas(lista);
    setBase(JSON.stringify(lista));
  }

  // Solo actualiza los nombres (para Ventas); devuelve las filas.
  function cargarNombres() {
    return obtenerJson("/api/contratistas").then((data) => {
      setListaContratistas(nombresContratistas(data.filas));
      return data.filas || [];
    });
  }

  // Al abrir el panel: lee las filas completas y los nombres.
  function abrir() {
    setCargando(true);
    setAviso("");
    obtenerJson("/api/contratistas", "No se pudieron leer los contratistas.")
      .then((data) => {
        fijar(data.filas || []);
        setListaContratistas(nombresContratistas(data.filas));
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setCargando(false));
  }

  function guardarConfirmado(clave) {
    setConfirmando(false);
    setAviso("");
    setGuardando(true);
    enviarJson("/api/contratistas", { clave, filas: contratistas }, "No se pudo guardar.", "PUT")
      .then((data) => {
        fijar(data.filas || []);
        setListaContratistas(nombresContratistas(data.filas));
        setAviso("Contratistas guardados.");
      })
      .catch((err) => setAviso(err.message))
      .finally(() => setGuardando(false));
  }

  // Refresco por SSE: `panelAbierto` decide si tambien se actualizan las filas y el aviso de error.
  function refrescar(panelAbierto) {
    return cargarNombres()
      .then((filas) => {
        if (panelAbierto) fijar(filas);
      })
      .catch(() => {
        if (panelAbierto) setAviso("No se pudieron leer los contratistas.");
      });
  }

  const hayCambios = () => JSON.stringify(contratistas) !== base;
  const descartar = () => setContratistas(JSON.parse(base));

  return {
    contratistas,
    setContratistas,
    cargando,
    guardando,
    aviso,
    setAviso,
    listaContratistas,
    confirmando,
    setConfirmando,
    cargarNombres,
    abrir,
    guardarConfirmado,
    refrescar,
    hayCambios,
    descartar,
  };
}
