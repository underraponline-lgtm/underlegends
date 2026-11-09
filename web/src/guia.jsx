// Los textos de la Guía (`#/guia`): las palabras, las preguntas, la semana, el Most Wanted y la Tienda, y lo que pide
// cada tarjeta dicho para alguien nuevo. La página es guia2.jsx desde el 02/11/2026 (Dlx: «Publica y haz todo») y los
// importa de acá: hay una sola copia. La Guía de antes —la de la 2.02 (Dlx, 03/10/2026: «2. A»)— vivía en este archivo
// y se borró al publicar el remake.
//
// ⚠️ LOS NÚMEROS SALEN DE DONDE SE CALCULAN: los requisitos de `comun/requisitos.py`, los rangos de `comun/rangos.py`,
// los puntos de `Config` y los pesos de `sheet/ovr.py` y `sheet/competitivo.py` (`_guia()` de bot/subir_web.py). Acá no
// se escribe ninguno. Lo que es texto es el de la Guía de app.js (index.html), ordenado por tema.
import * as RQ from './requisitos.js';

// ✍️ lo que pide cada tarjeta, dicho para alguien nuevo (Dlx, 07/10/2026: «sé más descriptivo»). El número sale del
// payload («10 eventos», de `comun/requisitos.py`); qué es y cómo se consigue, de `requisitos.js`
export const pideLargo = (p) => {
  if (p === 'nada') return 'Sin requisito';
  if (/verificad/i.test(p)) return RQ.verificadoGuia;
  if (/pase/i.test(p)) return RQ.paseGuia;
  const m = /^(\d+)\s+(.+)$/.exec(p);
  return m ? RQ.queEs(m[2], Number(m[1])) : p;
};

