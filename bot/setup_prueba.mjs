// 🧭 La prueba del /setup (bot/setup.js, 19/11/2026), sin Discord y sin Cloudflare:
//   1 · lo puro: plantillas, canales, permisos, ids, siglas, y CADA PANTALLA medida contra los topes de Discord
//       (40 componentes, 4.000 letras de texto, ids de 100), con el peor caso;
//   2 · el objeto de verdad (SQLite de Node, si hay `node:sqlite`): el borrador, el candado, el DM una sola vez, la
//       decisión de Dlx como ajuste, lo que ve el ciclo (sin quién lo corrió) y los canales elegidos en el vigía;
//   3 · el camino entero, de `/setup` a «Aplicar» y al «Que sumen» de Dlx, con un Discord simulado: qué se escribe, cuántas
//       veces y cuántos pedidos gasta cada clic. Y que repetir no duplica nada.
//
//     node bot/setup_prueba.mjs
import * as SU from './setup.js';
import * as A from './avisos.js';
import { SERVIDORES } from './worker.js';

let mal = 0, bien = 0;
const ok = (c, t, extra) => {
  if (c) bien += 1;
  else { mal += 1; console.log('  🔴 ' + t + (extra !== undefined ? '\n     ' + String(extra).slice(0, 400) : '')); }
};
const textoDe = (msg) => JSON.stringify(msg);
const ids = (msg) => { const out = []; const ver = (c) => { if (!c) return; if (c.custom_id) out.push(c.custom_id); (c.components || []).forEach(ver); if (c.accessory) ver(c.accessory); }; (msg.components || []).forEach(ver); return out; };

// ── 1 · LO PURO ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const conP = (p) => ({ member: { permissions: String(p) } });
ok(SU.puedeSetup(conP(8)) && SU.puedeSetup(conP(32)) && SU.puedeSetup(conP((1n << 41n) - 1n)) && !SU.puedeSetup(conP(268435456))
  && !SU.puedeSetup(conP(0)) && !SU.puedeSetup({}), 'lo corre el dueño, Administrador o Gestionar servidor; Gestionar roles solo, no');

const GID = '1600000000000000001', ROLBOT = '1600000000000000002';
const ROLES = [
  { id: GID, name: '@everyone', permissions: String(1024 | 65536 | 2048 | 16384 | 32768 | 1), position: 0 },
  { id: ROLBOT, name: 'Liga Global', permissions: '0', position: 3, tags: { bot_id: A.APP_ID } },
  { id: '1600000000000000003', name: 'Mods', permissions: '8', position: 5 },
  { id: '1600000000000000004', name: 'VIP', permissions: '0', position: 4 },
];
const base = SU.permisosBase(GID, ROLES, [ROLBOT]);
const oculto = { id: '1700000000000000008', type: 0, permission_overwrites: [{ id: GID, type: 0, allow: '0', deny: '1024' }] };
const soloBot = { id: '1700000000000000009', type: 0, permission_overwrites: [{ id: GID, type: 0, allow: '0', deny: '1024' },
  { id: ROLBOT, type: 0, allow: String(1024 | 65536), deny: '0' }] };
ok((base & SU.P.VER) && !(base & SU.P.APODOS) && SU.permisosEnCanal(base, oculto, GID, [ROLBOT]) === 0n
  && (SU.permisosEnCanal(base, soloBot, GID, [ROLBOT]) & SU.P.HISTORIAL) !== 0n
  && SU.permisosEnCanal(SU.permisosBase(GID, [{ id: GID, permissions: '8' }], []), oculto, GID, []) > 0n,
'los permisos en un canal: @everyone sin ver lo apaga, el rol del bot lo vuelve a prender, Administrador ve todo');
const r1 = SU.resumenPermisos({ bits: String(base), arriba: 2, rol: 'Liga Global' }, 'completa');
const r2 = SU.resumenPermisos({ bits: String(1024 | 2048), arriba: 0 }, 'leer');
const r3 = SU.resumenPermisos({ bits: '8', admin: true, arriba: 0 }, 'completa');
ok(!r1.bloquea && r1.falta.includes('Gestionar apodos') && r1.filas.some((f) => f[0] === '⚠️' && /2 roles encima/.test(f[1]))
  && r2.bloquea && !r2.falta.includes('Enviar mensajes y adjuntar') && r3.admin && !r3.falta.length,
'el paso 1: leer el historial frena, lo demás se saltea; con «Sólo leer» escribir no hace falta; el rol bajo es un aviso');

const C0 = { an: '1700000000000000001', in: '1700000000000000002', ve: '1700000000000000003', ge: '1700000000000000004' };
const cc = SU.cfgDePlantilla('completa', C0), cb = SU.cfgDePlantilla('basico', C0), cl = SU.cfgDePlantilla('leer', C0);
ok(cc.vivo === C0.ge && cc.avisos === C0.ge && cc.nick && SU.avisoEventoPrendido(cc) && cc.ganadores
  && !cb.vivo && cb.avisos === C0.ge && !cb.nick && !SU.avisoEventoPrendido(cb)
  && SU.canalesQueEscribe(cl, C0).length === 0 && cl.ligas === 'no' && cl.resumen === '' && cl.eventos_discord === false && cl.leer_chat === false,
'las plantillas: la completa prende todo en el chat general, la básica sólo los avisos de rango, «Sólo leer» no escribe nada');
const ks = new Set(Object.keys(A.CFG_BASE).concat(['eventos_discord']));
ok(['completa', 'basico', 'leer'].every((p) => Object.keys(SU.cfgDePlantilla(p, C0)).every((k) => ks.has(k))),
  'y usan sólo las claves de `cfg:<guild>` (las mismas de /settings y del panel del socio)');
let b = { pl: 'completa', c: C0, ov: {} };
b.ov = SU.tocar(b, 'vivo');
const sinVivo = SU.cfgFinal(b);
b.ov = SU.tocar(b, 'evento');
const sinEvento = SU.cfgFinal(b);
b.ov = SU.tocar(b, 'cv', C0.an);
b.ov = SU.tocar(b, 'cc', ['1700000000000000004', 'x']);
b.ov = SU.tocar(b, 'nick');
const fin = SU.cfgFinal(b);
ok(!sinVivo.vivo && sinVivo.aviso_evento === 'chat' && SU.avisoEventoPrendido(sinVivo) && sinEvento.aviso_evento === 'no'
  && fin.vivo === C0.an && fin.aviso_evento === 'no' && fin.canales.length === 1 && !fin.nick,
'el paso 4: apagar el bot en vivo deja el aviso de cada evento en el chat general; cada interruptor cambia lo suyo');
ok(SU.canalesQueEscribe(cc, C0).length === 1 && SU.canalesQueEscribe(cc, C0)[0].que.length === 4,
  'los mensajes de prueba: uno por canal, aunque ahí escriban cuatro cosas');

