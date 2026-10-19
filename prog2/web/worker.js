import { API_BUILD } from "./api-build.js";

export default {
  async fetch(request, env) {
    const API = String(env?.API || API_BUILD || "").trim();
    if (!API) return new Response("Falta la variable API en Cloudflare", { status: 500 });
    try {
      const url = new URL(request.url);
      const destino = new URL(url.pathname + url.search, API);
      const headers = new Headers(request.headers);
      headers.delete("host");
      headers.delete("content-length");
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
