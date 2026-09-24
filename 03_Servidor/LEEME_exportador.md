# exportador de la Servidor

Va en `03_Servidor/exportar_png.py`, al lado de `normal_gen.py`.

```bash
python exportar_png.py --lista      # ver quien esta en normal_datos.json
python exportar_png.py Valen        # PNG transparente
python exportar_png.py Valen out.png
```

Probado: sale 900×1314 con las cuatro esquinas transparentes y la silueta del
escudo biselado correcta — 282px de ancho arriba por las esquinas cortadas,
300 en los laterales rectos, 228 al 92% y cerrando en punta al 100%.

## Lo que resuelve

**La sombra.** `.card` tiene `filter: drop-shadow(0 16px 34px)` en la misma
regla que el `clip-path`. Sin apagarla, el PNG sale rectangular.

**Las fuentes.** Ninguno de los tres generadores las embebe: los tres CSS traen
`@import` de Google Fonts, que anda al abrir el HTML en un navegador con
internet pero no al renderizar en un Chromium aislado. El exportador saca el
`@import` e inyecta `comun/fonts/embed.css`. Por eso la Servidor se veia con fuentes
del sistema: no le faltaba el embebido, le faltaba el exportador.

**Las imagenes que fallan.** Si algo no responde 200, lo lista al final en vez
de dejar `src=""` en silencio. Sirve para los avatares con hash vencido y para
las banderas de quien no tiene pais, donde la URL queda `flagcdn.com/w80/.png`
y el navegador dibuja el icono de imagen rota.

## Una diferencia con la Competitiva

Aca **nada cuelga por fuera de la carta**: el `clip-path` de `.card` recorta a
todos sus hijos. Por eso alcanza con capturar el elemento y no hace falta
calcular la union con lo que sobresale, como si hace falta en la Competitiva
por los chips en `right:-11px` y los rombos en `left:-10px`.

## Ojo

Lee `normal_datos.json`, que es la **muestra de 6 personas**, no el pool. Si
queres exportar a alguien que no este ahi, primero hay que agregarlo a ese
archivo. Los seis de hoy son Valen, Juasmio, Humildad, HH, Trot y Benja.