const CANALES = [
  { id: '1650000000000000001', type: 4, name: '🏆〘Torneos〙🏆', position: 0 },
  { id: '1650000000000000002', type: 4, name: '𝒜𝒟𝑀𝐼𝒩𝐼𝒮𝒯𝑅𝒜𝒞𝐼𝒪𝒩', position: 9 },
  { id: '1700000000000000006', type: 0, name: '👋┃bienvenida', position: 1 },
  { id: '1700000000000000001', type: 0, name: '「🏆」𝙀𝙫𝙚𝙣𝙩𝙤𝙨', position: 2 },
  { id: '1700000000000000002', type: 0, name: '📝┃inscripciones', position: 3 },
  { id: '1700000000000000003', type: 0, name: '⚖️┃veredictos', position: 4 },
  { id: '1700000000000000004', type: 0, name: '💬┃general', position: 5 },
  { id: '1700000000000000005', type: 0, name: 'anuncios', parent_id: '1650000000000000002', position: 6 },
  { id: '1700000000000000007', type: 0, name: '「📢」Anuncios', parent_id: '1650000000000000001', position: 7 },
  oculto,
  { id: '1700000000000000010', type: 2, name: 'voz general', position: 8 },
];
ok(JSON.stringify(SU.adivinarCanales(CANALES)) === JSON.stringify(Object.assign({}, C0, { ll: [], lg: [] })),
  'los canales: los encuentra solos con los nombres del lector (letras decoradas incluidas), nunca los del staff',
  JSON.stringify(SU.adivinarCanales(CANALES)));
ok(SU.adivinarCanales(CANALES.filter((c) => c.id !== C0.an)).an === '1700000000000000007' && SU.adivinarCanales([]).an === '',
  'sin un canal de eventos, «Anuncios» adentro de una categoría de torneos (como FVS); sin canales, nada');
// 🔑🏟️ las llaves y las ligas (21/11/2026)
const LL1 = '1700000000000000011', LG1 = '1700000000000000012', LG2 = '1700000000000000014', CATL = '1650000000000000003';
const CANALES_L = CANALES.concat([
  { id: LL1, type: 0, name: '🔑┃𝙇𝙡𝙖𝙫𝙚𝙨', position: 10 },
  { id: '1700000000000000013', type: 0, name: 'llaves-staff', parent_id: '1650000000000000002', position: 11 },
  { id: CATL, type: 4, name: 'LOS DOMINGOS', position: 12 },
  { id: LG1, type: 0, name: 'batallas', parent_id: CATL, position: 13 },
  { id: LG2, type: 0, name: 'resultados-sueltos', position: 14 },
  { id: '1700000000000000015', type: 0, name: 'resultados', parent_id: '1650000000000000001', position: 15 },
  { id: '1700000000000000016', type: 0, name: 'llaves', parent_id: '1650000000000000001', position: 16 }]);
ok(JSON.stringify(SU.adivinarCanales(CANALES_L).ll) === JSON.stringify([LL1, '1700000000000000016']) && SU.adivinarCanales(CANALES_L).lg.length === 0,
  'las llaves: las encuentra por el nombre (letras decoradas incluidas) y nunca las del staff; las ligas no se adivinan',
  JSON.stringify(SU.adivinarCanales(CANALES_L)));
const LIGAS_YA = [{ n: 'FMS Titans', ver: '1700000000000000017' }];
const CS_L = CANALES_L.concat([{ id: '1700000000000000017', type: 0, name: 'veredictos', parent_id: CATL }]);
const sinVer = CS_L.filter((c) => c.id !== '1700000000000000017');
ok(SU.estadoCanalLiga(LG1, sinVer, null, [])[0] === 'nueva' && /LOS DOMINGOS/.test(SU.estadoCanalLiga(LG1, sinVer, null, [])[1])
  && SU.estadoCanalLiga('1700000000000000017', CS_L, null, LIGAS_YA)[0] === 'ok'
  && SU.estadoCanalLiga(LG2, CS_L, null, [])[0] === 'no' && /categoría/.test(SU.estadoCanalLiga(LG2, CS_L, null, [])[1])
  && SU.estadoCanalLiga('1700000000000000015', CS_L, null, [])[0] === 'no' && /eventos/.test(SU.estadoCanalLiga('1700000000000000015', CS_L, null, [])[1])
  && SU.estadoCanalLiga(LG1, CS_L, null, [], [LG1])[0] === 'no' && SU.estadoCanalLiga('1', CS_L, null, [])[0] === 'no'
  && SU.estadoCanalLiga(LG1, CS_L, { base: 0n, gid: GID, misRoles: [] }, [])[0] === 'no',
'una liga: nueva en su categoría, «ya la leo» si es de una que se lee, y no sin categoría, en la de los eventos, si es un canal de eventos, si no existe o si el bot no la lee');
// 🚫 lo que pidió la revisión: las categorías de afuera, las ligas que ya se leen por cualquiera de sus canales, y lo
// que no se guarda al aplicar
ok(JSON.stringify(SU.adivinarCanales(CANALES_L, ['1650000000000000001']).ll) === JSON.stringify([LL1])
  && SU.adivinarCanales(CANALES_L, ['1650000000000000001']).an === C0.an,
'adivinar no busca en las categorías que el servidor declara afuera (sus ligas): ni llaves ni nada');
const YA2 = [{ n: 'FMS Domingos', ver: '9', an: '', tabla: LG1 }];
const CS_EV = CS_L.concat([{ id: '1650000000000000004', type: 4, name: 'COMUNIDAD' },
  { id: '1700000000000000021', type: 0, name: 'resultados', parent_id: '1650000000000000004' },
  { id: '1700000000000000022', type: 0, name: '📢 eventos', parent_id: '1650000000000000004' }]);
ok(SU.estadoCanalLiga(LG1, CS_L, null, YA2)[0] === 'ok' && SU.estadoCanalLiga('1700000000000000017', CS_L, null, YA2)[0] === 'ok'
  && /es de FMS Domingos/.test(SU.estadoCanalLiga('1700000000000000017', CS_L, null, YA2)[1])
  && SU.estadoCanalLiga('1700000000000000021', CS_EV, null, [])[0] === 'no' && SU.estadoCanalLiga('1700000000000000021', CS_EV, null, [])[2] === true
  && SU.estadoCanalLiga(LG2, CS_L, null, [])[2] === true && SU.estadoCanalLiga(LG1, CS_L, { base: 0n, gid: GID, misRoles: [] }, [])[2] === undefined,
'una liga que ya se lee se reconoce por cualquiera de sus canales (y por su categoría); la categoría con «eventos» es de los eventos; el «no» de lugar se marca, el de permisos no');
const Q = SU.elegidosQueQuedan(Object.assign({}, C0, { ll: [LL1, '1700000000000000016'], lg: [LG1, LG2, '1700000000000000021'] }),
  CS_EV, ['1650000000000000001'], []);
ok(JSON.stringify(Q.c.ll) === JSON.stringify([LL1]) && JSON.stringify(Q.c.lg) === JSON.stringify([LG1]) && Q.sacados.length === 3
  && Q.c.an === C0.an && Q.sacados.every((x) => x.por),
'al aplicar no se guardan las llaves de una categoría de afuera ni las ligas mal ubicadas, y se dice por qué', JSON.stringify(Q));
const COMP3 = SU.itemsComprobacion({ c: Object.assign({}, C0, { ll: ['1700000000000000016'] }), cfg: SU.cfgDePlantilla('leer', C0),
  cs: CANALES_L, ctx: null, perm: { bits: '8', admin: true }, lecturas: { '1700000000000000016': 200 }, inv: null, afuera: ['1650000000000000001'] });
