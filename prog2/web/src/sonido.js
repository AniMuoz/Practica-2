import { useSyncExternalStore } from "react";

const CLAVE = "sonido-actualizacion";
const VOLUMEN = 0.4;
const oyentes = new Set();
const ESPERA_MIN = 1500;
let audio = null;
let ultimoSonido = 0;

function leerActivo() {
  try {
    return localStorage.getItem(CLAVE) !== "off";
  } catch {
    return true;
  }
}

let activo = leerActivo();

export function cambiarSonido(valor) {
  activo = valor;
  try {
    localStorage.setItem(CLAVE, valor ? "on" : "off");
  } catch {
    // sin almacenamiento: solo vale para esta sesión
  }
  oyentes.forEach((aviso) => aviso());
}

export function sonarActualizacion() {
  const ahora = Date.now();
  if (!activo || ahora - ultimoSonido < ESPERA_MIN) return;
  ultimoSonido = ahora;
  try {
    if (!audio) {
      audio = new Audio(`${import.meta.env.BASE_URL}sonido-actualizacion.mp3`);
      audio.volume = VOLUMEN;
    }
    audio.currentTime = 0;
    // El navegador puede bloquear el audio hasta que el usuario interactúe.
    audio.play()?.catch?.(() => {});
  } catch {
    // un fallo de audio nunca debe romper la actualización de la tabla
  }
}

function suscribir(aviso) {
  oyentes.add(aviso);
  return () => oyentes.delete(aviso);
}

export function useSonido() {
  const encendido = useSyncExternalStore(suscribir, () => activo);
  return { sonido: encendido, cambiarSonido };
}
