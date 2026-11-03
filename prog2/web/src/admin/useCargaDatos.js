import { useState } from "react";
import { enviarFormulario } from "../api.js";

// Estado y envio de la carga masiva (planilla .xlsx o carpeta de imagenes QR, rombo y foto).
export function useCargaDatos({ clave, refrescarVistas, cargarUltimasCargas }) {
  const [archivo, setArchivo] = useState(null);
  const [archivosQr, setArchivosQr] = useState([]);
  const [importando, setImportando] = useState(false);
  const [avisoCarga, setAvisoCarga] = useState("");
  const [modoCarga, setModoCarga] = useState("completa");
  const [columnaCarga, setColumnaCarga] = useState("");
  const [columnasDestino, setColumnasDestino] = useState([]);
  const [cargaKey, setCargaKey] = useState(0);

  function aplicarDestino(destino) {
    setColumnasDestino(destino);
    setColumnaCarga((actual) => (destino.includes(actual) ? actual : destino[0] || ""));
  }

  function descartarCarga() {
    setArchivo(null);
    setCargaKey((actual) => actual + 1);
  }

  function enviarCarga(event) {
    event.preventDefault();
    if (modoCarga === "qr" || modoCarga === "rombo" || modoCarga === "foto") {
      const prefijo = modoCarga;
      const campoImagen = { qr: "QR", rombo: "Rombo", foto: "Foto" }[modoCarga];
      const maxBytes = 100 * 1024;
      const patron = new RegExp(`^${prefijo}_(.+)\\.(png|jpe?g)$`, "i");
      const coincidentes = archivosQr
        .map((f) => ({ f, m: patron.exec(f.name) }))
        .filter((x) => x.m);
      const grandes = coincidentes.filter((x) => x.f.size > maxBytes);
      const validos = coincidentes.filter((x) => x.f.size <= maxBytes);
      if (!validos.length) {
        setAvisoCarga(
          coincidentes.length
            ? "Todas las imágenes superan los 100 KB."
            : `La carpeta no tiene imágenes con formato ${prefijo}_{codigo}.png o .jpg.`
        );
        return;
      }
      const omitidasTxt = grandes.length ? ` (${grandes.length} se omiten por superar 100 KB)` : "";
      if (!window.confirm(`¿Subir ${validos.length} imágenes de ${campoImagen} a sus materiales?${omitidasTxt}`)) return;
      const formulario = event.target;
      setAvisoCarga("");
      setImportando(true);
      (async () => {
        let ok = 0;
        const fallidos = [];
        for (let i = 0; i < validos.length; i++) {
          const { f, m } = validos[i];
          setAvisoCarga(`Subiendo ${i + 1} de ${validos.length}...`);
          try {
            const cuerpo = new FormData();
            cuerpo.append("clave", clave);
            cuerpo.append("campo", campoImagen);
            cuerpo.append("archivo", f);
            await enviarFormulario(`/api/material/${encodeURIComponent(m[1])}/imagen`, cuerpo);
            ok++;
          } catch {
            fallidos.push(m[1]);
          }
        }
        setArchivosQr([]);
        formulario.reset();
        const detalle =
          (fallidos.length
            ? `, ${fallidos.length} fallidos (${fallidos.slice(0, 10).join(", ")}${fallidos.length > 10 ? "..." : ""})`
            : "") + (grandes.length ? `, ${grandes.length} omitidos por superar 100 KB` : "");
        setAvisoCarga(`Listo: ${ok} imágenes de ${campoImagen} subidas${detalle}.`);
        refrescarVistas();
      })().finally(() => setImportando(false));
      return;
    }
    if (!archivo) {
      setAvisoCarga("Elige un archivo .xlsx.");
      return;
    }
    if (modoCarga === "dos-columnas" && !columnaCarga) {
      setAvisoCarga("Elige la columna que va a llenar la planilla.");
      return;
    }
    const secciones = {
      completa: "Planilla completa",
      sap: "Planilla EXPORT SAP",
      ubicaciones: "Planilla de ubicaciones",
      precios: "Planilla de precios",
      "dos-columnas": columnaCarga
        ? `Planilla de 2 columnas (columna ${columnaCarga})`
        : "Planilla de 2 columnas",
      reservas: "Añadir reservas",
      movimientos: "Movimientos",
    };
    const seccion = secciones[modoCarga] || modoCarga;
    const confirmar = window.confirm(
      `¿Confirmas la carga del archivo "${archivo.name}" en la sección ${seccion}?`
    );
    if (!confirmar) return;
    setAvisoCarga("");
    setImportando(true);
    const cuerpo = new FormData();
    cuerpo.append("clave", clave);
    cuerpo.append("modo", modoCarga);
    if (modoCarga === "dos-columnas") cuerpo.append("columna", columnaCarga);
    cuerpo.append("archivo", archivo);
    enviarFormulario("/api/tabla/excel", cuerpo, "No se pudo importar.")
      .then((data) => {
        setArchivo(null);
        event.target.reset();
        const omitidos = data.omitidos ? `, ${data.omitidos} omitidos` : "";
        setAvisoCarga(
          modoCarga === "movimientos"
            ? `Listo: ${data.agregados} códigos cargados${omitidos}.`
            : `Listo: ${data.agregados} nuevos, ${data.actualizados} actualizados${omitidos}.`
        );
        cargarUltimasCargas();
        refrescarVistas();
      })
      .catch((err) => setAvisoCarga(err.message))
      .finally(() => setImportando(false));
  }

  return {
    archivo,
    setArchivo,
    setArchivosQr,
    importando,
    avisoCarga,
    modoCarga,
    setModoCarga,
    columnaCarga,
    setColumnaCarga,
    columnasDestino,
    cargaKey,
    aplicarDestino,
    descartarCarga,
    enviarCarga,
  };
}