ok(COMP3.some((x) => /tus llaves en/.test(x.t) && x.est === 'no' && /no lo leo/.test(x.sub)),
  'y «Comprobar» marca una llave que después quedó en una categoría de afuera');
const gInv = { id: GID, roles: ROLES, rules_channel_id: C0.an };
ok(SU.canalInvitacion(gInv, CANALES).id === '1700000000000000006'
  && SU.canalInvitacion(gInv, CANALES.filter((c) => !/bienv/.test(c.name || ''))).id === C0.an
  && SU.canalInvitacion(gInv, [oculto]) === null, 'la invitación: a la bienvenida; si no, a las reglas; nunca a un canal que no ve todo el mundo');
ok(SU.siglaPropuesta('Freestyle Zona Ártica', ['FRZ']) === 'FZA' && SU.siglaPropuesta('Freestyle Zona Ártica', ['FZA']) === 'FRE'
  && SU.siglaPropuesta('', ['X']) === 'SVAA' && SU.siglaPropuesta('🔥', []) === 'SVAA',
'la sigla propuesta: las iniciales sin tildes (igual que `sigla_libre()` de bot/tiers.py)');

ok(SU.leerSu(SU.idSu('ch', 'an')).a === 'ch' && SU.leerSu(SU.idSu('ch', 'an')).x === 'an' && SU.leerSu('su:v0:ir:1') === null
  && SU.leerSu('cfg:nick') === null && SU.idSu('si', '1234567890123456789012').length <= 100,
'el custom_id: va y vuelve; uno de otra versión no se interpreta; el más largo entra en 100');
let largo = false;
try { SU.idSu('x', 'y'.repeat(120)); } catch (e) { largo = true; }
ok(largo, 'y uno de más de 100 no se arma (revienta acá, no en Discord)');

const FFA = SERVIDORES.find((s) => s.sv === 'FFA'), TFC = SERVIDORES.find((s) => s.sv === 'TFC');
const META = { liga: ['DRA', 'FFA', 'SR', 'FRZ', 'URBF', 'FFS', 'DDF', 'ACAD', 'FVS', 'FDS', 'LKR', 'CH', 'DDS', 'CEU'] };
ok(SU.estadoLiga(FFA.guild, META, SERVIDORES).es === 'socio' && SU.estadoLiga(TFC.guild, META, SERVIDORES).es === 'fuera'
  && SU.estadoLiga(GID, META, SERVIDORES).es === 'nuevo'
  && SU.estadoLiga(GID, Object.assign({}, META, { liga: META.liga.concat('FNC'), nuevos: { FNC: [GID, 'Nuevo', 'FNC'] } }), SERVIDORES).es === 'socio',
'quién es: FFA ya es socio, TFC está registrado afuera, uno nuevo es nuevo, y cuando el ciclo lo confirma, socio');
const cn = A.conNuevos(SERVIDORES, { nuevos: { FNC: [GID, 'Nuevo', 'FNC'], FFX: [FFA.guild, 'Pisa a FFA', 'FFX'], LKR: ['1558611504046153750', 'otro', 'LKR'], mal: [GID, 'x'] } });
ok(cn.length === SERVIDORES.length + 1 && cn.slice(0, SERVIDORES.length).every((s, k) => s === SERVIDORES[k])
  && cn[cn.length - 1].sv === 'FNC' && cn[cn.length - 1].sinCarta && A.conNuevos(SERVIDORES, {}).length === SERVIDORES.length,
'conNuevos: los nuevos al final y sin carta; lo escrito en el Worker gana (ni un código ni un guild repetido); sin meta, lo de siempre');

// 🔎 la comprobación (21/11/2026), pura: lo que contestó Discord, y lo que no se pidió se calcula
const CC = Object.assign({}, C0, { ll: [LL1], lg: [LG1, LG2] });
const lee = SU.canalesQueLee(CC, SU.cfgDePlantilla('completa', CC));
ok(lee.map((x) => x.k).join() === 'an,in,ve,ll,lg,lg,ge' && SU.canalesQueLee(CC, { leer_chat: false }).every((x) => x.k !== 'ge')
  && SU.canalesQueLee({ an: C0.an, ve: C0.an }, null).length === 1,
'lo que el bot tiene que leer: eventos, inscripciones, veredictos, llaves, cada liga y el chat general (si lo lee), sin repetir');
const COMP = SU.itemsComprobacion({ c: CC, cfg: SU.cfgDePlantilla('completa', CC), cs: CS_L, ctx: null,
  perm: { bits: String(base | (1n << 27n)), arriba: 2 }, ligas: [], lecturas: { [C0.an]: 200, [C0.in]: 403, [C0.ve]: 404, [LL1]: 200, [LG1]: 200, [LG2]: 200, [C0.ge]: 500 },
  inv: { codigo: 'abcDEF12' }, invOk: false, cfgOk: true });
