# Liga Global — Tarjetas

Empezá por **`CLAUDE.md`**: ahí está todo el contexto, las reglas que no se
pueden romper y las trampas conocidas.

## Rápido

```bash
cd 01_Temporada   && python3 generar.py            # las 8 de muestra
cd 01_Temporada   && python3 exportar_png.py Konan # PNG transparente

cd 02_Competitivo && python3 v2/gencomp.py         # lee comp.json
cd 02_Competitivo && python3 exportar_png.py Konan

cd 03_Servidor    && python3 normal_gen.py         # en curso
```

Cada carta escribe en su propia `salida/`. Las rutas son relativas al script,
así que el proyecto se puede mover de lugar.

## Qué hace falta instalar

```bash
pip install playwright pillow numpy requests gspread google-auth scipy
playwright install chromium
```

Para leer el Sheet hace falta `creds.json` en la raíz. **No está incluido y no
debe subirse al repo.**

## Dónde está cada cosa

| carpeta | qué hay |
|---|---|
| `01_Temporada/` | carta terminada |
| `02_Competitivo/` | carta terminada, con eventos, estilos y logos |
| `03_Servidor/` | en curso — leer `NOTAS.md` |
| `herramientas/` | los procesadores de logos y estilos, con los originales |
| `datos/` | los pools, los eventos y los colores de servidor |
| `docs/` | historial de decisiones y errores que conviene no repetir |
