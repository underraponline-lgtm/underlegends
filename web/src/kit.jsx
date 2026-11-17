// 🧰 EL KIT DE CADA SERVIDOR: SU PÁGINA PRIVADA (Dlx, 17/11/2026: «un apartado específico en la página donde solamente
// el que tenga el link puede entrar, y yo obviamente, donde ahí estarían todos los beneficios, tutoriales, y finalmente
// el link con permiso de admin en su rol propio para evitar problemas así. Su tier y otras cosas»).
//
// 🔑 SIN LOGIN: el link lleva un código que no se puede adivinar (`bot/kits.py`, un HMAC de su guild) y el kit se baja de
// R2 con ese código (`kits/<código>.json`). Sin el código no se encuentra: R2 no lista sus archivos. El mismo componente
// muestra el índice de Dlx (`indice`), con el link de cada servidor. No suma visitas ni sale en el menú.
import { useEffect, useState } from 'react';
import { Ico } from './piezas.jsx';
import { QueHaceElBot } from './socios2.jsx';
import CSS_PAGINA from './css/kit.css?inline';
import { usarCss } from './css.js';

usarCss('kit', CSS_PAGINA);

function useKit(liga, cod) {
  const [k, setK] = useState(undefined);
  useEffect(() => {
    if (!/^[0-9a-f]{20}$/.test(String(cod || '')) || !liga.d.r2) { setK(null); return undefined; }
    let vivo = true;
    fetch(liga.d.r2 + '/kits/' + cod + '.json', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((x) => { if (vivo) setK(x || null); });
    return () => { vivo = false; };
  }, [cod, liga.d.r2]);
  return k;
}

// que no lo guarde un buscador: es una página que se pasa por link
function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
}

function Copiar({ texto, etiqueta = 'Copiar' }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn chico" onClick={() => {
      try { navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1600); }); } catch (e) { /* sin portapapeles */ }
    }}>{ok ? 'Copiado' : etiqueta}</button>
  );
}

function Indice({ ind }) {
  return (
    <section className="kt-sec">
      <h1 className="kt-t">Los kits de cada servidor</h1>
      <p className="kt-p">Cada link abre la página privada de ese servidor: su tier, sus beneficios, los tutoriales y el link para agregar el bot como administrador. Pásale a cada dueño el suyo.</p>
      <ul className="kt-ind">
        {ind.map(([sigla, nombre, tier, url, admin]) => (
          <li key={url}>
            <a href={url}><b>{sigla}</b><span>{nombre}</span></a>
            <small>Tier {tier}{admin === false ? ' · el bot sin Administrador' : admin ? ' · el bot es Administrador' : ''}</small>
            <Copiar texto={url} etiqueta="Copiar link" />
          </li>
        ))}
      </ul>
    </section>
  );
}

