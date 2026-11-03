import { API_BUILD } from "./api-build.js";

const METODOS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
// Cron diario (ver wrangler.jsonc): ademas de despertar a Render, toca Supabase para que no se pause.
export const CRON_BASE = "0 12 * * *";

export default {
  // Cron Trigger: mantiene despierto Render (plan gratis) y, una vez al dia, Supabase.
  async scheduled(event, env) {
    const API = String(env?.API || API_BUILD || "").trim();
    if (!API) return;
    const rutas = event?.cron === CRON_BASE ? ["/healthz", "/healthz/db"] : ["/healthz"];
    for (const ruta of rutas) {
      try {
        await fetch(new URL(ruta, API), { method: "GET", headers: { "x-secreto-proxy": String(env?.SECRETO_PROXY || "").trim() } });
      } catch (error) {
        console.error(`Ping a ${ruta} fallo: ${error.message}`);
      }
    }
  },

  async fetch(request, env) {
    // Metodos que la API no usa (TRACE, CONNECT, etc.) se cortan aqui y no llegan a Render.
    if (!METODOS.has(request.method)) {
      return new Response("Metodo no permitido", { status: 405, headers: { Allow: [...METODOS].join(", ") } });
    }
    const API = String(env?.API || API_BUILD || "").trim();
    if (!API) return new Response("Falta la variable API en Cloudflare", { status: 500 });
    const secreto = String(env?.SECRETO_PROXY || "").trim();
    if (!secreto) return new Response("Falta SECRETO_PROXY en Cloudflare", { status: 500 });
    try {
      const url = new URL(request.url);
      const destino = new URL(url.pathname + url.search, API);
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      headers.set("x-secreto-proxy", secreto);
      return await fetch(destino, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });
    } catch (error) {
      return new Response(`No se pudo llamar a la API: ${error.message}`, { status: 502 });
    }
  },
};
