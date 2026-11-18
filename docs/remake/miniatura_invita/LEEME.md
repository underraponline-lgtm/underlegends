# La miniatura de Invita y gana: la 4b, guardada (17/11/2026)

Dlx, 17/11/2026, mirando la versión «4b · Las banderas»: *«me gusta como se ve ahora… guarda este preset
específicamente… antes de seguir»*. Éste es ese preset, tal cual, antes de tocar nada más.

| archivo | qué es |
|---|---|
| `4b_banderas.png` | cómo se ve, 1200 × 630 (la carta de DLX como ejemplo) |
| `4b_banderas.dc.html` | el tablero del lienzo de diseño (sus imágenes son `/_blob/…` del lienzo: sólo se ven ahí) |
| `thumb_gen.py`, `thumb_gen2.py` | los generadores de las miniaturas del lienzo (la 4b es `ThCap2` en `thumb_gen2.py`) |

El lienzo es https://claude.ai/artifact/9EZdEof3J7tLiisKuzXspF (privado), tablero «4b · Guardada».

## Cómo es

1200 × 630, en tres columnas, sin degradés ni radios de más de 4 px:

| columna | ancho | fondo | qué lleva |
|---|---|---|---|
| izquierda | 0–390 | negro `#030304` | «DLX TE INVITA» (etiqueta magenta, Barlow Condensed 700, 54 px) · la carta de quien invita (226 px de ancho, girada −4°) · «LIGA GLOBAL / DE FREESTYLE» (Barlow 50 px) |
| medio | 390–800 | magenta `#E41373` | «+40» (Archivo 900, 150 px) · «TORNEOS / POR SEMANA» (Barlow 60 px) · «TODOS LOS NIVELES» en una caja blanca (Barlow 52 px) |
| derecha | 800–1200 | negro | 12 banderas en 4 × 3 · «MÁS DE» (Barlow 48 px, gris) · «21.000» (Archivo 900, 92 px, verde `#29B298`) · «MIEMBROS» (Barlow 56 px) |

Medida achicada a 400 y 300 px (lo que muestra Discord): ningún texto debajo de la carta ni fuera de su caja; el más
chico se ve de 12 px en el celular.

## De dónde salen los datos (no se escriben a mano)

- **+40 torneos por semana**: los torneos de los últimos 7 días del calendario (42 el 17/11), para abajo a la decena.
- **21.000 miembros**: `comunidad.personas` del lobby (21.386 el 17/11), para abajo al millar. ⚠️ Son las personas de
  los servidores donde está el bot, no gente anotada en la Liga (los raperos con puntos de la temporada eran 804).
- **Las banderas**: los 12 países con más raperos en `paises` del lobby, sin Emiratos ni Brasil (Dlx, 22/09: «no
  deberían existir»).
- **La carta**: la de quien invita (`liga.cartaUrl(k, liga.cartaDe(k))`), como la miniatura de hoy (`bot/og_links.py`).

## Los nombres largos (`nombres_largos.png`, `thumb_largos.py`)

⚠️ **La 4b tal cual sólo entra con nombres de hasta 3 letras.** Con «Makmah» (6, la mediana de la Liga) la etiqueta
«MAKMAH TE INVITA» ya invade el magenta, y con los largos cruza la miniatura entera. En la Liga el 90 % de los nombres
tiene 10 letras o menos, pero hay de 21 («Lautaro la sinceridad»), una sola palabra de 29 y uno en broma de 48.

La regla (a la izquierda de la hoja, cómo queda sin ella; a la derecha, con ella):

1. Si «NOMBRE TE INVITA» entra en una línea a 54 px en el ancho de la columna (342 px), va así: es la 4b guardada.
2. Si no, el nombre va en su propia etiqueta y «TE INVITA» en otra debajo. El nombre se achica de 54 a 44 px hasta entrar.
3. Si ni a 44 entra, pasa a dos líneas cortando por palabras; si aun así no entra (una palabra sola, o más de dos
   líneas), termina en «…». Nunca baja de 44 px: a 300 px son 11 px.
