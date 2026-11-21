# 🎨 El dibujador en Railway: Python 3.12 + el Chromium de Playwright, ya instalado. Ver servidor.py.
# ⚠️ El repo y sus dependencias NO entran a la imagen: los baja servidor.py al arrancar y se pone al día antes de
# dibujar. Acá sólo lo que no cambia: el navegador, sus librerías del sistema, git y las fuentes de los emoji.
FROM python:3.12-slim-bookworm
# ⚠️ `libatomic1`: el Node que Playwright trae adentro (desde la 1.65) lo pide, y la imagen `slim` no lo tiene. Sin él,
# `playwright install` muere antes de empezar («libatomic.so.1: cannot open shared object file», 21/11/2026)
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates fonts-noto-color-emoji libatomic1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir playwright tzdata \
    && python -m playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY servidor.py ./
CMD ["python", "-u", "servidor.py"]
