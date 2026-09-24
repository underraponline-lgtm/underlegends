# Qué tiene la carta de FIFA Mobile que la mía no

Comparando la de Mbappé 106 con mi v10/AB. Anotado antes de programar, para no
volver a improvisar.

## 1 · El marco no es UN degradé, son CINCO CAPAS

Lo que hice yo: `background: linear-gradient(...)` con clip-path. Una capa.

Lo que tiene la referencia, de afuera hacia adentro:
  1. hojas metálicas grandes por detrás (dos tonos, una oscura y una clara
     desfasada, para que se lean como volumen y no como papel)
  2. canto exterior dorado con degradé de muchas paradas
  3. bisel: un filo claro arriba y una sombra abajo, 1-2px
  4. panel interior con SU PROPIO borde fino oscuro + filo claro
  5. dentro del panel, el arte cristalino

Sin las capas 3 y 4 la carta se ve plana. Eso es lo que me está pasando.

## 2 · Las esquirlas son 3D, no polígonos planos

Las mías: un `div` con clip-path y un degradé. Se ven como banderitas.

Las de la referencia: cada hoja tiene **cara clara y canto oscuro**, con la
cara desfasada 2-3px respecto del canto. Eso es lo que da el efecto de metal
doblado. Y hay hojas **detrás** del marco y hojas **delante**, no todas en el
mismo plano.

## 3 · Adentro hay ARTE, no un degradé

La referencia tiene cristales azules facetados con vetas doradas: planos duros
en distintos tonos, no una transición suave. Mi fondo es un degradé liso con
una silueta al 25% de opacidad, que es casi nada.

## 4 · La foto está RECORTADA

El jugador no tiene fondo: se ve el marco alrededor de su cuerpo, y los hombros
tapan el canto. Nuestros avatares son fotos rectangulares con fondo, así que
nunca vamos a lograr eso sin recortar. Es una limitación de material.

## 5 · Piezas que rompen el marco a propósito

  · el escudo de arriba se monta sobre el canto
  · la gema de abajo se monta sobre el canto
  · los hombros del jugador tapan el canto

Eso ata las capas entre sí. Mi versión tiene todo adentro y prolijo, y por eso
parece un rectángulo con relleno.

## 6 · Los 8 marcos de Mbappé, para repartir entre los 9 servidores

  hielo cristalino      facetas blanco-azul, esquirlas de hielo
  verde neón            triángulos filosos, pocos y grandes
  oro TOTY              hojas de oro grandes + cristal azul adentro
  oro y azul            hojas angulares metálicas
  plata con naranja     placa lisa, canto fino, acento cálido
  azul con oro          cristal dominante, canto delgado

De ahí salen los arquetipos de abajo.