const PASOS = (k) => [
  ['Agrega el bot como administrador', <>Con el botón de arriba: Discord le crea <b>su propio rol</b> con el permiso de Administrador, ya en tu servidor. Si el bot ya está, el mismo botón le actualiza el permiso.</>],
  ['Sube su rol', <>En <b>Ajustes del servidor → Roles</b>, arrastra el rol del bot por encima de los roles de tu gente. Discord no deja que el bot le cambie el apodo a quien tiene un rol más alto que el suyo (el #N del ranking va en el apodo).{k.bot && k.bot.en && k.bot.arriba ? <> Hoy tiene <b>{k.bot.arriba} rol{k.bot.arriba === 1 ? '' : 'es'}</b> por encima.</> : null}</>],
  ['Elige sus canales con /settings', <>Escribe <code>/settings</code> en tu servidor (sólo los admins): dónde cuenta tus eventos en vivo, dónde avisa los cambios de rango, tu ranking de ascenso, dónde se usa <code>/card</code> y el #N en los apodos. Los canales vienen apagados.</>],
  ['Publica tus llaves en texto', <>El bot lee tus anuncios y tus llaves para cargar cada evento solo. Una llave en <b>texto</b> entra sola; una que es sólo una imagen hay que cargarla a mano. Cada batalla en su renglón, y el ganador marcado.</>],
  ['Entra a tu dashboard', <>Con la cuenta de Discord del dueño, en <a href={k.dashboard}>tu dashboard</a>: tu puntaje, cuántos vuelven a jugar, a quién invitar, los ajustes del bot y tu equipo de admins.</>],
];

const TIERS = [
  ['Tier 3', 'Tus eventos salen en la página, en el calendario y en los avisos al celular, y suman al ranking de Temporada. Tu página, tus ligas y tu dashboard.'],
  ['Tier 2', 'Lo mismo, y es el paso hacia Tier 1: anunciar 2 eventos o más en 4 semanas.'],
  ['Tier 1', 'Además, tus eventos cuentan para el Competitivo y los Duelos, tu gente tiene la carta de tu servidor y tienes tus propios MES AWARDS. Pide 60 puntos o más en tu dashboard, 4 eventos o más en 4 semanas, que el bot lea tus llaves casi solo y 300 miembros (se recomiendan 500).'],
];

export function Kit({ liga, cod }) {
  useNoIndex();
  const k = useKit(liga, cod);
  if (k === undefined) return <section className="kt-sec"><p className="kt-p">Cargando…</p></section>;
  if (!k) {
    return (
      <section className="kt-sec">
        <h1 className="kt-t">Este link no abre nada</h1>
        <p className="kt-p">Puede estar mal copiado, o haber cambiado. Pídele el link de tu servidor a Dlx.</p>
      </section>
    );
  }
  if (k.indice) return <Indice ind={k.indice} />;
  const b = k.bot || null;
  const bien = b && b.en && b.admin;
  return (
    <section className="kt-sec">
      <header className="kt-cab">
        {k.logo ? <img src={k.logo} alt="" className="kt-logo" /> : null}
        <div>
          <span className="kt-et">El kit de tu servidor · privado</span>
          <h1 className="kt-t">{k.nombre}</h1>
          <span className="kt-tier">Tier {k.tier}</span>
        </div>
      </header>
      <p className="kt-p">Esta página es sólo para el equipo de <b>{k.nombre}</b>: no sale en el menú y sólo entra quien tiene este link. No la compartas.</p>

      <div className={'kt-bot ' + (bien ? 'ok' : 'falta')}>
        <h2>{!b ? 'El bot en tu servidor' : !b.en ? 'El bot todavía no está en tu servidor' : bien ? 'El bot está bien configurado' : 'Al bot le faltan permisos'}</h2>
        {b && b.en && !b.admin && b.faltan && b.faltan.length ? (
          <ul>{b.faltan.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : null}
        {b && b.en && b.admin && b.arriba ? <p>Es administrador. Sube su rol (paso 2): hoy hay {b.arriba} rol{b.arriba === 1 ? '' : 'es'} por encima del suyo.</p> : null}
        <a className="btn verde kt-cta" href={k.invitar} target="_blank" rel="noopener noreferrer">
          <Ico n="ok" t={18} /> {b && b.en ? 'Darle Administrador al bot' : 'Agregar el bot como administrador'}
        </a>
        <small>Con Administrador, el bot tiene su propio rol y no le falta ningún permiso. Lo que hace y lo que nunca hace está más abajo.</small>
      </div>

      <h2 className="kt-h">Paso a paso</h2>
      <ol className="kt-pasos">
        {PASOS(k).map(([t, x], i) => <li key={i}><b>{t}</b><p>{x}</p></li>)}
      </ol>

      <h2 className="kt-h">Lo que tienes hoy</h2>
      <ul className="kt-ben">
        {(k.beneficios || []).map(([id, q, si]) => (
          <li key={id} className={si ? 'si' : 'no'}><span aria-hidden="true">{si ? '✓' : '·'}</span>{q}{si ? '' : <small> · no está en tu tier</small>}</li>
        ))}
      </ul>

      <h2 className="kt-h">Cómo funcionan los tiers</h2>
      <ul className="kt-tiers">
        {TIERS.map(([t, x]) => <li key={t} className={'Tier ' + k.tier === t ? 'tuyo' : ''}><b>{t}{'Tier ' + k.tier === t ? ' · el tuyo' : ''}</b><p>{x}</p></li>)}
      </ul>

      <h2 className="kt-h">Qué hace el bot</h2>
      <QueHaceElBot />

      <h2 className="kt-h">Tus links</h2>
      <ul className="kt-links">
        <li><a href={k.dashboard}>Tu dashboard</a><small>con la cuenta de Discord del dueño o de un admin que él sume</small></li>
        {k.invitacion ? <li><a href={k.invitacion} target="_blank" rel="noopener noreferrer">La invitación de tu servidor</a><Copiar texto={k.invitacion} /></li> : null}
        <li><a href={k.invitar} target="_blank" rel="noopener noreferrer">Agregar el bot (Administrador)</a><Copiar texto={k.invitar} /></li>
      </ul>
      <p className="kt-p">¿Dudas? Escríbele a Dlx en Discord.</p>
    </section>
  );
}
