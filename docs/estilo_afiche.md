# 🗞️ El estilo afiche

Dlx, 20/11/2026, sobre la maqueta de las imágenes semanales para redes:
*«si te soy sincero me gustan todos y de hecho me gusta este estilo. Guarda
este estilo. Aunque creí que la mejor es portada de revista»*.

Es el estilo de las **piezas gráficas**: imágenes para redes y Discord,
afiches y anuncios. **No es el de la web**, que tiene el suyo (Inicio,
remakes). Llevarlo a una página se pregunta antes.

- La maqueta: https://claude.ai/artifact/McFfUgFFjvtai2BnFotcr8 (privada).
- El código: `docs/maquetas/redes/` (`datos.py`, `maqueta.py`, `pagina.py`).

```bash
python docs/maquetas/redes/datos.py . CH FFA     # la semana real de esos servidores
python docs/maquetas/redes/maqueta.py .          # -> docs/maquetas/redes/salida/*.png, medidas
```

⚠️ **`salida/` y `datos_*.json` no se commitean**: llevan tarjetas y caras de
gente real (la regla de las fotos, ver CLAUDE.md).

---

## Una base y tres maneras de usarla

Las tres le gustan. **Para las imágenes de redes va la B.**

| | dirección | qué protagoniza | cuándo |
|---|---|---|---|
| **A** | póster de pelea | un sol negro con el anillo del servidor, la tarjeta enorme con dos ecos, el nombre gigante, una pegatina en estrella | una persona, mucho ruido |
| **B** | **portada de revista** | la cabecera con el nombre del servidor, el titular en papel rasgado, tres números grandes y las fechas abajo | **la semana de un servidor** |
| **C** | carta y ticket | la tarjeta pegada con cinta sobre papel, el número gigante, la entrada con su talón y el sello | una persona, tono de la Liga |

## La base (las tres la comparten)

**Escenario negro, más negro que blanco.** El blanco es papel, y el papel
marca lo importante, igual que en la web.

| token | valor | para qué |
|---|---|---|
| escenario | `#030304` | el fondo, siempre |
| papel | `#F2EEE6` | titulares, tickets, tiras del top 5 |
| verde | `#29B298` | la **sombra dura** del papel y las tarjetas: `12px 12px 0` |
| magenta | `#E41373` | **una** etiqueta o sello por pieza («Campeón de la semana») |
| oro | `#E7B622` | pegatinas (nota, títulos) y la corona |
| servidor | `colores_sv_marca.json` | cabecera, sol, talón, números del top |

**Letras.** Archivo 900 ancha (`font-stretch` de 118 a 125 %) en mayúsculas
para lo que se grita; Barlow Condensed 700 en mayúsculas, `letter-spacing
.14em`, para las etiquetas. Las fuentes van embebidas (`comun/fonts/embed.css`).

**Materiales.** Cada uno tiene su función en `maqueta.py`:

- **Papel rasgado**: `roto(semilla, arriba, abajo, paso, amp)` arma un
  `clip-path` dentado con semilla, así sale igual cada vez. Para la cabecera,
  un borde con `amp 8`; para el titular, los dos con `2.2`.
- **Grano**: `GRANO`, ruido SVG encima de todo. Va al 16 % en `overlay` sobre
  el negro y al 50 % en `multiply` sobre el papel.
- **Semitono**: puntos con `radial-gradient` del color del servidor, a 11 o
  12 px y con máscara para que se apaguen. Sirven para el sol y las rayas.
- **Pegatina en estrella**: `estrella(puntas, adentro)` es un `clip-path` de
  18 puntas, con una copia negra corrida 8 px detrás. En la B es un círculo
  oro con borde negro de 5 px y sombra negra de `8px 8px 0`.
- **Sello**: borde magenta de 6 px, girado −10°, con «Campeón» grande y «de la
  semana» chico.
- **Ticket**: cuerpo de papel, perforación de 4 px punteada **del lado del
  papel**, y talón del color del servidor.
- **Cinta**: dos tiras oro al 82 %, de largos y ángulos distintos
  (150 px a −38° y 115 px a +22°). Iguales y espejadas se ven hechas por
  máquina.

## Reglas (las dejó la revisión y el peor caso)

1. **El color del servidor nunca tapa la pieza.** El sol de la A es negro
   con un anillo de 14 px del color. Si va del color entero, Cypherhood
   (ámbar) se come casi la mitad de la imagen y la pegatina oro desaparece
   (1,35:1).
2. **Un servidor muy oscuro usa su versión clara.** `luz()` aclara el tono
   hasta luminancia 0,16: FFA `#26045B` → un morado legible sobre negro.
   `tinta()` elige negro o blanco encima. Lo lleno (talón, puesto) va en
   `--sv-pleno`.
3. **Nada de adornos que no dicen nada.** Se fue el código de barras del pie:
   lo reemplaza el número de la semana («N.º 47 · CH»).
4. **Sin dato no hay pieza, pero sin aviso tampoco.** Quien no tiene tarjeta
   va con su silueta (`kit._sil_vs`) sobre los rayos de su servidor y **sin**
   «Sin tarjeta»: en un festejo, el cartel sobra. En el top 5 de la A, si el
   #1 no tiene tarjeta, no se dibuja la grande y la lista ocupa todo el ancho.
5. **Los nombres largos bajan de renglón antes de achicarse.** `.fit2` en
   `AJUSTAR`: primero achica hasta un piso (96–110 px), después parte en dos
   renglones. La última palabra va pegada a su bandera (`nombre_fl()`), así
   la bandera nunca queda sola. Los nombres de eventos se achican (`.fit`) y
   no se cortan con «…».
6. **Lo que crece, crece hacia arriba.** El nombre y el ticket de la A se
   apilan desde abajo, y el ticket de la C se ancla al fondo. Con 3 eventos,
   nada pisa el pie.
7. **Historias, 1080 × 1920**: es el mismo lienzo del post, corrido a la
   zona segura (y 255), con nada clave fuera de y 250–1590. Arriba va la
   sigla del servidor en contorno, que es decoración.
8. **Se mide cada imagen**: `MEDIR` avisa si un texto se corta, si algo sale
   del lienzo o si pisa la zona de la barra de Instagram.

## Lo que todavía no está decidido

- **Las cinco del Tier 1.** La propuesta es: el campeón, el top 5, la
  historia del campeón, «El evento de la semana» y «Lo que viene». Dlx no
  contestó.
- **Dónde llegan.** La propuesta es que el dueño las baje desde «Tu
  servidor» y, si quiere, que el bot las deje en un canal suyo. Sin contestar.
