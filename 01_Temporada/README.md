# TARJETA TEMPORADA — terminada

Rectangular 300×438. Es la que el HANDOFF viejo llamaba "Normal".
El número grande es el **OVR de temporada**, o sea la acumulación.

## Cómo usarla

```bash
python3 generar.py                 # los 8 de muestra, uno por rango
python3 generar.py Konan Valen     # solo esos
python3 exportar_png.py Konan      # PNG suelto, fondo transparente
```

`normal_v3.py` **no es un script**: es un módulo con una función
`render(lista)`. Por eso existe `generar.py`, que es lo que se corre.

`temporada_pool.json` tiene los 138 del pool, ya calculados desde el Sheet.

## Qué muestra la carta

| zona | qué dice |
|---|---|
| número grande | OVR de temporada |
| letra debajo | el rango |
| **color de la carta** | el OVR de temporada |
| **#** arriba a la derecha | tu puesto en la temporada |
| nombre | escalado según el largo |
| 6 stats | PTS · EVT · POD · SEM · CAZ · MW |
| fila de abajo | temporada (izq) · TAG (centro) · logo UL (der) |

## Las reglas que no se pueden romper

**El número y el color salen del OVR de temporada.**
Umbrales del color: `SSS 88 · SS 82 · S 74 · A 67 · B 61 · C 56 · D 52 · E resto`

**La letra del rango sale del Score competitivo, no del OVR.** Los umbrales son
los de la Competitiva: `SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18`.
El rango es uno solo por persona y tiene que dar igual en todas sus cartas.
Subir de rango solo se logra en el competitivo: ser #1 de temporada no te hace
#1 del competitivo.

Consecuencia asumida a propósito: **el color y la letra pueden decir cosas
distintas**. Bloody tiene el OVR más alto de las 138, así que le toca carta
negra, y su letra dice A porque su Score es 56.5. **No es un bug.**

**MW es `sobrevivió/veces objetivo`**, en una sola casilla y no en dos. 🛡️ lo
tienen 6 personas en todo el Sheet: en casillas separadas, 133 de 138 cartas
mostrarían dos ceros.

**WR% no está en las stats pero no se perdió**: sigue pesando 16% dentro del
OVR. Dejó de ocupar casilla, nada más.

**El nombre se escala por largo**: 1.86rem hasta 6 letras, 1.72 hasta 8, 1.55
hasta 10, 1.38 de ahí en más. Es la misma escalera que usan las otras dos
cartas: sin esto, el mismo rapero tenía el nombre en 27.52px acá y en 29.76px
en la Competitiva.

## Los números que costaron encontrar

- **La máscara de la foto va en 72 / 88 / 100.** Hubo un momento en que el CSS
  tenía dos reglas `.c-photo` con máscaras distintas y ganaba la equivocada por
  cascada.
- **La fila de abajo es flex con `space-between`.** Antes el TAG se centraba
  sobre el centro de la carta y quedaba corrido 13.9px, porque la temporada y
  el logo no miden lo mismo. Con flex los dos huecos salen iguales **por
  construcción**, y eso sigue siendo cierto cuando la temporada pase de decir
  PRE a decir T1.
- **El ritmo de la columna izquierda es 13 y 13.** Estaba en 19 arriba de la
  bandera y 8 abajo, así que la bandera se veía pegada al escudo.

## De dónde salen los datos

Sheet Oficial `1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U`

- **Ranking Temporada**, cabecera en la fila 16 → PTS, EVT, POD, SEM, CAZ, MW
- **Ranking Competitivo**, cabecera en la fila 12 → Score, que da la letra
- pool = los que tienen **8 o más eventos**. Ese mismo corte desbloquea el
  Win%, el rango competitivo y la carta. Debajo de 8 va la carta Bloqueada
- la columna `Sv` está vacía en 134 de 138: el servidor se deriva de aquel
  donde el rapero tiene más puntos, usando las 7 columnas por servidor
- la columna 🔥 guarda texto `actual/máxima`, **no un número**. Si se lee como
  número, todos los TAG de racha desaparecen

## Los archivos

| archivo | qué es |
|---|---|
| `normal_v3.py` | el generador, módulo con `render(lista)` |
| `normal_v3.css` | los estilos |
| `generar.py` | arma el HTML |
| `exportar_png.py` | PNG suelto con fondo transparente |
| `temporada_pool.json` | los 138 con OVR, puesto y stats |
| `ul_b64.txt` | el logo UL en base64. **El generador lo lee de `/home/claude/ul_b64.txt`** |
| `ul_blanco.png` | el logo original, 744×606 |
| `comun/fonts/embed.css` | las 9 woff2 embebidas, para el PNG. **No vive acá**: lo comparten las cuatro cartas |
| `tarjeta_temporada.html` | la vista con un rapero por rango |
| `vista_8_rangos.png` · `ejemplo_konan.png` | capturas |

### Para exportar PNG

`.card` tiene `box-shadow: 0 16px 38px`. Hay que apagarlo antes de capturar o
la sombra pinta toda la caja y el PNG sale como un rectángulo gris.

Y Chromium no llega al CDN de Discord ni a Google Fonts desde el entorno: hay
que embeber avatares, banderas, escudos **y fuentes** en base64. Python sí
tiene salida a internet, por eso se bajan desde ahí.

## Pendientes conocidos

1. **`KeyError: 'URBF'`** al renderizar el pool completo. Es NFK, el único con
   servidor principal URBF, y el dict `LOGO` no lo tiene. Faltan también EFA y
   FFA. Se destraba con el ID del ícono o con un respaldo en el generador.
2. `.c-pos, .c-season{` está escrita **dos veces** en el CSS.
3. La maquinaria de `bright` sigue en el generador aunque sus reglas ya no
   existen. Si alguien pone un `True` en `GRAD`, sale una clase sin reglas.
4. Renombrar el archivo de `normal_v3` a `temporada` quedó para el final.
5. Tres avatares del pool no responden y caen en iniciales.

## Cómo trabajar sin romperla

Medir con Playwright, no a ojo. Nada de regex sobre el CSS: tiene reglas
multilínea y se come `.card{`. Backup antes de cada tanda, y después de editar
verificar llaves balanceadas, que no quede texto suelto fuera de reglas, y que
el render salga idéntico píxel a píxel cuando el cambio no debía verse.
