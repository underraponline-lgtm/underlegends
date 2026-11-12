# Las imágenes de los banners de `eventos-hoy`

Una escena por servidor, **distinta de la de su VS** (`bot/vs_fondos/`). Dlx, 11/11/2026: *«ese thumbnail que quizás sea uno
diferente a los que los de vs vivo ya usan»*; y al elegir: la imagen **a todo el ancho, sin la franja**, *«más completa»*.
La usa `herramientas/banners_eventos.py` para dibujar `bot/paginas/banners/<sv>.jpg`.

Figma AI (`generate_image`), `gemini-3.1-flash-image`, 1376×768, en el archivo «UL · banners de eventos-hoy»
(`NdQ9vB3Ytp01Qcd2Yinh0a`). Se guardan en JPG calidad 86. ⚠️ Cuesta créditos de Figma: el 11/11 se acabaron con 5 imágenes.

## Lo que pide cada una

Todas piden lo mismo además de la escena: **el motivo arriba a la derecha** y el lugar entero con detalle hasta los bordes,
**abajo a la izquierda un poco más oscuro** porque ahí van el logo y el nombre; y nada de texto, logos ni gente.

El molde: *Wide cinematic key art, full-bleed background for an event banner. [ESCENA, con el motivo «in the upper-right
third of the frame» y «the whole … filled with detail around it: …»]. The scene fills the entire frame edge to edge; the
lower-left area is a little darker but still full of detail, because white text goes there. Palette only [PALETA].
Highly detailed, [TONO], dramatic, not minimalist. Absolutely no text, no letters, no numbers, no logos, no people, no
faces, no watermark.*

Cada tema sale de su etiqueta (`tag` de `datos/servidores.json`) y de su paleta del VS, y **no repite la escena de su VS**:

| servidor | etiqueta | escena (su VS es otra cosa) | paleta | estado |
|---|---|---|---|---|
| DRA | ENTRENAMIENTO | estudio de ensayo: micrófono bajo un foco azul, amplis, consola, cables | navy y azul real #3D5BFF | ✅ 11/11 |
| DDS | EXCLUSIVIDAD | el salón VIP: telón de terciopelo abierto, micrófono en un foco frambuesa, reservados, barra | negro y frambuesa #AD1457 | ⏳ |
| DDF | ESPECTÁCULO | arena cósmica: plataforma de obsidiana con micrófono, energía azul y violeta, losas flotando | negro, violeta y azul #5FA8FF | ⏳ |
| ACAD | ACADEMIA | biblioteca de una academia: atril de mármol con micrófono bajo la luz dorada, estantes, mesas | negro y oro #EACB0C | ⏳ |
| FFA | COMUNIDAD | una terraza preparada para un cypher: anillo de parlantes, micrófono en un círculo de luz, guirnaldas de luces, confeti en el piso | violeta #1A0630 y magenta #EC48DC | ⏳ |
| SR | TALENTOS | una arena hundida en un cañón del desierto al atardecer: micrófono sobre un pedestal de piedra, escamas de serpiente talladas en las paredes, arena y brasas | negro, naranja #C2540A y ámbar #FFB03A | ⏳ |
| FRZ | HISTORIA | un museo del hip-hop abandonado y congelado: vitrinas con vinilos, tornamesas y micrófonos con escarcha | negro y turquesa #26B3A6 | ⏳ |
| URBF | NUEVA GENERACIÓN | un skatepark de noche: rampas, un micrófono en la plataforma bajo reflectores naranjas | negro, carbón y naranja #EA7206 | ⏳ |
| FFS | EVOLUCIÓN | una cabina de grabación del futuro: ondas de sonido en hologramas, micrófono en luz pervinca | índigo #2E2A78 y pervinca #8E9BFF | ⏳ |
| FVS | COMPETITIVO | un salón de campeones de mármol: trofeo plateado y corona de laurel, micrófono en un podio bajo luz blanca fría | negro, plata #C9CDD4 y blanco | ⏳ (su VS no tiene escena) |
| FDS | OPORTUNIDADES | un pasillo oscuro de backstage que se abre a un escenario enorme y encendido | negro y violeta #662EAC | ⏳ |
| LKR | EXPERIMENTAL | un cenote en la selva: agua que brilla, micrófono sobre un altar de piedra en un haz de luz azul eléctrica, lianas | negro, piedra y azul #1A5FFF | ⏳ |
| CH | CULTURA | una esquina de barrio de noche: barbería y disquería cerradas, micrófono bajo un farol dorado, cajones de vinilos, un boombox | negro, carbón y oro #F2A900 | ⏳ |

**DRA.** Wide cinematic key art, full-bleed background for an event banner. A packed underground rehearsal studio at night seen wide: a vintage chrome microphone on a stand under a hard royal blue spotlight in the upper-right third of the frame, and the whole room filled with detail around it: acoustic foam panels, stacked amplifiers and speakers, a mixing desk with glowing blue meters, coiled cables, a worn rug, posters-free brick walls, blue haze and dust in the light. The scene fills the entire frame edge to edge; the lower-left area is a little darker but still full of detail, because white text goes there. Palette only near-black, deep navy and electric royal blue (#3D5BFF). Highly detailed, gritty, dramatic, not minimalist. Absolutely no text, no letters, no numbers, no logos, no people, no faces, no watermark.
