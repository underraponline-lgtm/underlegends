# El grabador en Railway: Node 22 + ffmpeg (para mezclar y partir). Ver index.js.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.js ./
# las frases de la prueba de micro (voz/hacer_voz.py): Piper no viaja, sólo lo que hizo
COPY voz/*.ogg ./voz/
CMD ["node", "index.js"]
