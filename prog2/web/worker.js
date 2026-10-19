export default {
  async fetch(request, env) {
    const API = env?.API;
    if (!API) return new Response("Falta la variable API", { status: 500 });
    const url = new URL(request.url);
    const destino = new URL(url.pathname + url.search, API);
    const headers = new Headers(request.headers);
    headers.set("host", destino.host);
    return fetch(destino, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  },
};
