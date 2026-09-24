# Cómo se llegó hasta acá

Notas de contexto para quien retome. No es un changelog: son las decisiones que
costaron y los errores que conviene no repetir.

## Lo que más tiempo ahorró

**Medir en vez de mirar.** Casi todos los "esto se ve raro" tenían un número
detrás. El desbalance del TAG eran 13.9px. Los huecos de la bandera eran 19
contra 8. El logo de un estilo se veía como una astilla porque su dibujo ocupaba
el 40% de su propio viewBox.

**Renderizar con y sin el elemento y restar las dos imágenes.** Es la única
medición confiable cuando lo que buscás está tapado o es del mismo color que lo
que lo rodea. Resolvió el círculo de la corona, el anillo de los aros y la
extensión real de los rombos rotados.

**Verificar que un cambio invisible sea invisible.** Al borrar código muerto, el
render tiene que salir con el mismo hash MD5. Si sale distinto, algo se rompió.

## Errores que costaron turnos

- **Regex sobre CSS multilínea.** Se come `.card` entero. Pasó dos veces antes
  de esta sesión y por eso se escribió un parser que respeta comentarios.
- **Medir la caja en vez de lo pintado.** Un rombo rotado 45° ocupa √2 veces su
  caja. El flex lo mide sin rotar.
- **Buscar un color para encontrar un elemento** cuando ese elemento es del
  mismo color que lo que lo tapa.
- **Umbrales fijos sobre imágenes de distinta procedencia.** Con los 16 estilos
  no había un número que funcionara para todos, porque unos son siluetas macizas
  y otros trazo fino. Lo que los separaba era el color, no el brillo.
- **Duplicar un elemento al moverlo.** El estilo se mudó de la columna a la fila
  de abajo pero no se sacó de la columna, así que aparecía dos veces.
- **Cargadores que filtran por extensión.** Al pasar los estilos de SVG a PNG,
  el generador dejó de cargarlos y no lo avisó.

## Sobre los ajustes chicos

Varios pedidos fueron de 0.1 y 0.2 píxeles. A 300px de ancho eso no se ve: el
navegador redondea al pintar. El salto mínimo que se nota es de 1px. Cuando algo
"no termina de cerrar", suele ser más útil armar tres versiones con saltos
visibles y elegir mirando, como se hizo con las paletas, con el PRE y con las
cuatro versiones del bloque de abajo.

## Lo que funcionó para decidir

Una captura de la carta con líneas dibujadas encima. En un solo mensaje quedó
claro dónde va la foto y dónde el logo, sin ambigüedad y sin ida y vuelta.
