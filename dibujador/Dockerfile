# 🎨 El dibujador en Railway: Python 3.12 + el Chromium de Playwright, ya instalado. Ver servidor.py.
# ⚠️ El repo y sus dependencias NO entran a la imagen: los baja servidor.py al arrancar y se pone al día antes de
# dibujar. Acá sólo lo que no cambia: el navegador, sus librerías del sistema, git y las fuentes de los emoji.
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir playwright tzdata \
    && python -m playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY servidor.py ./
CMD ["python", "-u", "servidor.py"]
