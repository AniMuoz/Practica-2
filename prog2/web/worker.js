const API = "https://practica-2-vnu7.onrender.com";

export default {
  async fetch(request) {
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
