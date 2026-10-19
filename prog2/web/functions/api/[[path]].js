import worker from "../../worker.js";

export function onRequest(context) {
  return worker.fetch(context.request, context.env);
}
