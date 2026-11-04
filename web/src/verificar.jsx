// ✅ VERIFICARME, EL REMAKE (02/11/2026). Dlx: «terminar de REMAKEAR cada pagina exceptuando INICIO» y «Publica y haz
// todo… sube todo». El trámite es el de siempre —`Verificar` de cuenta.jsx: qué te falta, con el botón que lo arregla, y
// el bot te anota— y lo que cambia es la página alrededor, que era esa caja sola con media pantalla vacía en la compu:
// - LO QUE SE ABRE, al costado: las cuatro tarjetas con lo que pide cada una, del payload (`requisitos`, que sale de
//   comun/requisitos.py), cada una con la de alguien de verdad, como en la Guía; y tu perfil.
// - EL BOTÓN PRIMERO (la crítica de la tanda: con los pasos arriba quedaba a 800 px, debajo de la pantalla de una compu).
// - LOS CINCO PASOS, debajo, mientras no empezaste. Después los dice la lista de `Verificar`, con el estado de cada uno:
//   dos listas de lo mismo, una al lado de la otra, se contradirían.
// - LO QUE PIDE DISCORD, también sólo antes de empezar: después ya lo diste. Con un error, queda lo de `/verificar`.
// ⚠️ VERIFICARTE ABRE TU PERFIL Y LA DE SERVIDOR (2.41); las otras tarjetas tienen su requisito. «Abre tus tarjetas»
// prometía de más.
import { useEffect } from 'react';
import { Verificar, useVerif } from './cuenta.jsx';
import { Carta, Ico } from './piezas.jsx';
import CSS_PAGINA from './css/verificar.css?inline';
import { usarCss } from './css.js';

usarCss('verificar', CSS_PAGINA);

const W = window;
const PASOS = [['Tu Discord', 'Entras con tu cuenta.'], ['Discord Rap Español', 'Si todavía no estás, el bot te mete.'],
  ['Las reglas de DRA', 'Las aceptas cuando Discord te muestra el servidor.'], ['Tu país', 'Lo eliges y el bot te pone ese rol en DRA.'],
  ['El rol de Miembro', 'Te lo da el bot solo, y con él sale tu tarjeta de Servidor.']];
// el orden en que se abren: la de Servidor sale al verificarte; las otras piden algo más
const ORDEN = ['servidor', 'temporada', 'competitivo', 'pais'];

// lo que pide cada tarjeta además de estar verificado, en una frase («Con 10 eventos.»). Un «cruce» no se entiende solo
// en la página de alguien que recién llega: se dice qué es (`requisitos.js`: un 1 contra 1, o cada rival de un triple)
function queMas(pide) {
  const r = (pide || []).filter((p) => !/verificad/i.test(p));
  if (!r.length) return 'Al verificarte.';
  const cruces = r.some((p) => /cruce/i.test(p)) ? ' Un cruce es un 1 contra 1, o cada rival de un triple, en la llave de un evento.' : '';
  return 'Con ' + (r.length === 1 ? r[0] : r.slice(0, -1).join(', ') + ' y ' + r[r.length - 1]) + '.' + cruces;
}

function Abre({ liga, listo }) {
  const reqs = (liga.d.requisitos || []).slice().sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));
  // ✅ ya verificado, las que tiene se muestran con SU carta (04/11/2026): lo que se abrió, no lo que se abre
  const yo = listo ? liga.yo : null;
  // la de ejemplo: la del mejor que la tiene (son cartas de verdad, no dibujos)
  const ejemplo = (id) => liga.oficiales().find((f) => (f.c || []).includes(id));
  return (
    <ul className="vf-abre">
      {reqs.map((x) => {
        const mia = !!(yo && (yo.c || []).includes(x.id));
        const f = mia ? yo : ejemplo(x.id);
        return (
          <li key={x.id}>
            {f ? <Carta liga={liga} k={f.k} cual={x.id} cls="vf-carta" abre={false} /> : <span className="vf-carta vf-sin" aria-hidden="true" />}
            <div><b>{x.titulo}</b><span>{mia ? 'Ya la tienes.' : queMas(x.pide)}</span>{x.mide ? <small>{x.mide}</small> : null}</div>
          </li>
        );
      })}
      <li>
        <span className="vf-carta vf-ico" aria-hidden="true"><Ico n="perfil" t={30} /></span>
        <div><b>Tu perfil</b><span>{yo ? 'Ya lo tienes.' : 'Al verificarte.'}</span><small>Con tu foto y tus redes.</small></div>
      </li>
    </ul>
  );
}

export function PaginaVerificar({ liga, dc }) {
  useEffect(() => { W.scrollTo(0, 0); }, []);
  const v = useVerif();
  // ¿todavía no empezó? Las condiciones de la primera caja de `Verificar` (cuenta.jsx): si cambian allá, cambian acá
  const listo = (dc && dc.rapero) || (v && v.listo);
  const inicio = !listo && !(v && v.olvido) && (!v || (v.cargando && !v.enDra));
  return (
    <div className="vf">
      <div className="escena vf-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.9, '--mo-c2': '#E41373' }}>
        <section className="vf-cab">
          <span className="tag">TU CUENTA</span>
          <h1 className="hero-ev largo">Verificarme</h1>
          <p className="hero-p">Se hace una vez, desde acá, y abre tu perfil y tu tarjeta de Servidor.</p>
        </section>
      </div>
      <div className="vf-cuerpo">
        {/* lo que pide Discord va debajo del trámite y no al costado: habla del botón, y al costado dejaba 400 px vacíos
            debajo del trámite en la compu */}
        <div className="vf-izq">
          <section className="vf-tramite" aria-label="Tu verificación">
            <Verificar liga={liga} dc={dc} nota={false} />
            {inicio ? (
              <div className="vf-como">
                <h3>Cómo es</h3>
                <ol className="vf-pasos">{PASOS.map(([t, d], i) => (
                  <li key={t}><span>{i + 1}</span><b>{t}</b><small>{d}</small></li>
                ))}</ol>
              </div>
            ) : null}
            {v && v.error ? <p className="vf-nota">También puedes verificarte en Discord, con <code>/verificar</code>.</p> : null}
          </section>
          {inicio ? (
            <section className="vf-pide" aria-labelledby="vf-pide-t">
              <h2 className="vf-h" id="vf-pide-t"><Ico n="candado" t={20} />Lo que pide Discord</h2>
              <ul>
                <li><b>Ver tu usuario</b><span>para saber quién eres.</span></li>
                <li><b>Unirte a servidores por ti</b><span>para meterte en Discord Rap Español si todavía no estás.</span></li>
              </ul>
              <p>Se usan mientras te verificas y no se guardan. También puedes verificarte en Discord, con <code>/verificar</code>.</p>
              <a className="te-link" href="/privacidad">Cómo se cuidan tus datos</a>
            </section>
          ) : null}
        </div>
        <aside className="vf-lado" aria-labelledby="vf-abre-t">
          <h2 className="vf-h" id="vf-abre-t">{listo && liga.yo ? 'Lo tuyo' : 'Lo que se abre'}</h2>
          <Abre liga={liga} listo={listo} />
        </aside>
      </div>
    </div>
  );
}
