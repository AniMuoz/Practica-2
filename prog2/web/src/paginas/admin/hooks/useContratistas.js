import { useRef, useState } from "react";
import { useEstadoPersistente } from "../../../lib/persistencia.js";
import { enviarJson, obtenerJson } from "../../../lib/api.js";
import { nombresContratistas } from "../utilidades.js";

// Estado y llamadas de red de contratistas. `listaContratistas` (solo nombres) tambien la usa Ventas,
// por eso el hook vive en Admin y no dentro del panel.
export function useContratistas() {
  // La lista editada y "lo guardado" viven en sessionStorage para que el borrador sobreviva a cambiar de pagina.
  const [contratistas, setContratistas] = useEstadoPersistente("admin:contratistas:lista", []);
  const [base, setBase] = useEstadoPersistente("admin:contratistas:base", "[]");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [listaContratistas, setListaContratistas] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const ultimo = useRef({ contratistas, base });
  ultimo.current = { contratistas, base };

  // Fija las filas y las toma como "lo guardado" para detectar cambios sin guardar.
  // Con `conservar`, si habia ediciones sin guardar se mantienen y solo se actualiza "lo guardado".
  function fijar(filas, conservar = false) {
    const lista = filas || [];
    const editado = JSON.stringify(ultimo.current.contratistas) !== ultimo.current.base;
    if (!(conservar && editado)) setContratistas(lista);
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
        fijar(data.filas || [], true);
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
        if (panelAbierto) fijar(filas, true);
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
