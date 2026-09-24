# TARJETA SERVIDOR — en curso

Escudo biselado 300×438, definido por un `clip-path: polygon()` sobre `.card`:

```
0% 3%, 3% 0%, 97% 0%, 100% 3%, 100% 79%,
97% 86%, 88% 92%, 66% 97.5%, 50% 100%,
34% 97.5%, 12% 92%, 3% 86%, 0% 79%
```

Esquinas cortadas arriba, laterales rectos hasta el 79%, y de ahí cierra en
punta. Es la tercera silueta del set, distinta del escudo trazado de la
Competitiva y del rectángulo de la Temporada.

```bash
python3 normal_gen.py     # lee normal_datos.json -> escribe salida/
```

## Lo que se decidió

**El color deja de venir del rango.** Los verdes, amarillos y rojos del sistema
de rangos desaparecen de esta carta. El color viene del **servidor**.

**El logo del servidor es el elemento dominante**, a color, y ocupa la columna
izquierda y toda la zona de abajo. La foto del rapero se achica y queda en el
bloque de arriba a la derecha: arranca en el 30% del ancho y llega al 58% del
alto. El logo va en `z-index:1` y la foto en `z-index:3`, así que el personaje
siempre queda por delante donde se cruzan.

**El texto va todo blanco.** Se eliminó la clase `bright`, que le ponía texto
oscuro a las cartas claras.

## Los colores de servidor

Medidos del ícono de Discord de cada uno, en `datos/colores_sv.json`:

| servidor | crudo | normalizado |
|---|---|---|
| TFC | `#540C0C` | `#971515` rojo |
| TWR | `#E40C54` | `#E40B53` rosa |
| DRA | `#546CE4` | `#2B49DD` azul |
| FTN | `#243C84` | `#253D88` azul marino |
| FRZ | `#9CFCFC` | `#11F7F7` celeste |
| SR | `#B4FC3C` | `#A1F810` verde lima |

La normalización lleva la luz a 0.34–0.52 y la saturación a 0.55–0.95 **sin
tocar el tono**. Sin eso TFC sale casi negro y FRZ casi blanco, y las siete no
se leerían como una familia.

⚠️ **SR salió verde lima, pero el archivo de logo que mandó Dlx es una cobra
naranja.** Los dos son de Snake. Falta definir cuál manda.

⚠️ **URBF y EFA no tienen ícono de Discord cargado**, así que su color está
asignado a mano y no medido.

## Lo que falta definir

1. **Dlx dijo "así no es" sobre la última versión y quedó en dar más detalles.**
   Ese es el punto de partida: preguntar antes de seguir construyendo.
2. **Las stats.** Hoy siguen las viejas: PTS, EVT, WR%, POD, **CAM** y **RCH**.
   CAM ya está dentro de POD y RCH pertenece al Competitivo, donde se llama TCH.
   Hay que elegir seis nuevas.
3. **El número.** Hoy muestra el OVR global, no el del servidor. Ese pendiente
   es de **datos**, no de diseño: el desglose por servidor existe solo para 78
   de 348 eventos.
4. **El pie** todavía dice "LIGA GLOBAL · UNDER LEGENDS", que en la Temporada se
   sacó.
5. **El TAG** usa la misma tabla que la Temporada, así que premia logros
   globales y no lo hecho en ese servidor.

## Estado del código

⚠️ **YA NO SON EL CAMINO POR DEFECTO.** El diseño acordado —escudo en la
punta, fondo del servidor, la columna a la derecha— lo arma
**`03_Servidor/generar.py`**, que ensambla las piezas canónicas de `comun/` y
`disenos/los_nueve.py` para una persona del pool, y sale ya recortado y
transparente:

```bash
python 03_Servidor/generar.py Juasmio       # el diseño vigente
python 03_Servidor/generar.py --lista       # el servidor de cada uno
python 03_Servidor/exportar_png.py --viejo Valen   # el layout de abajo
```

⚠️ **Cuatro números de la columna NO son de ese servidor**: OVR, títulos,
podios y eventos no existen en ningún pool, así que van los globales y
`generar.py` lo avisa en cada corrida. Ver `disenos/ESTADO.md`.

`normal_gen.py` y `normal_card.css` son el layout viejo de la Normal. Lo único
que se les tocó fue:

- la escalera del nombre por largo, igual que en las otras dos cartas
- un respaldo para los servidores sin ícono de Discord: usan su silueta, si no
  el generador tiraba `KeyError` y no se podía dibujar el pool completo

Todo lo del color por servidor y el logo grande se probó en scripts sueltos y
**no está aplicado a estos archivos** — y no se va a aplicar: lo aplica
`generar.py`, que no los usa.