// las palabras de la Liga, por tema (el texto de la Guía de siempre)
export const MW_TIENDA = [
  ['Most Wanted', 'Los buscados de la semana{MW}, de lunes a lunes, cada uno con su recompensa. El primero que le gana a uno en un evento de la Liga lo caza y cobra; si nadie lo caza y jugó, sobrevive y se lleva la mitad. Lo cobrado suma a tus Puntos de la Temporada, nunca al Competitivo, y además el 10 % va a tus Puntos de Tienda.'],
  ['El Elegido', 'Uno de los buscados lo elige la gente: mientras corre un Most Wanted se vota quién es buscado en el siguiente, y el más votado entra como «El Elegido». Vota cualquiera que entre con Discord; nadie se vota a sí mismo, y hacen falta 3 votos.'],
  ['El ×2 votado', 'Durante la semana se vota qué servidor se lleva el ×2 la siguiente: el más votado sale del sorteo del lunes con ×2 como mínimo. Se puede votar a cualquiera, también al tuyo. Hacen falta 3 votos.'],
  ['Puntos de Tienda', 'Una moneda aparte de los puntos del ranking: todos arrancan con los mismos y se ven en la Tienda, entrando con Discord. Se ganan cazando, con tu racha, abriendo promos, subiendo en el Ranked y con los MES AWARDS; en la Tienda están todas las formas y en qué gastarlos.'],
  ['Precio por cabeza', 'Cualquiera pone Puntos de Tienda sobre un rapero de la temporada. El primero que le gana en un evento de la Liga se los lleva: esos Puntos de Tienda y lo mismo en su Temporada. Si nadie lo caza en la semana, vuelven a quien los puso. Nadie ve quién puso un precio.'],
];
export const SEMANA = [
  ['Multiplicador', 'Cada lunes a las 11 AM (hora del este) se sortea uno por servidor: esa semana, los puntos de Temporada de sus eventos valen ×0,5 a ×5. El Competitivo y el Most Wanted no cambian.'],
  ['Evento dorado', 'Cada semana, el primer evento de un servidor desde un día sorteado vale ×3 encima de su multiplicador. Se sabe desde el lunes.'],
  ['Guerra de servidores', 'Cada semana los servidores se enfrentan de a dos: gana el que más puntos hace por persona en sus eventos, y la semana siguiente lleva ×1,5.'],
  ['Copa de la Liga', 'Cada evento de 8 o más le suma a su organizador (el «Organiza:» del anuncio) la gente que juntó. El primero de la semana organiza la Copa de la siguiente: su próximo evento vale ×2.'],
  ['Semillero', 'Cada semana gana el servidor que más gente nueva trae (gente que juega por primera vez en su vida en la Liga), en proporción a su gente y con 3 como mínimo. Lleva ×1,5 la semana siguiente.'],
  ['Meta de comunidad', 'Cada lunes, cada servidor recibe una meta de gente distinta en sus eventos (un 10 % más que su promedio). Si la junta, todos los que jugaron ahí esa semana suman +10 %.'],
  ['Bonos', 'Tu segundo evento de la temporada vale ×1,5 si lo juegas dentro de los 7 días del primero. En una semana, jugar en 3 servidores da +1.500 y jugar 3 días distintos, +1.000. Nada de esto toca el Competitivo.'],
  ['Clásico', 'Cuando dos se cruzan en un duelo en su tercer evento (o más), es un Clásico: la llave lo marca con cómo venían, y el que gana suma +10 % en ese evento. Cuentan los eventos, no las batallas. Las rivalidades no se borran con la temporada.'],
  ['Misiones', 'Tres por semana, las mismas para todos, que se renuevan el lunes a las 11 AM (hora del este): se cumplen jugando y cada una suma puntos a tu Temporada; las tres juntas, un bono. Están en el Ranking.'],
  // ⚠️ «piedra» y no «rango» (02/11/2026): en la Guía el rango es la letra de E a SSS, y las de Hierro a Mítico son las
  // piedras del ELO, como las llama la página del Ranked (divisiones.jsx)
  ['Ranking ELO', 'Como el Ranked de Brawl Stars, desde el 2 de noviembre: tu piedra sale de tu ELO —tu nivel según a quién le ganas y con quién pierdes en las batallas 1v1— y subes o bajas con él. Hierro, Jade, Zafiro, Rubí, Diamante y Mítico, cada una con subniveles I, II y III. Se mira cada lunes; la primera vez que llegas a cada piedra cobras Puntos de Tienda, y al final de la temporada hay premio según la más alta que alcanzaste. Antes eran las Divisiones: una tabla por semana con los puntos de Temporada, en grupos de 30.'],
  // ⚠️ decía «cada Tarea de la semana es un nivel», que es de antes de la XP (2.46): se corrigió con lo de «sé más
  // descriptivo» (Dlx, 07/10/2026)
  ['Pase de rapero', 'Para los miembros de Discord Rap Español: 30 niveles por temporada. Las Tareas (diarias, semanales y de toda la temporada) dan XP, y la XP te sube de nivel; cada nivel paga Puntos de Tienda. El primero (dos Tareas diarias o una semanal) da tu tarjeta de Temporada, y otros una insignia, un título o tu nombre en dorado. Están en la página del Pase.'],
  ['Premios de la semana', 'Al cerrar cada semana: la figura (más puntos), la revelación (la figura de los que debutaron), el cazador del Most Wanted y el servidor que más gente movió. La figura y la revelación dan insignia.'],
  ['Insignias', 'Lo que te ganaste, para siempre: debut, podio, campeón, racha, duelos, Most Wanted… Están en tu perfil, con las que te faltan.'],
  ['Con tiempo', 'Los eventos anunciados con 12 horas o más de anticipación llevan 📣 en «Lo que viene» y en el calendario.'],
];
export const PALABRAS = [
  ['OVR', 'El número de tu temporada, de 40 a 99. Ordena el ranking y es el que lleva tu tarjeta de Temporada.'],
  ['Score', 'El número del Competitivo, de 0 a 100. Mide la calidad y no la cantidad: de él sale tu rango.'],
  ['Rango', 'La letra, de E a SSS. Es una sola por persona y es la misma en todas tus tarjetas.'],
  ['Racha', 'Eventos seguidos llegando arriba de la llave: la final si es de menos de 16, la semifinal de 16 a 31, cuartos de 32 a 63 y octavos de 64 o más. En Duelos, duelos ganados seguidos.'],
  ['Evento', 'Un torneo de cualquier servidor asociado a la Liga Global, con su llave. Cada uno en el que participas cuenta, ganes o pierdas: son los que pide la Competitiva.'],
  ['Duelo', 'Una batalla uno contra uno. Los triples, los de cuatro y los de equipos no cuentan: ahí no hay un solo rival.'],
  ['OVR de liga', 'El número de tu tarjeta de liga, de 40 a 99. La mitad mide cómo vas contra el líder y la otra mitad cómo te va por batalla: tus puntos (ganar directo da más que ganar en réplica), tu PTB y a quién le ganaste. Ser MVP de una jornada y la racha suman, y con pocas batallas no se llega arriba.'],
  ['OVR Nacional', 'El número de tu tarjeta de País, de 40 a 99. Sale de tu Score y del de los cinco mejores de tu país, y con pocos eventos baja por la confianza, la misma del Competitivo.'],
  ['Stats de la tarjeta de País', 'EVN y EVI: eventos en los que te cruzaste con alguien de tu país y con alguien de otro. COM: compatriotas a los que venciste. TOP: el mejor rival de otro país que venciste, con el mejor puesto que tuvo en su país esta temporada y su bandera. DNA y DIN: duelos ganados sobre jugados contra tu país y contra otros.'],
  ['Cruce nacional', 'Cruzarte con alguien de tu mismo país en una llave: en un 1 contra 1 o en un triple (cada rival del triple es un cruce). Con alguien de otro país es internacional. La tarjeta de País pide de los dos; un triple no cuenta como duelo para el Ranking Duelos ni el Win%.'],
  ['Win%', 'Duelos ganados sobre duelos jugados.'],
  ['Podio', 'Terminar primero, segundo o tercero en un evento.'],
  ['Walk-in', 'Entrar a una llave ya empezada, saltándose rondas. Cobra menos, porque se saltó camino.'],
  ['Revivido', 'Volver a la llave después de caer. Cobra su primer puesto entero y una parte del final.'],
  ['Llave', 'El cuadro de un evento, ronda por ronda. Se abre desde «Ver la llave».'],
  ['Temporada', 'La T1 es la primera. El Competitivo se mide dentro de cada temporada y vuelve a cero en la siguiente.'],
  ['Tu servidor', 'El que representas en la Liga: lo eliges en Mi cuenta, entrando con Discord, y sale en tu perfil y en el Ranking. Si no eliges, no se muestra ninguno. Al arrancar la temporada se cambia libre; después, una vez por temporada. Tu tarjeta de Servidor sigue siendo la de donde juegas.'],
  ['Crew', 'Tu equipo. Suma los puntos de su gente; para tener puesto necesita tres raperos en la temporada.'],
  ['Verificado', 'Tener el rol de Miembro en Discord Rap Español (DRA), con tu cuenta y tu país. Se hace una vez, en «Verificarme» (Mi cuenta): entras con Discord, eliges tu país y el bot te mete al servidor y te da el rol. Sin verificarte no hay tarjetas: verificarte desbloquea tu Servidor, y con el nivel 1 del Pase, tu Temporada.'],
  ['Bloqueada', 'La tarjeta que todavía no te ganaste: dice cuánto te falta.'],
  // ⭐ el nivel de cada uno, que no es el del Pase (14/10/2026)
  ['Nivel', 'El tuyo, no el del Pase: dice qué tan activo eres en la Liga y abre los temas de la página (en el nivel 2, 3 y 5). Sube jugando eventos (+10 cada uno), cada día que entras (+2) y con lo que haces: mirar una llave en vivo, seguir raperos, votar, felicitar, apostar, poner precios, reportar un error que se corrigió, activar la campana, mostrar tus redes, ponerle fondo a tu perfil o foto a una tarjeta y las Tareas del Pase. Cada cosa cuenta una vez y con tope: en Mi cuenta, «Cómo subir de nivel».'],
  ['Felicitar', 'En Publicaciones, un toque en un logro (un campeón, un rango, el Most Wanted), uno por persona. Se ve cuántos felicitaron, nunca quiénes, y a quien felicitan le llega un aviso.'],
];
export const PREGUNTAS = [
  ['¿Cómo pido mi tarjeta?', <>En Discord, con <code>/card</code>. Son dos pasos: verifícate (entrando con Discord en <a href="#/cuenta">Mi cuenta</a>) y se desbloquea tu Servidor; cumple tu primera Tarea del <a href="#/pase">Pase de rapero</a> y se desbloquea tu Temporada. La Competitiva y la de País piden además su requisito, y <code>/verificar</code> te dice qué te falta.</>],
  ['¿Cómo aparezco en el ranking?', <>Jugando un evento en un servidor de la Liga. Con una participación ya entras al ranking de Temporada.</>],
  ['¿Cada cuánto se actualiza?', <>Sola, cada media hora. De 3 a 11 de la mañana (hora del este de EE. UU.) corre dos veces.</>],
  ['¿Por qué mi Competitiva está bloqueada?', <>Pide participar en diez eventos de cualquier servidor asociado a la Liga Global, en la temporada, y estar verificado. Hasta entonces la tarjeta sale bloqueada, con cuántos te faltan; tu perfil también lo dice.</>],
  ['¿Cómo cambio mi foto?', <>Con <code>/foto</code> en Discord, una vez por temporada.</>],
  ['¿Cómo me entero de los eventos?', <>Activa los <a href="#/avisos">avisos</a> (o escribe <code>/notify</code> en Discord): te llegan al teléfono o a la compu cuando un servidor anuncia uno. También puedes sumar el calendario de la Liga a tu Google Calendar desde <a href="#/eventos">Eventos</a>.</>],
  ['¿Mi servidor se puede sumar a la Liga?', <>Sí: escríbele a <b>@itsdlx</b> en Discord. Qué gana tu servidor y qué hace el bot, en <a href="#/socios">Socios</a>.</>],
  ['¿Cómo borro mis datos?', <>Escribe <code>/borrar-mis-datos</code> en Discord: te muestra qué se borra y, si confirmas, lo borra al instante. Todo sobre tus datos está en la <a href="privacidad.html">política de privacidad</a>.</>],
];
export const NOMBRE_EV = { '16+': '16 o más', '8-15': '8 a 15', '4-7': '4 a 7' };
export const PUESTOS = ['Campeón', 'Subcampeón', 'Tercero', 'Cuarto', 'Semifinal', 'Cuartos', 'Octavos', 'Dieciseisavos'];