4. La carta llena lo que queda entre las etiquetas y «Liga Global de Freestyle», sin pisar ninguno.

⚠️ **Se mide con las fuentes ya cargadas** (`document.fonts.ready`): medido antes, con la fuente de reemplazo, «DLX TE
INVITA» parecía no entrar y se partía en dos.

## La que salió (6.44): `final_dlx.png`, `final_nombres.png`

Dlx eligió «la barra de abajo» de tres lugares para el llamado, y: *«quita liga global de freestyle debido a que eso
estará en el link»* y *«el premio no es 500 puntos… mejor solo decir gana una recompensa»*. Quien entra por un link se
lleva los 500 Puntos de bienvenida (`REF_BIEN`), pero también arranca con 5.000, tiene la bienvenida de su primera semana
y su carta con el nivel 1: por eso «una recompensa» y no un número.

- La barra: blanca, de lado a lado, 92 px de alto, «ENTRA AHORA Y GANA UNA RECOMPENSA» (Archivo 900, 48 px).
- Sin «Liga Global de Freestyle»: la carta ocupa lo que queda bajo el nombre.
- Vive en `web/src/og_link.jsx` (`Ref`, clases `og-r4-`) y la foto la saca `bot/og_links.py`, que le pasa los números y
  las banderas en la ruta (`t`, `m`, `b`, de `_vitrina()`) para que entren en la huella.

**6.47**: Dlx, «lo que dice Makmah te invita podría ser más pequeño… y quizás recta»: la etiqueta a 40 px (34–32 para los
largos) y la carta sin girar, hasta 420 px de alto. `final_dlx.png` y `final_nombres.png` ya son ésta.

**6.49**: Dlx, «una cabecera parecida a la de abajo que diga X te invitó, centrado» y «entra ahora y gana un premio, y
abajo a los costados la temporada y el logo de UL en negrito». `final_dlx.png` y `final_nombres.png` ya son ésta.

**6.51**: Dlx, «haz lo blanco, sus líneas menos altas» y «una banderita con un más»: franjas de 64 y 72 px, 11
banderas y «+N». `final_dlx.png` y `final_nombres.png` ya son ésta.

**6.52**: «agrega un ícono o emoji al costado de todos los niveles»: la escalera de la página (`Ico n="subir"`), en SVG.

## Reemplazada por la de cine (18/11/2026)

Dlx, de las miniaturas nuevas de las páginas: *«en general me gusta más eso de estilo cine»*, y de las dos versiones de
la invitación en ese estilo: *«depende de si el usuario tiene una carta o no»*. Desde entonces el link de invitación sale
con un momento real de batalla en blanco y negro (el lenguaje de la intro y de la pantalla de carga) y en dos armados:

- **A, con carta**: el nombre, «te invitó», la carta a la derecha, «Entra ahora y gana un premio», «más de 40 eventos por
  semana» y «más de 21.000 miembros».
- **B, sin carta**: «¡NOMBRE te invitó a la Liga!» a lo ancho, los mismos datos y «14 socios».

Vive en `web/src/og_link.jsx` (`Ref`, clases `og-c-`, `DISENO_REF = 'ref-cine-1'`); los números los manda
`bot/og_links.py` (`_vitrina()`: `t`, `m`, `s`, con «más de» siempre verdadero: 40 justos dicen «más de 30»). Los dos
fondos están en R2 (`og/fondos/t1/invita_a.webp` y `_b`), ya encuadrados con la cara arriba y fuera del texto: son caras
de gente real, por eso no están en el repo. Las maquetas, en el artifact privado
https://claude.ai/artifact/AB6H3Gn4nU7GK8iy12wwPL. **La 4b de arriba queda como preset**: volver a ella es volver a
este código en git (`git log -- web/src/og_link.jsx`).
