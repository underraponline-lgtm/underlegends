/* ══════════════════════════════════════════════════════════════
   PARA PEGAR EN `Index.html` DEL WEBAPP PUBLICO (proyecto del Oficial).

   Reemplaza el bloque que hoy empieza en `const RANK_TIERS = [` y
   termina en `const MIN_EV_RANGO = 8;` — son tres constantes seguidas.

   🔴 POR QUE NO LO SUBI YO: el API de Apps Script **no deja escribir con
   una cuenta de servicio**. Devuelve
   `403 User has not enabled the Apps Script API`, que pide un
   interruptor por usuario (script.google.com/home/usersettings) que una
   cuenta de servicio no tiene. Leer si puede; escribir no.

   QUE CAMBIA Y POR QUE
   --------------------
   · De SEIS tramos a OCHO. Es el ultimo de los cinco lugares donde vive
     el rango. Hoy la pagina dice `S 65` y la tarjeta dice `S 62`, asi
     que alguien ve «A» en el ranking, tira /card y le sale «B».

   · Los colores pasan a ser los de la tarjeta (`comun/rangos.py`), asi
     que la pagina y la carta muestran el mismo tono.

   · Los nombres pasan a ser los materiales —amatista, diamante, oro...—
     que son los nombres canonicos del proyecto y los que se ven en la
     carta. Los de antes eran seis descripciones para seis tramos: con
     ocho habria que inventar dos.

   · ⚠️ `MIN_EV_RANGO` PASA DE 8 A 10, y no es cosmetico: es el requisito
     real de la Competitiva (`comun/requisitos.py`). La pagina usa ese
     numero en ONCE lugares —«Falta N EV», el recuadro del win rate— asi
     que hoy le dice a quien tiene 8 o 9 eventos que ya tiene rango
     cuando la tarjeta no se lo da.

   Generado por `python sheet/webapp_rangos.py`. Verificado con
   `node --check`: compila.
   ══════════════════════════════════════════════════════════════ */

const RANK_TIERS = [
  { rank: 'SSS', min: 82,  color: '#C77DFF', name: 'Amatista' },
  { rank: 'SS',  min: 73,  color: '#8FE8FF', name: 'Diamante' },
  { rank: 'S',   min: 62,  color: '#FFD24A', name: 'Oro' },
  { rank: 'A',   min: 48,  color: '#FF6B7A', name: 'Rubí' },
  { rank: 'B',   min: 37,  color: '#5CE6A5', name: 'Esmeralda' },
  { rank: 'C',   min: 26,  color: '#6B8FE8', name: 'Zafiro' },
  { rank: 'D',   min: 18,  color: '#D8DEE8', name: 'Plata' },
  { rank: 'E',   min: 0,   color: '#C98A4B', name: 'Bronce' }
];
const RANK_COLOR = { SSS:'#C77DFF', SS:'#8FE8FF', S:'#FFD24A', A:'#FF6B7A', B:'#5CE6A5', C:'#6B8FE8', D:'#D8DEE8', E:'#C98A4B' };
const MIN_EV_RANGO = 10;
