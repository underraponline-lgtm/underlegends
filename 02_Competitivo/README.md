# TARJETA COMPETITIVO — preset actual

Escudo trazado 300×485. El número grande es el **Score competitivo**.

## Cómo regenerar

Todo tiene que estar en `/home/claude/`. El generador es un script, no un
módulo: se corre y escribe el HTML.

```bash
python3 v2/gencomp.py          # lee comp.json -> escribe el HTML
python3 exportar_png.py Konan  # PNG suelto, fondo transparente
```

`comp.json` es la lista a dibujar. `competitivo_pool.json` tiene los 138
completos: copiá de ahí los que quieras.

Chromium no llega al CDN de Discord ni a Google Fonts desde el entorno. Para
sacar PNG hay que embeber avatares, banderas, escudos **y fuentes** en base64
antes de renderizar. `comun/fonts/embed.css` ya trae las 9 woff2, y vive en
`comun/` porque lo comparten las cuatro cartas.

## Qué muestra la carta

| zona | qué dice |
|---|---|
| número grande | Score competitivo |
| pastilla | `RANGO X` con **signo**: A+, A, A−, B+… |
| **corona** | la temporada, en círculo, asomando desde arriba |
| **columna izquierda** | hasta 3 rombos de **eventos insignia** |
| chips derecha | puesto · win rate · duelos · racha |
| 6 stats | EFI · CON · DOM · TCH · DIV · EVT |
| **fila de abajo** | bandera · estilo · servidor · crew, todo en círculos con aro y número |
| TAG | el nivel competitivo |
| V de abajo | logo UL |

## Las reglas que no se pueden romper

**El rango sale del Score, siempre.** Los mismos umbrales valen en las tres
cartas: el rango es uno solo por persona.
`SSS 82 · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto`

**Los subrangos parten cada tramo en tercios**, y solo A, B, C y D los llevan.
SSS, SS, S y E van sin signo. **El signo cambia la pastilla, no el color**: un
A− y un A+ comparten carta de rubí. Si cada signo tuviera su tono harían falta
16 paletas y se perdería de un vistazo en qué rango está la persona.

**Los rombos se ordenan por importancia del EVENTO, no por resultado.** El
Interserver va primero siempre. El resto sigue el tamaño del servidor:

```
interserver 0 · SR 1 · TFC 2 · DRA 3 · Stelar Versers 4 · FRZ 5
FFA 6 · TWR 7 · FTN 8 · URBF 9 · EFA 10
```

Konan tiene la plata arriba y el oro abajo: su plata es del Interserver y su
oro de la TFC Champions. **No es un bug.**

**Los círculos de abajo llevan aro cerrado y número.** El número es tu puesto
dentro de esa categoría, calculado **por Score** en las tres: país, servidor y
crew. Si alguna vez se quiere medir por un combinado de temporada y
competitivo, hay que cambiarlo en las tres a la vez, o los tres números dejan
de ser comparables entre sí.

**La crew lleva número solo si tiene 3 o más en el ranking.** En una crew de
un integrante, ser primero no dice nada. KS hoy tiene uno, así que va sin
número.

**Solo se resalta el 100 en las stats**, que significa liderar esa dimensión
en todo el pool. Son 4 cartas de 138. Si se resaltara el máximo de cada carta
lo tendrían las 138, y en 77 de ellas caería en diversidad.

## Los números que costaron encontrar

No los toques sin volver a medir.

- **`.temp` en `top:4px`.** Lo que tapa el círculo de la corona no es el borde
  de la carta ni una banda horizontal: es el **perfil de la corona**, que tiene
  tres picos con valles. Por debajo de 0 el pico central se come parte del
  texto (a −4 se pierde el 9% de la tinta).
- **La columna de rombos se centra por lo PINTADO, no por la caja.** Un rombo
  de 44 rotado 45° ocupa 62. Y cada cantidad tiene su propio `top`, porque los
  rombos cambian de tamaño: 3 se centran entre la pastilla y el EFI, 2 entre la
  pastilla y el nombre, 1 cuelga de la pastilla.
- **El TAG no va centrado a propósito.** Queda 3px arriba del centro para que
  se apoye en la fila de círculos en vez de flotar.
