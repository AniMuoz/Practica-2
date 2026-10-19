FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# La app escribe imagenes/ y .sesion-secreto dentro de /app: se entrega la carpeta al usuario sin privilegios.
RUN chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/healthz" || exit 1
CMD ["node", "server.js"]
