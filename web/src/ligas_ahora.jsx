// 🔴 LAS BATALLAS DE LIGA QUE SE ESTÁN JUGANDO AHORA (Dlx, 04/11/2026). Vienen con `/api/avisos/vivo`, que la página ya pide
// cada minuto, en `window.VIVO.ligas` (`ligasAhora()` de bot/avisos.js). Va aparte de ligas.jsx porque también la usa el
// Inicio, que no baja esa página. Sin nada que mostrar no se dibuja: «sin dato no hay pieza».
import { useEffect, useState } from 'react';
import { Alguien } from './piezas.jsx';

function leer(id) {
  const xs = (typeof window !== 'undefined' && window.VIVO && window.VIVO.ligas) || [];
  return id ? xs.filter((x) => x.l === id) : xs;
}

export function BatallasAhora({ liga, id = '', cls = '' }) {
  const [xs, setXs] = useState(() => leer(id));
  useEffect(() => {
    const f = () => setXs(leer(id));
    f();
    window.addEventListener('lg:vivo', f);
    return () => window.removeEventListener('lg:vivo', f);
  }, [id]);
  if (!xs.length) return null;
  const vivas = xs.some((x) => x.e !== 'terminada');
  return (
    <section className={'lgv' + (cls ? ' ' + cls : '')} aria-label="Batallas de liga en este momento">
      <h2 className="lgv-t"><i className={vivas ? 'vivo-late' : 'quieto'} aria-hidden="true" />{vivas ? 'AHORA EN LAS LIGAS' : 'RECIÉN TERMINÓ'}</h2>
      <ul className="lgv-l">
        {xs.map((x) => (
          <li key={x.l + x.ini}>
            <a className={'lgv-c lgv-' + x.e} href={'#/ligas/' + x.l}>
              <img alt="" src={liga.logo(x.sv)} />
              <span className="lgv-tx">
                {/* 🪪 con su cara y su nombre oficial (17/11/2026; `ka`/`kb` los manda el vigía cuando sabe quién es). Sin link
                    propio: la tarjeta entera ya lleva a la liga */}
                <b><Alguien liga={liga} nombre={x.a} k={x.ka} link={false} />{x.fa ? ' ' + x.fa : ''} <em>vs</em> <Alguien liga={liga} nombre={x.b} k={x.kb} link={false} />{x.fb ? ' ' + x.fb : ''}</b>
                <small>{x.n} · {x.e === 'terminada' && x.gana ? <>Ganó <Alguien liga={liga} nombre={x.gana} k={x.gana === x.a ? x.ka : x.gana === x.b ? x.kb : ''} link={false} cara={false} />{x.como === 'replica' ? ' en la réplica' : ''}</> : x.txt}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