- **El flex mide el rombo por su caja sin rotar.** Si centrás la caja, el rombo
  queda 5px alto.

## Los archivos

| archivo | qué es |
|---|---|
| `v2/gencomp.py` | el generador |
| `v2/card.css` | los estilos |
| `v2/shield*.txt` | el contorno del escudo. **No redibujar** |
| `eventos.json` | los 5 eventos insignia con participantes y podios |
| `competitivo_pool.json` | los 138 con Score, dimensiones, subrango y puestos |
| `logos_sv/sv_*.png` | 8 siluetas de servidor |
| `logos_crew/cw_*.png` | los 2 logos de crew, versión final |
| `v2/estilos/*.png` | los 16 estilos, extraídos del rombo |
| `estilos_src/*.png` | las tarjetas originales de los estilos, por si hay que rehacerlos |
| `procesar_logos.py` | convierte un logo nuevo en silueta |
| `extraer_estilos.py` | saca el ícono de adentro del rombo dorado |
| `exportar_png.py` | PNG suelto con fondo transparente |

### Sobre los logos y los íconos

El rombo y el círculo del estilo usan la imagen como **`mask-image`**: solo
importa el canal alfa. Un logo de Discord es un cuadrado 100% opaco, así que
como máscara da un rombo blanco sólido. Por eso todo pasa por
`procesar_logos.py`, que tiene cuatro modos según cómo venga el archivo
(`alfa`, `fondo`, `oscuro`, `vivo`) y normaliza por **tinta**, no por caja.

Ese script también borra manchitas de menos del 2% pegadas al borde: el archivo
de DRA traía una marca de agua de 756px en la esquina que corría el centro del
logo de x=512 a x=603.

**Los estilos son PNG, no SVG.** `extraer_estilos.py` los saca del rombo
dorado. La separación **no es por brillo**: probé umbral fijo, porcentaje del
dorado y Otsu, y ninguno anda en los 16, porque hay íconos macizos (el puño) y
otros de trazo fino (la columna). Lo que los separa siempre es el **color**: el
rombo es cromático y el ícono acromático, así que el ícono es el rombo relleno
menos lo dorado.

Dos íconos son dibujados y no extraídos: **ingenio** es un cerebro y
**filosófico** una columna griega. Filosófico reemplazó a *actitud*.

⚠️ El cargador de `gencomp.py` acepta PNG y SVG. Si alguna vez vuelve a leer
solo `.svg`, los estilos desaparecen en silencio y nadie se entera, porque hoy
`ESTILO_DE` está vacío.

### Para exportar PNG

`exportar_png.py` mide la unión de la carta con lo que le cuelga por fuera: los
chips van en `right:-11px` y los rombos en `left:-10px`. Hay que **saltear** lo
que está dentro de `.clip` y los elementos SVG, porque `.rays` tiene
`inset:-22%` y los `<path>` tienen `stroke-width:27`, así que sus cajas se salen
54 y 66px aunque el recorte no los deje pintar ahí.

Y hay que apagar el `filter:drop-shadow` de `.card` antes de capturar, o la
sombra pinta toda la caja y el PNG sale rectangular en vez de con la silueta.

## Pendientes

1. **Faltan llaves** de Snake Rap, TWR y Fontana. Cuando lleguen se agregan a
   `eventos.json` con su prioridad y entran solas.
2. **32 nombres de las llaves no están en el Ranking Competitivo**, incluidos
   campeones: Rodri LP ganó el Interserver, Ceko el de FRZ, Olaf salió segundo,
   Logan segundo en Urban y Edu segundo en DRA. No llegan a los 8 eventos que
   pide el ranking, así que no tienen carta.
3. **Los duelos son reales solo en 4 raperos.** Ese dato vive en el acumulador
   (`/mnt/project`), que no está montado. El resto muestra `0/0`.
4. **`ESTILO_DE` está vacío**: nadie tiene estilo asignado todavía. Los 16
   íconos ya están listos y toman el color de la carta.
5. **FFA no tiene marca usable**: lo que hay es un póster con micrófonos,
   llamas y texto. Haría falta un isotipo suelto.
6. **KS tiene un solo integrante** en el ranking, por eso va sin número.