const est = (re) => (COMP.find((x) => re.test(x.t + ' ' + x.sub)) || {}).est;
ok(est(/ajustes están guardados/) === 'ok' && est(/anuncios de eventos/) === 'ok' && est(/inscripciones/) === 'no'
  && est(/veredictos/) === 'no' && est(/tus llaves en/) === 'ok' && est(new RegExp('Liga nueva en <#' + LG1)) === 'va'
  && est(new RegExp('liga de <#' + LG2)) === 'no' && est(/chat general/) === 'va' && est(/^El #N en los apodos/) === 'ojo'
  && est(/ya no anda/) === 'no' && est(/Escribo en/) === 'ok',
'la comprobación: lo que contestó Discord manda (leer 403 o 404 es ❌, un 500 es ⏳), la liga nueva espera, la sin categoría no, el rol bajo avisa y la invitación muerta es ❌',
JSON.stringify(COMP.map((x) => [x.t, x.est])));
const COMP2 = SU.itemsComprobacion({ c: C0, cfg: SU.cfgDePlantilla('leer', C0), cs: CANALES, ctx: { base: 0n, gid: GID, misRoles: [] },
  perm: { bits: '0' }, lecturas: {}, inv: null });
ok(COMP2.some((x) => /las busco solo/.test(x.t) && x.est === 'salto') && COMP2.filter((x) => /^Leo /.test(x.t)).every((x) => x.est === 'no')
  && COMP2.some((x) => /Sin la invitación/.test(x.t) && x.est === 'ojo') && !COMP2.some((x) => /Escribo en|apodos/.test(x.t)),
'sin llaves elegidas lo dice; lo que no se pidió a Discord se calcula con los permisos; con «Sólo leer» no hay nada que escribir ni #N',
JSON.stringify(COMP2.map((x) => [x.t, x.est])));

// 📏 CADA PANTALLA CONTRA LOS TOPES, con el peor caso: nombre largo con emojis, todo prendido, todo lo que falta
const NOM = '🔥🎤 La Hermandad del Freestyle Underground Latinoamericano Oficial 🎤🔥 '.repeat(2);
const LG5 = Array.from({ length: 5 }, (_, k) => '17000000000000003' + String(k).padStart(2, '0'));
const LL3 = Array.from({ length: 3 }, (_, k) => '17000000000000004' + String(k).padStart(2, '0'));
const BORR = { v: 1, paso: 4, pl: 'completa', c: Object.assign({}, C0, { ll: LL3, lg: LG5 }), ce: { an: 'e' },
  ov: { canales: Array.from({ length: 10 }, (_, k) => '17000000000000001' + String(k).padStart(2, '0')) } };
const CS = CANALES.concat(BORR.ov.canales.map((id) => ({ id, type: 0, name: 'x' })),
  LL3.map((id) => ({ id, type: 0, name: 'llaves' })), LG5.map((id, k) => ({ id, type: 0, name: 'resultados', parent_id: k % 2 ? CATL : '' })),
  [{ id: CATL, type: 4, name: '🔥🎤 LA LIGA MÁS LARGA DEL FREESTYLE UNDERGROUND LATINOAMERICANO OFICIAL 🎤🔥' }]);
const COMP_MAL = SU.itemsComprobacion({ c: BORR.c, cfg: SU.cfgFinal(BORR), cs: CS, ctx: { base: 0n, gid: GID, misRoles: [] },
  perm: { bits: '0', arriba: 40 }, ligas: [], lecturas: {}, inv: { codigo: 'abcDEF12' }, invOk: false, cfgOk: false });
const PERM_MAL = { bits: '0', arriba: 40, rol: NOM };
const ITEMS = [{ t: 'Guardé tus ajustes', sub: 'plantilla Liga completa · 4 canales', est: 'ok' }].concat(
  [1, 2, 3].map((k) => ({ t: 'Mensaje de prueba en <#' + C0.ge + '>', sub: 'no puedo escribir ahí: dale al bot permiso de ver y enviar mensajes en ese canal', est: k === 2 ? 'no' : 'ok' })),
  [{ t: 'La invitación de la Liga a tu servidor', sub: 'al bot le falta «Crear invitación»: la crea el ciclo cuando lo tenga', est: 'no' },
    { t: 'Anoté ' + NOM.slice(0, 60) + ' en la Liga', sub: 'entra en la próxima vuelta del bot · sigla FNC', est: 'ok' }]);
const HECHO = { t: Date.now(), por: '123456789012345678', pl: 'completa', c: C0, alta: { t: 1 }, aviso: C0.ge };
const PANTALLAS = {
  'paso 0 (nuevo)': SU.paso0({ nombre: NOM, icono: 'https://cdn.discordapp.com/icons/1/a.png', borr: null, estado: { es: 'nuevo' } }),
  'paso 0 (a medias)': SU.paso0({ nombre: NOM, icono: '', borr: BORR, estado: { es: 'socio' } }),
  'paso 1 (falta todo)': SU.paso1({ gid: GID, perm: PERM_MAL, borr: BORR }),
  'paso 1 (admin)': SU.paso1({ gid: GID, perm: { bits: '8', admin: true, arriba: 0 }, borr: BORR }),
  'paso 2': SU.paso2({ borr: BORR }),
  'paso 3': SU.paso3({ borr: BORR, canales: CS, ctx: { base: 0n, gid: GID, misRoles: [] },
    ligas: Array.from({ length: 12 }, (_, k) => ({ n: 'FMH ' + NOM.slice(0, 30) + k, ver: '19' + String(k).padStart(17, '0') })) }),
  'paso 4 (todo prendido)': SU.paso4({ borr: BORR, canales: CS }),
  'paso 5': SU.paso5({ nombre: NOM, borr: BORR, estado: { es: 'nuevo' }, invCanal: C0.an, invPuede: false }),
  'aplicando (con fallas)': SU.aplicando(ITEMS, true),
  'paso 6': SU.paso6({ nombre: NOM, icono: 'https://x/y.png', cfg: SU.cfgFinal(BORR), estado: { es: 'nuevo' }, aviso: C0.ge, kit: 'https://underlegends.pages.dev/freestyle-rap/kit/0123456789abcdef0123', dec: null, hecho: HECHO }),
  'paso 6 (comprobado mal)': SU.paso6({ nombre: NOM, icono: 'https://x/y.png', cfg: SU.cfgFinal(BORR), estado: { es: 'nuevo' }, aviso: C0.ge, kit: 'https://underlegends.pages.dev/freestyle-rap/kit/0123456789abcdef0123', dec: null, hecho: HECHO, comp: COMP_MAL }),
  'comprobado (mal)': SU.pasoComprobado({ nombre: NOM, items: COMP_MAL }),
  'comprobado (bien)': SU.pasoComprobado({ nombre: NOM, items: COMP.filter((x) => x.est === 'ok') }),
  'paso 7': SU.paso7({ nombre: NOM, hecho: Object.assign({}, HECHO, { c: BORR.c }), cfg: SU.cfgFinal(BORR), perm: PERM_MAL, estado: { es: 'socio' }, dec: { si: false, t: 1 }, borr: BORR }),
  'DM a Dlx': SU.dmDlx({ gid: '1234567890123456789012', nombre: NOM, icono: 'https://x/y.png', miembros: 12345, perm: PERM_MAL, pl: 'basico', por: '123456789012345678', sigla: 'FNC', dec: null }),
  'DM a Dlx (decidido)': SU.dmDlx({ gid: '1234567890123456789012', nombre: NOM, miembros: 12345, perm: PERM_MAL, pl: 'leer', por: '1', sigla: 'FNC', dec: { si: true, t: Date.now() } }),
};
const tabla = [];
for (const [n, m] of Object.entries(PANTALLAS)) {
  const x = SU.medir(m);
  tabla.push([n, x.componentes, x.letras, x.idMax]);
  ok(x.cabe && m.flags === SU.V2 && m.components.length === 1 && m.components[0].type === 17,
    `${n}: entra en los topes de Discord (componentes ${x.componentes}/40, letras ${x.letras}/4000, id ${x.idMax}/100) y es un contenedor V2`);
  const todos = ids(m);
  ok(new Set(todos).size === todos.length, `${n}: ningún custom_id repetido en el mismo mensaje`);
  // el voseo lleva la tilde donde el tú no: «tocá / toca», «elegí / elige», «podés / puedes»
  ok(!/\bvos\b|ten[é]s\b|pod[é]s\b|\beleg[í](?![a-záéíóú])|\btoc[á](?![a-záéíóú])|\bsum[á](?![a-záéíóú])|\bmir[á](?![a-záéíóú])/i
    .test(textoDe(m).replace(/\\n/g, ' ')), `${n}: en «tú», sin voseo`);
}
console.log('\n  📏 lo medido (peor caso):\n' + tabla.map(([n, c, l, i]) => `     ${n.padEnd(24)} ${String(c).padStart(2)} componentes · ${String(l).padStart(4)} letras · id ${i}`).join('\n'));
ok(/Que sumen · Tier 3/.test(textoDe(PANTALLAS['DM a Dlx'])) && /Todavía no/.test(textoDe(PANTALLAS['DM a Dlx']))
  && /Mejor todavía no/.test(textoDe(PANTALLAS['DM a Dlx (decidido)'])), 'el DM: los dos botones, y después de decidir, el de cambiarlo');
ok(/antiraid/.test(textoDe(PANTALLAS['paso 6'])) && /en revisión/.test(textoDe(PANTALLAS['paso 6'])) && /Mi kit/.test(textoDe(PANTALLAS['paso 6'])),
  'el cierre: «en revisión», el kit, el dashboard y `/antiraid`');

// ── 2 · EL OBJETO DE VERDAD ────────────────────────────────────────────────────────────────────────────────────────────
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): el objeto y el camino entero no se prueban acá');
} else {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const t = String(q).trim();
      if (!ps.length && /;\s*\S/.test(t)) { db.exec(t); return { toArray: () => [], rowsWritten: 0 }; }
      const st = db.prepare(t);
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(t)) { const rows = st.all(...ps); return { toArray: () => rows, rowsWritten: 0 }; }
      const r = st.run(...ps);
      return { toArray: () => [], rowsWritten: Number(r.changes) };
    },
  };
  const KV = {};
  let kvPuts = 0;
  let META_KV = JSON.stringify(META);
  const envO = { DISCORD_TOKEN: 'BOT.FALSO', KV: { get: async (k) => (k === 'meta' ? META_KV : (KV[k] ?? null)), put: async (k, v) => { kvPuts += 1; KV[k] = v; } } };
  const o = new A.Avisos({ storage: { sql, setAlarm() {}, getAlarm() { return null; } }, blockConcurrencyWhile: async (f) => f() }, envO);
  await new Promise((r) => setTimeout(r, 5));
  const op = async (d) => (await o.fetch(new Request('https://avisos/setup', { method: 'POST', body: JSON.stringify(d) }))).json();

  ok((await op({ op: 'leer', g: GID })).borr === null && (await op({ op: 'leer', g: 'x' })).error === 'g', 'un servidor sin setup: nada; un guild mal: no');
  await op({ op: 'borrador', g: GID, borr: { v: 1, paso: 2, pl: 'leer', t: Date.now() } });
  ok((await op({ op: 'leer', g: GID })).borr.pl === 'leer' && (await op({ op: 'borrador', g: GID, borr: { x: 'y'.repeat(7000) } })).error === 'grande',
    'el borrador se guarda (y uno gigante no)');
  ok((await op({ op: 'candado', g: GID })).ok && !(await op({ op: 'candado', g: GID })).ok && (await op({ op: 'soltar', g: GID })).ok
    && (await op({ op: 'candado', g: GID })).ok, 'el candado: una aplicación a la vez');
  await op({ op: 'soltar', g: GID });
  const h1 = await op({ op: 'hecho', g: GID, hecho: { t: 1, nombre: 'Nuevo', sigla: 'FNC', por: '123456789012345678', pruebas: { a: '1' }, alta: { t: 5 },
    c: { an: C0.an }, aviso: C0.ge, inv: { codigo: 'abc', canal: 'b', canal_id: '1700000000000000006' }, es: 'nuevo' }, limpiar: true });
  const h2 = await op({ op: 'hecho', g: GID, hecho: { t: 2, pruebas: { b: '2' }, alta: { t: 9 } } });
  ok(h1.ok && h2.hecho.alta.t === 5 && h2.hecho.pruebas.a === '1' && h2.hecho.pruebas.b === '2' && (await op({ op: 'leer', g: GID })).borr === null,
    'lo aplicado: el alta guarda su primera hora, las pruebas se suman, y aplicar limpia el borrador');
  ok((await op({ op: 'dm', g: GID })).ok && !(await op({ op: 'dm', g: GID })).ok, 'el DM a Dlx se reserva una vez');
  await op({ op: 'dm-fin', g: GID, ok: false });
  ok((await op({ op: 'dm', g: GID })).ok, 'si no salió, se suelta y se puede volver a intentar');
  await op({ op: 'dm-fin', g: GID, ok: true });
  ok(!(await op({ op: 'dm', g: GID })).ok, 'y una vez mandado, nunca más');
  ok((await op({ op: 'decidir', g: '1600000000000000099', si: true })).error === 'no existe', 'decidir sobre un servidor que no pidió entrar: no');
  const dc1 = await op({ op: 'decidir', g: GID, si: true, por: A.DUENO });
  ok(dc1.ok && dc1.dec.si === true && o.ajustes().setup_suma[GID].si === true && (o.leer('ajustes_hist') || [])[0].cual === 'setup_suma',
    '«Que sumen»: queda como ajuste de Dlx (`setup_suma`), con su historial, igual que desde el Dashboard');
  const aj = await (await o.fetch(new Request('https://avisos/ajustes'))).json();
  ok(Array.isArray(aj.setup_altas) && aj.setup_altas.length === 1 && aj.setup_altas[0].g === GID && aj.setup_altas[0].sigla === 'FNC'
    && !JSON.stringify(aj.setup_altas).includes('123456789012345678') && aj.setup_suma[GID].si === true,
  'el ciclo lee el pedido de entrar y la decisión en la misma lectura de ajustes, y SIN quién corrió el setup (va al repo público)');
  const pd = o.panelDueno({});
  ok(pd.setup.length === 1 && pd.setup[0].dec.si === true && pd.setup[0].por === '123456789012345678', 'el Dashboard lo ve, con quién lo corrió');
  ok(A.ajusteValido('setup_suma', { [GID]: { si: true, t: 1 } })[GID].si === true && A.ajusteValido('setup_suma', { x: { si: true } }) === undefined
    && A.ajusteValido('setup_suma', { [GID]: { si: 'sí' } }) === undefined && A.ajusteValido('setup_suma', null) === null,
  'el ajuste se valida: un guild y un sí o no');

  // 📺 el vigía: los canales elegidos se SUMAN a los encontrados por nombre, y el chat general elegido manda
  const GV = '1600000000000000050';
  await op({ op: 'hecho', g: GV, hecho: { t: 1, c: { an: '1800000000000000001', ge: '1800000000000000003', ve: '1800000000000000009' } } });
  META_KV = JSON.stringify({ liga: ['NUE'], nuevos: { NUE: [GV, 'Nuevo', 'NUE'] } });
  const f0 = globalThis.fetch;
  globalThis.fetch = async (u) => {
    if (String(u).endsWith('/users/@me')) return new Response(JSON.stringify({ id: A.APP_ID }), { status: 200 });
    if (String(u).endsWith('/guilds/' + GV + '/channels')) {
      return new Response(JSON.stringify([{ id: '1800000000000000001', type: 0, name: 'avisos-de-la-casa' },
        { id: '1800000000000000002', type: 0, name: 'eventos' }, { id: '1800000000000000003', type: 0, name: 'la-esquina' },
        { id: '1800000000000000004', type: 0, name: 'general' }]), { status: 200 });
    }
    return new Response('[]', { status: 404 });
  };
  const svsV = A.conNuevos([], JSON.parse(META_KV));
  const can = await o.descubrir(svsV, Date.now());
  globalThis.fetch = f0;
  ok(can.lista.map((x) => x.id).sort().join() === '1800000000000000001,1800000000000000002' && can.generales[0].id === '1800000000000000003'
    && can.veredictos.length === 0, 'el vigía: lee el de eventos por nombre Y el elegido en el setup; el chat general elegido gana; uno que no existe, no',
  JSON.stringify(can.lista.map((x) => x.id)));

  // ── 3 · EL CAMINO ENTERO, con un Discord simulado ───────────────────────────────────────────────────────────────────
  const G = '1600000000000000777';
  META_KV = JSON.stringify(META);
  const env = Object.assign({}, envO, { FOTOS_SAL: 'sal-de-prueba',
    AVISOS: { idFromName: () => 'liga', get: () => ({ fetch: (u, init) => { pedidos.objeto += 1; return o.fetch(new Request(u, init)); } }) } });
  const pedidos = { discord: 0, objeto: 0 };
  const W = { patches: [], mensajes: [], invites: [], dms: [], dmMsgs: [], lecturas: [], mirarInv: [] };
  const SIN_LEER = new Set(), INV_MUERTA = new Set();
  const CAN = CANALES.map((c) => (c.id === '1700000000000000006' ? c : c));
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const m = init.method || 'GET';
    pedidos.discord += 1;
    if (/\/webhooks\/.+\/messages\/@original$/.test(u) && m === 'PATCH') { W.patches.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); }
    if (u.endsWith(`/guilds/${G}?with_counts=true`)) {
      return new Response(JSON.stringify({ id: G, name: 'Freestyle Nuevo Club', icon: 'abc', roles: ROLES.map((r) => (r.id === GID ? Object.assign({}, r, { id: G }) : r)),
        approximate_member_count: 1240, rules_channel_id: C0.an }), { status: 200 });
    }
    if (u.endsWith(`/guilds/${G}/members/${A.APP_ID}`)) return new Response(JSON.stringify({ roles: [ROLBOT] }), { status: 200 });
    if (u.endsWith(`/guilds/${G}/channels`)) return new Response(JSON.stringify(CAN.map((c) => JSON.parse(JSON.stringify(c).split(GID).join(G)))), { status: 200 });
    // (la ruta de abrir un DM, armada en dos partes: esto es el Discord de mentira, no un DM, y `herramientas/sin_dm.py`
    // busca la ruta escrita entera. Que el de verdad vaya SÓLO a Dlx lo afirma la prueba de abajo, con `recipient_id`)
    if (u.endsWith('/users/@me' + '/channels') && m === 'POST') { W.dms.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: '1900000000000000001' }), { status: 200 }); }
    const msg = /\/channels\/(\d+)\/messages$/.exec(u);
    if (msg && m === 'POST') {
      (msg[1] === '1900000000000000001' ? W.dmMsgs : W.mensajes).push([msg[1], JSON.parse(init.body)]);
      return new Response(JSON.stringify({ id: '1950000000000000' + String(W.mensajes.length).padStart(3, '0') }), { status: 200 });
    }
    // 🔎 la comprobación: el último mensaje de un canal (los de `SIN_LEER`, 403) y una invitación (`INV_MUERTA`, 404)
    const lee1 = /\/channels\/(\d+)\/messages\?limit=1$/.exec(u);
    if (lee1 && m === 'GET') { W.lecturas.push(lee1[1]); return new Response(SIN_LEER.has(lee1[1]) ? '{"message":"Missing Access"}' : '[]', { status: SIN_LEER.has(lee1[1]) ? 403 : 200 }); }
    const vInv = /\/invites\/([A-Za-z0-9-]+)$/.exec(u);
    if (vInv && m === 'GET') { W.mirarInv.push(vInv[1]); return new Response(INV_MUERTA.has(vInv[1]) ? '{}' : JSON.stringify({ code: vInv[1] }), { status: INV_MUERTA.has(vInv[1]) ? 404 : 200 }); }
    const inv = /\/channels\/(\d+)\/invites$/.exec(u);
    if (inv && m === 'POST') { W.invites.push([inv[1], JSON.parse(init.body)]); return new Response(JSON.stringify({ code: 'abcDEF12' }), { status: 200 }); }
    return new Response('{}', { status: 404 });
  };
  const espera = [];
  const ctx = { waitUntil: (p) => espera.push(p) };
  const h = { luego: (c, p) => c.waitUntil(p), idDe: (i) => (i.member && i.member.user && i.member.user.id) || (i.user && i.user.id) || '',
    aviso: (t) => new Response(JSON.stringify({ type: 4, data: { flags: 64, content: t } })), espera: () => new Response('{"type":4}'),
    frenado: () => 0, SERVIDORES };
  const ADMIN = '1500000000000000001';
  const inter = (extra) => Object.assign({ application_id: A.APP_ID, token: 'tok', guild_id: G, app_permissions: String(base),
    member: { permissions: '32', user: { id: ADMIN } } }, extra);
  const clic = async (id, values, quien) => {
    const antes = { ...pedidos };
    const r = SU.componente(inter({ data: { custom_id: id, values: values || [] } , member: quien || { permissions: '32', user: { id: ADMIN } } }), env, ctx, h);
    await Promise.all(espera.splice(0));
    return { r: await r.json(), gasto: pedidos.discord - antes.discord + pedidos.objeto - antes.objeto, discord: pedidos.discord - antes.discord };
  };
  const ultima = () => W.patches[W.patches.length - 1];
  const gastos = {};

  // /setup: a quien no es admin, no; al admin, el mensaje en V2 ya y la bienvenida encima
  const no = await SU.comando(inter({ member: { permissions: '0', user: { id: '1' } } }), env, ctx, h).json();
  ok(no.type === 4 && /admins/.test(no.data.content), '/setup: a quien no es admin le dice quién lo corre');
  const c0 = await SU.comando(inter({}), env, ctx, h).json();
  await Promise.all(espera.splice(0));
  ok(c0.type === 4 && c0.data.flags === (64 | 32768) && /Bienvenido a la Liga Global, Freestyle Nuevo Club/.test(textoDe(ultima())) && ultima().flags === 32768,
    '/setup: el mensaje efímero en V2 al toque, y la bienvenida con el nombre del servidor encima', textoDe(ultima()).slice(0, 200));
  let x = await clic('su:v1:nuevo');
  gastos['empezar → paso 1'] = x.gasto;
  ok(x.r.type === 6 && /PASO 1 DE 6/.test(textoDe(ultima())) && /Gestionar apodos/.test(textoDe(ultima())) && /2 roles encima/.test(textoDe(ultima()))
    && /Darle Administrador/.test(textoDe(ultima())), 'paso 1: lo que falta, con su para qué, el rol bajo y «Darle Administrador»');
  x = await clic('su:v1:seguir');
  ok(/PASO 2 DE 6/.test(textoDe(ultima())), 'seguir sin eso → la plantilla');
  x = await clic('su:v1:pl', ['completa']);
  gastos['elegir plantilla'] = x.gasto;
  ok(/"default":true/.test(textoDe(ultima())) && /Liga completa/.test(textoDe(ultima())), 'la plantilla elegida queda marcada');
  x = await clic('su:v1:ir:3');
  gastos['paso 3 (busca canales)'] = x.gasto;
  const b3 = (await op({ op: 'leer', g: G })).borr;
  ok(/PASO 3 DE 6/.test(textoDe(ultima())) && b3.c.an === C0.an && b3.c.ge === C0.ge && /encontrado/.test(textoDe(ultima()))
    && textoDe(ultima()).includes(`"default_values":[{"id":"${C0.ge}","type":"channel"}]`),
  'paso 3: los canales encontrados solos, elegidos en cada menú');
  x = await clic('su:v1:ch:in', ['1700000000000000006']);
  ok((await op({ op: 'leer', g: G })).borr.ce.in === 'e' && /elegido/.test(textoDe(ultima())), 'corregir uno: queda «elegido»');
  // 🔑🏟️ las llaves y las ligas van de a varios, con su tope
  x = await clic('su:v1:ch:ll', [C0.an, 'basura', C0.in, C0.ve, C0.ge]);
  const bLL = (await op({ op: 'leer', g: G })).borr;
  ok(JSON.stringify(bLL.c.ll) === JSON.stringify([C0.an, C0.in, C0.ve]) && bLL.ce.ll === 'e' && /Tus llaves/.test(textoDe(ultima())),
    'las llaves: una lista, sin lo que no es un canal y con su tope de 3', JSON.stringify(bLL.c.ll));
  await clic('su:v1:ch:ll', ['1700000000000000007']);
  await clic('su:v1:ch:lg', []);
  ok(JSON.stringify((await op({ op: 'leer', g: G })).borr.c.ll) === '["1700000000000000007"]' && (await op({ op: 'leer', g: G })).borr.c.lg.length === 0
    && /Tus ligas/.test(textoDe(ultima())), 'cambiar las llaves las reemplaza, y las ligas pueden quedar vacías');
  x = await clic('su:v1:ir:4');
  x = await clic('su:v1:tg:nick');
  gastos['un interruptor'] = x.gasto;
  ok(/PASO 4 DE 6/.test(textoDe(ultima())) && SU.cfgFinal((await op({ op: 'leer', g: G })).borr).nick === false, 'paso 4: apagar el #N');
  x = await clic('su:v1:ir:5');
  ok(/Anoto Freestyle Nuevo Club en la Liga/.test(textoDe(ultima())) && /Puntos de Temporada/.test(textoDe(ultima())) && kvPuts === 0
    && W.mensajes.length === 0 && W.invites.length === 0, 'paso 5: la lista de lo que va a pasar, y hasta acá NADA cambió en el servidor ni en KV');

  // Aplicar
  const patches0 = W.patches.length;
  x = await clic('su:v1:aplicar');
  gastos['aplicar'] = x.gasto;
  gastos['aplicar (sólo Discord)'] = x.discord;
  const cfgG = JSON.parse(KV['cfg:' + G] || '{}');
  ok(kvPuts === 1 && cfgG.vivo === C0.ge && cfgG.nick === false && cfgG.aviso_evento === '', 'aplicar: UNA escritura de KV, con la plantilla y lo cambiado', KV['cfg:' + G]);
  ok(W.mensajes.length === 1 && W.mensajes[0][0] === C0.ge && /Prueba de la Liga Global/.test(W.mensajes[0][1].content)
    && W.mensajes[0][1].allowed_mentions.parse.length === 0, 'un mensaje de prueba por canal donde va a escribir, sin mencionar a nadie');
  ok(W.invites.length === 1 && W.invites[0][0] === '1700000000000000006' && W.invites[0][1].max_age === 0 && W.invites[0][1].unique === false,
    'la invitación permanente, a la bienvenida, pidiendo la que ya haya (unique: false)');
  ok(W.dms.length === 1 && W.dms[0].recipient_id === A.DUENO && W.dmMsgs.length === 1 && /Que sumen · Tier 3/.test(textoDe(W.dmMsgs[0][1]))
    && /1\.240 miembros/.test(textoDe(W.dmMsgs[0][1])), 'el DM: sólo a Dlx, con los datos y los dos botones');
  ok(W.patches.length - patches0 >= 4 && /ya está en la Liga Global/.test(textoDe(ultima())) && /en revisión/.test(textoDe(ultima()))
    && /freestyle-rap\/kit\/[0-9a-f]{20}/.test(textoDe(ultima())), 'el avance en vivo, y el cierre con «en revisión» y el link de su kit');
  const hechoG = (await op({ op: 'leer', g: G })).hecho;
  ok(hechoG.alta && hechoG.inv.codigo === 'abcDEF12' && hechoG.dm.ok && hechoG.sigla === 'FNC' && (await op({ op: 'leer', g: G })).borr === null,
    'lo aplicado queda en el objeto: el alta, la invitación, el DM mandado y la sigla propuesta');
  ok(/Lo comprobé/.test(textoDe(ultima())) && /Leo tus anuncios de eventos/.test(textoDe(ultima())) && /Leo tus llaves/.test(textoDe(ultima()))
    && W.lecturas.includes(C0.an) && W.lecturas.includes('1700000000000000007') && W.lecturas.length <= SU.LEER_TOPE
    && /Tus ajustes están guardados/.test(textoDe(ultima())),
  'aplicar termina comprobando: lee de verdad cada canal (las llaves también), y los ajustes se volvieron a leer de KV', JSON.stringify(W.lecturas));
  for (const p of W.patches) ok(SU.medir(p).cabe, 'cada edición del mensaje entra en los topes (' + JSON.stringify(SU.medir(p)) + ')');
  ok((await (await o.fetch(new Request('https://avisos/ajustes'))).json()).setup_canales[G].ll[0] === '1700000000000000007',
    'el ciclo recibe las llaves elegidas (`setup_canales`), también para un socio de antes');

  // 🔎 «Comprobar»: sobre lo aplicado, sin escribir nada; un canal que el bot no lee y una invitación borrada se ven
  SIN_LEER.add(C0.an);
  INV_MUERTA.add('abcDEF12');
  const msgs0 = W.mensajes.length, invs0 = W.invites.length, puts0 = kvPuts;
  x = await clic('su:v1:comprobar');
  gastos['comprobar'] = x.gasto;
  ok(/para arreglar/.test(textoDe(ultima())) && /el bot no puede leer ahí/.test(textoDe(ultima())) && /ya no anda/.test(textoDe(ultima()))
    && W.mensajes.length === msgs0 && W.invites.length === invs0 && kvPuts === puts0 && SU.medir(ultima()).cabe,
  '«Comprobar»: dice lo que no anda (no lee un canal, la invitación se borró) sin mandar mensajes, invitaciones ni escribir KV');
  // aplicar otra vez con la invitación borrada: la mira, ve que no está y crea otra
  await clic('su:v1:cambiar', ['5']);
  await clic('su:v1:aplicar');
  ok(W.invites.length === invs0 + 1 && (await op({ op: 'leer', g: G })).hecho.inv.codigo === 'abcDEF12',
    'aplicar con la invitación borrada: crea otra en vez de dar por buena la muerta');
  SIN_LEER.clear();
  INV_MUERTA.clear();
  x = await clic('su:v1:comprobar');
  ok(/todo anda|para mirar/.test(textoDe(ultima())) && !/para arreglar/.test(textoDe(ultima())), 'y arreglado, «Comprobar de nuevo» da todo bien',
    textoDe(ultima()).slice(0, 300));
  const invsFin = W.invites.length;

  // correrlo otra vez: el panel; cambiar algo y volver a aplicar no repite nada
  await SU.comando(inter({}), env, ctx, h);
  await Promise.all(espera.splice(0));
  ok(/configurado/.test(textoDe(ultima())) && /Cambiar un paso/.test(textoDe(ultima())) && /en revisión/.test(textoDe(ultima())),
    'otra vez /setup: el panel de cómo está todo');
  x = await clic('su:v1:cambiar', ['4']);
  ok(/PASO 4 DE 6/.test(textoDe(ultima())), '«Cambiar un paso…» entra al paso, con lo aplicado');
  await clic('su:v1:tg:nick');
  await clic('su:v1:ir:5');
  await clic('su:v1:aplicar');
  ok(kvPuts === 2 && JSON.parse(KV['cfg:' + G]).nick === true && W.mensajes.length === 1 && W.invites.length === invsFin && W.dms.length === 1,
    'volver a aplicar: guarda el cambio y NO repite el mensaje de prueba, la invitación ni el DM');
  await clic('su:v1:ir:5');
  await clic('su:v1:aplicar');
  ok(kvPuts === 2, 'y si nada cambió, ni KV se escribe');

  // dos «Aplicar» a la vez: uno espera
  await clic('su:v1:cambiar', ['5']);
  const [a1, a2] = [SU.componente(inter({ data: { custom_id: 'su:v1:aplicar' } }), env, ctx, h), SU.componente(inter({ data: { custom_id: 'su:v1:aplicar' } }), env, ctx, h)];
  await Promise.all(espera.splice(0));
  ok(W.patches.some((p) => /Ya se está aplicando/.test(textoDe(p))) && W.dms.length === 1 && W.invites.length === invsFin, 'dos «Aplicar» a la vez: uno espera');
  void a1; void a2;

  // los botones de Dlx: sólo él
  const otroDM = SU.componente({ application_id: A.APP_ID, token: 't', user: { id: ADMIN }, data: { custom_id: 'su:v1:si:' + G } }, env, ctx, h);
  ok((await otroDM.json()).type === 4, 'el «Que sumen» de otro: no');
  const dlx = SU.componente({ application_id: A.APP_ID, token: 't', user: { id: A.DUENO }, data: { custom_id: 'su:v1:si:' + G } }, env, ctx, h);
  await Promise.all(espera.splice(0));
  ok((await dlx.json()).type === 6 && o.ajustes().setup_suma[G].si === true && /Decidiste que sumen/.test(textoDe(ultima())),
    'el de Dlx: queda decidido y su DM lo dice');
  await SU.comando(inter({}), env, ctx, h);
  await Promise.all(espera.splice(0));
  ok(/aprobados/.test(textoDe(ultima())), 'y el servidor lo ve en su panel');

  // lo que no anda
  ok((await (await SU.componente(inter({ data: { custom_id: 'su:v0:ir:1' } }), env, ctx, h)).json()).type === 4, 'un botón de otra versión: «vuelve a correr /setup»');
  // el comando instalado en la cuenta, en un servidor donde el bot no está: no hay setup, hay «agrega el bot»
  const ajeno = '1600000000000000888';
  await SU.comando(Object.assign(inter({}), { guild_id: ajeno }), env, ctx, h);
  await Promise.all(espera.splice(0));
  ok(/Primero, el bot/.test(textoDe(ultima())) && textoDe(ultima()).includes('guild_id=' + ajeno) && SU.medir(ultima()).cabe,
    'sin el bot en el servidor: «agrega el bot», con el link a ESE servidor');
  await SU.componente(Object.assign(inter({ data: { custom_id: 'su:v1:nuevo' } }), { guild_id: ajeno }), env, ctx, h);
  await Promise.all(espera.splice(0));
  ok(/Primero, el bot/.test(textoDe(ultima())) && !(await op({ op: 'leer', g: ajeno })).hecho, 'y ningún clic lo anota en la Liga');
  ok(/Ya no tienes permiso/.test((await (await SU.componente(inter({ data: { custom_id: 'su:v1:ir:1' }, member: { permissions: '0', user: { id: '9' } } }), env, ctx, h)).json()).data.content),
    'el permiso se vuelve a mirar en cada clic');
  // un servidor que ya es socio (FFA): sin alta y sin DM
  const dms0 = W.dms.length;
  const iF = (extra) => Object.assign(inter(extra), { guild_id: FFA.guild });
  const viejoFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => viejoFetch(String(url).split(FFA.guild).join(G), init);
  const sF = (id, values) => { const r = SU.componente(iF({ data: { custom_id: id, values: values || [] } }), env, ctx, h); return Promise.all(espera.splice(0)).then(() => r); };
  await sF('su:v1:nuevo'); await sF('su:v1:pl', ['basico']); await sF('su:v1:ir:3'); await sF('su:v1:ir:5');
  ok(/ya es de la Liga/.test(textoDe(ultima())), 'un socio (FFA): «ya es de la Liga», no hace falta anotarlo');
  const rF = SU.componente(iF({ data: { custom_id: 'su:v1:aplicar' } }), env, ctx, h);
  await Promise.all(espera.splice(0));
  void rF;
  globalThis.fetch = viejoFetch;
  const hF = (await op({ op: 'leer', g: FFA.guild })).hecho;
  ok(!hF.alta && W.dms.length === dms0 && /quedó configurado/.test(textoDe(ultima())), 'y aplicar no lo anota ni le escribe a Dlx: sólo sus ajustes');
  ok(!(await (await o.fetch(new Request('https://avisos/ajustes'))).json()).setup_altas.some((y) => y.g === FFA.guild),
    'el ciclo no ve ningún pedido de entrar de FFA');

  console.log('\n  📡 pedidos por clic (Discord + el objeto; el tope del plan gratis es 50):\n'
    + Object.entries(gastos).map(([k, v]) => `     ${k.padEnd(24)} ${v}`).join('\n'));
  ok(Object.values(gastos).every((v) => v <= 50) && gastos['aplicar (sólo Discord)'] <= 35 && gastos.aplicar <= 45,
    'ningún clic se acerca a los 50 pedidos de una invocación (con la comprobación, «Aplicar» pide a Discord a lo sumo 35)', JSON.stringify(gastos));
  globalThis.fetch = f0;
}

console.log(`\n  🧭 /setup: ${bien} bien${mal ? ' · ' + mal + ' mal' : ''}\n`);
process.exit(mal ? 1 : 0);
