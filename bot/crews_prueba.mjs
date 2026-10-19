// 👥 La prueba de las crews (bot/crews.js): lo puro siempre, y las acciones sobre el objeto de verdad —SQLite de Node—
// cuando hay `node:sqlite` (Node 22.5+; CI usa el 20 y lo dice). node bot/crews_prueba.mjs
import * as CW from './crews.js';

let mal = 0, bien = 0;
const ok = (c, t) => { if (c) bien += 1; else { mal += 1; console.log('  🔴 ' + t); } };

// ── lo puro ──
ok(CW.normCrew('Follombia') === CW.normCrew('  FOLLÓMBIA ') && CW.normCrew('Santa Trinidad') === 'santatrinidad',
  'el nombre se compara sin tildes, mayúsculas ni espacios');
ok(CW.nombreCrew('  Los   del Barrio ') === 'Los del Barrio' && CW.nombreCrew('ab') === null && CW.nombreCrew('**negrita**') === null
  && CW.nombreCrew('@everyone') === null && CW.nombreCrew('x'.repeat(25)) === null && CW.nombreCrew('Ржунимагу') === 'Ржунимагу',
'el nombre: 3 a 24, sin markdown ni menciones, cualquier alfabeto');
ok(CW.siglaCrew('ks') === 'KS' && CW.siglaCrew('') === '' && CW.siglaCrew('ABCDE') === null && CW.siglaCrew('A') === null,
  'la sigla: 2 a 4, en mayúsculas');
ok(CW.descCrew('La crew del barrio, desde 2020') === 'La crew del barrio, desde 2020' && CW.descCrew('corta') === null
  && CW.descCrew('Sumate en discord.gg/abcdef ya mismo') === null && CW.descCrew('Hablale a @everyone del barrio') === null
  && CW.descCrew('x'.repeat(161)) === null && CW.descCrew('Mirá https://algo.com para más') === null,
'la descripción: 10 a 160, sin menciones ni links');
ok(CW.siglaCrew('', true) === null && CW.siglaCrew('  ', true) === null && CW.siglaCrew('ks', true) === 'KS',
  'y obligatoria cuando se pide (al crear y al cambiar el nombre)');
ok(CW.puede('lider', 'borrar') && !CW.puede('colider', 'borrar') && CW.puede('colider', 'sacar', 'veterano')
  && !CW.puede('colider', 'sacar', 'colider') && CW.puede('veterano', 'invitar') && !CW.puede('veterano', 'decidir')
  && !CW.puede('miembro', 'invitar') && !CW.puede('lider', 'sacar', 'lider') && !CW.puede('colider', 'lider'),
'los rangos: el Colíder casi todo, el Veterano invita, el Miembro nada, sólo el Líder borra y pasa el liderazgo');
const pts = { a: 100, b: 50, c: 30, d: 10 };
ok(CW.puntosCrew(pts, 'todos', 5, []) === 190 && CW.puntosCrew(pts, 'mejores', 2, []) === 150
  && CW.puntosCrew(pts, 'reps', 2, ['c', 'd']) === 40 && CW.puntosCrew(pts, 'reps', 2, []) === 150,
'el ranking: todos, los N mejores, los representantes (y sin representantes, los mejores)');
ok(CW.rankingValido({ modo: 'mejores', n: 5 }).n === 5 && CW.rankingValido({ modo: 'x' }) === undefined
  && CW.rankingValido({ modo: 'todos', n: 99 }) === undefined && CW.precioValido(2500) === 2500 && CW.precioValido(-1) === undefined,
'los ajustes del Dashboard se validan');
ok(CW.validarCrew({ accion: 'crear', nombre: 'Los del Barrio', quien: '999', de: 'otro' }).quien === undefined
  && CW.validarCrew({ accion: 'nada' }).error && CW.validarCrew({ accion: 'invitar', a: 'a b' }).error
  && CW.validarCrew({ accion: 'reps', reps: ['ana', 'bea'] }).reps.length === 2,
'la forma: sólo las acciones que existen, y quién actúa NUNCA sale del pedido');

// ── sobre el objeto ──
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch (e) { DatabaseSync = null; }
if (!DatabaseSync) {
  console.log('  ⓘ sin node:sqlite (Node ' + process.version + '): las acciones no se prueban sobre el objeto');
} else {
  const db = new DatabaseSync(':memory:');
  const sql = {
    exec(q, ...ps) {
      const st = db.prepare(String(q).trim());
      if (/^\s*(SELECT|WITH|PRAGMA)/i.test(q)) { const rows = st.all(...ps); return { toArray: () => rows }; }
      const r = st.run(...ps);
      return { toArray: () => [], rowsWritten: r.changes };
    },
  };
  const estado = {};
  const bandeja = [];
  const o = {
    sql,
    state: { storage: { transactionSync: (f) => f() } },
    ajustes: () => estado.ajustes || {},
    leer: (k) => estado[k],
    cuentaCambio: () => true,
    aBandeja: (quien, clave, tipo, titulo, cuerpo) => bandeja.push({ quien, clave, titulo, cuerpo }),
    saldo(quien, desde, inicial) {
      const r = db.prepare('SELECT COALESCE(SUM(monto), 0) AS n FROM tienda WHERE quien = ?').get(quien);
      return inicial + r.n;
    },
  };
  db.exec('CREATE TABLE tienda (id TEXT PRIMARY KEY, ref INTEGER NOT NULL, quien TEXT NOT NULL, monto INTEGER NOT NULL, t INTEGER NOT NULL)');
  db.exec('CREATE TABLE servidor (quien TEXT, temporada TEXT, sv TEXT, de TEXT, t INTEGER, fijo INTEGER)');
  db.exec('CREATE TABLE sigue (quien TEXT, a TEXT, t INTEGER, de TEXT)');
  db.exec('CREATE TABLE persona (k TEXT PRIMARY KEY, v TEXT NOT NULL, t INTEGER NOT NULL)');
  db.prepare('INSERT INTO persona (k, v, t) VALUES (?, ?, 0)').run('p:gus', JSON.stringify({ n: 'Gus 🇦🇷' }));
  db.prepare('INSERT INTO servidor VALUES (?, ?, ?, ?, ?, ?)').run('7000002002', 't1', 'FFA', 'fabi', 1, 0);
  CW.crewTablas(sql);
  const id = (n) => String(7000000000 + n);
  // crear trae la descripción y el logo ya filtrado (`logo_url` y `logo_v` los pone el objeto después del filtro)
  const CREAR = { desc: 'La crew de la prueba, del barrio', logo_url: 'https://pub.r2.dev/logos-crews/a.webp', logo_v: 'ok' };
  const yo = (n, k, x) => CW.crewAccion(o, Object.assign({ quien: id(n), de: k, inicial: 5000, desde: 0 }, x.accion === 'crear' ? CREAR : {}, x));

  const s = CW.sembrar(o, { crews: [{ id: 'Follombia', gente: ['ana', 'bea', 'cid'] }, { id: 'KS', nombre: 'KS', gente: ['ana', 'zig'] }] });
  const pub0 = CW.crewsPublico(o);
  ok(s.nuevas === 2 && s.gente === 4 && pub0.crews.find((c) => c.id === 'Follombia').gente[0][1] === 'lider'
    && pub0.crews.find((c) => c.id === 'KS').gente.length === 1 && pub0.crews.every((c) => c.oficial),
  'las de antes: con su gente, el primero de líder, nadie en dos crews, oficiales');
  ok(CW.sembrar(o, { crews: [{ id: 'Follombia', gente: ['dora'] }] }).nuevas === 0, 'sembrar dos veces no toca lo que ya está');

  const c1 = yo(1, 'dora', { accion: 'crear', nombre: 'Los del Barrio', sigla: 'ldb', entrada: 'pedido' });
  ok(c1.ok && c1.saldo === 2500 && c1.precio === CW.PRECIO_CREW, 'crear cuesta 2.500 Puntos de Tienda');
  ok(yo(1, 'dora', { accion: 'crear', nombre: 'Otra' }).error === 'ya_en_crew', 'una crew por persona');
  ok(yo(2, 'eli', { accion: 'crear', nombre: 'FOLLÓMBIA', sigla: 'FL' }).error === 'nombre_usado', 'el nombre no se repite (sin tildes ni mayúsculas)');
  ok(CW.crewAccion(o, { quien: id(3), de: '', accion: 'crear', nombre: 'Sin cuenta', inicial: 5000 }).error === 'verificate',
    'sin verificarse no se crea nada');
  ok(yo(4, 'pobre', { accion: 'crear', nombre: 'Pobres', sigla: 'PB', inicial: 1000 }).error === 'saldo', 'sin la plata, no');
  ok(yo(4, 'pobre', { accion: 'crear', nombre: 'Pobres', sigla: 'PB', desc: 'corta', inicial: 9000 }).error === 'desc'
    && yo(4, 'pobre', { accion: 'crear', nombre: 'Pobres', sigla: 'PB', logo_url: '', inicial: 9000 }).error === 'logo',
  'sin descripción o sin logo, no se crea');
  ok(CW.validarCrew({ accion: 'crear', logo_url: 'https://mal', logo_v: 'ok' }).logo_url === undefined
    && CW.validarCrew({ accion: 'crear', img: 'no es base64!' }).error === 'img', 'el logo filtrado NUNCA sale del pedido');
  ok(yo(4, 'pobre', { accion: 'crear', nombre: 'Pobres', inicial: 9000 }).error === 'sigla'
    && yo(4, 'pobre', { accion: 'crear', nombre: 'Pobres', sigla: ' ', inicial: 9000 }).error === 'sigla', 'sin sigla, no se crea');
  estado.ajustes = { crew_precio: 1000 };
  ok(yo(5, 'rico', { accion: 'crear', nombre: 'Ricos', sigla: 'RC' }).saldo === 4000, 'el precio sale del Dashboard');
  estado.ajustes = {};

  ok(yo(1, 'dora', { accion: 'invitar', a: 'fabi' }).ok && bandeja.some((b) => b.quien === '7000002002' && /Los del Barrio/.test(b.titulo)),
    'invitar: le llega a la campana si se sabe su cuenta');
  ok(yo(6, 'fabi', { accion: 'responder', crew: 'Los del Barrio', si: true }).ok, 'aceptar la invitación: entra');
  ok(yo(6, 'fabi', { accion: 'invitar', a: 'hugo' }).error === 'rol', 'un Miembro no invita');
  ok(yo(1, 'dora', { accion: 'rol', a: 'fabi', rol: 'veterano' }).ok && yo(6, 'fabi', { accion: 'invitar', a: 'hugo' }).ok,
    'el Líder lo hace Veterano, y el Veterano invita');
  ok(yo(7, 'gus', { accion: 'pedir', crew: 'Los del Barrio' }).pedido && bandeja.some((b) => b.quien === id(1) && /^Gus 🇦🇷 pidió entrar a Los del Barrio$/.test(b.titulo)),
    'con pedido: queda pedido, y al Líder le llega con el nombre (no la clave)');
  ok(yo(6, 'fabi', { accion: 'decidir', a: 'gus', si: true }).error === 'rol', 'un Veterano no acepta pedidos');
  ok(yo(1, 'dora', { accion: 'decidir', a: 'gus', si: true }).ok, 'el Líder acepta el pedido');
  ok(CW.crewsPublico(o).crews.find((c) => c.id === 'Los del Barrio').vence === 0
    && bandeja.some((b) => b.quien === id(1) && b.titulo === '🎉 Los del Barrio queda'),
  'la primera semana: con dos personas más, la crew queda, y al Líder le llega');
  ok(yo(1, 'dora', { accion: 'rol', a: 'gus', rol: 'colider' }).ok, 'el Líder hace Colíder');
  ok(yo(7, 'gus', { accion: 'rol', a: 'fabi', rol: 'colider' }).error === 'rol' && yo(7, 'gus', { accion: 'rol', a: 'fabi', rol: 'miembro' }).ok,
    'el Colíder baja a Miembro, pero no hace Colíder');
  ok(yo(7, 'gus', { accion: 'sacar', a: 'dora' }).error === 'rol', 'el Colíder no saca al Líder');
  ok(yo(1, 'dora', { accion: 'entrada', entrada: 'abierta' }).ok && yo(8, 'hugo', { accion: 'pedir', crew: 'Los del Barrio' }).ok
    && !yo(8, 'hugo', { accion: 'pedir', crew: 'Los del Barrio' }).pedido, 'abierta: se entra de una');
  ok(yo(7, 'gus', { accion: 'entrada', entrada: 'invitacion' }).error === 'rol', 'cómo se entra lo cambia sólo el Líder');

  // los 7 días
  ok(yo(6, 'fabi', { accion: 'salir' }).ok && yo(6, 'fabi', { accion: 'pedir', crew: 'Ricos' }).error === 'espera',
    'quien sale espera 7 días para entrar a otra');
  ok(yo(7, 'gus', { accion: 'sacar', a: 'hugo' }).ok && yo(8, 'hugo', { accion: 'crear', nombre: 'Hugos', sigla: 'HG' }).error === 'espera',
    'y quien sacan también (si no, «sacame y me meto en otra» saltea los 7 días)');

  // el líder
  ok(yo(1, 'dora', { accion: 'salir' }).error === 'lider_pasa_primero', 'el Líder no se va dejando la crew sin cabeza');
  ok(yo(1, 'dora', { accion: 'lider', a: 'gus' }).ok && CW.crewMia(o, { quien: id(1), de: 'dora' }).rol === 'colider'
    && CW.crewMia(o, { quien: id(7), de: 'gus' }).rol === 'lider', 'pasar el liderazgo: el viejo queda Colíder');

  // los representantes y el ranking
  estado.ajustes = { crews_ranking: { modo: 'reps', n: 2 } };
  ok(yo(7, 'gus', { accion: 'reps', reps: ['gus', 'dora', 'x'] }).error === 'reps' && yo(7, 'gus', { accion: 'reps', reps: ['gus', 'dora'] }).ok,
    'los representantes: hasta N y de la crew');
  estado.ajustes = {};

  // el tope de 20
  for (let i = 0; i < 25; i += 1) yo(1, 'dora', { accion: 'invitar', a: 'p' + i });
  for (let i = 0; i < 25; i += 1) yo(100 + i, 'p' + i, { accion: 'responder', crew: 'Los del Barrio', si: true });
  ok(CW.crewsPublico(o).crews.find((c) => c.id === 'Los del Barrio').gente.length === CW.CREW_MAX, 'nunca más de 20');

  // afuera, ningún Discord ID
  const pub = JSON.stringify(CW.crewsPublico(o));
  ok(!pub.includes(id(1)) && !pub.includes('7000002002') && !/"quien"/.test(pub), 'lo público no lleva ningún Discord ID');

  // el dueño elige el líder de las de antes; borrar
  ok(CW.crewDueno(o, { que: 'lider', crew: 'Follombia', a: 'cid' }).ok
    && CW.crewsPublico(o).crews.find((c) => c.id === 'Follombia').gente.find((g) => g[0] === 'cid')[1] === 'lider'
    && CW.crewsPublico(o).crews.find((c) => c.id === 'Follombia').gente.find((g) => g[0] === 'ana')[1] === 'colider',
  'Dlx elige el líder de una crew de antes');
  ok(CW.crewDueno(o, { que: 'borrar', crew: 'Ricos' }).ok && !CW.crewsPublico(o).crews.some((c) => c.id === 'Ricos')
    && yo(5, 'rico', { accion: 'crear', nombre: 'Ricos 2', sigla: 'RC2' }).ok, 'cerrar una crew deja a su gente libre, sin esperar');

  // borrar mis datos
  CW.crewOlvidar(o, 'cid');
  ok(CW.crewsPublico(o).crews.find((c) => c.id === 'Follombia').gente.find((g) => g[1] === 'lider')[0] === 'ana',
    'si el líder borra sus datos, la crew pasa al colíder');
  ok(yo(9, 'ana', { accion: 'nombre', nombre: 'Follombia' }).error === 'sigla' && yo(9, 'ana', { accion: 'nombre', nombre: 'Follombia', sigla: 'fol' }).ok
    && CW.crewsPublico(o).crews.find((c) => c.id === 'Follombia').sigla === 'FOL',
  'una de la Liga sin sigla la pone cuando su Líder toca el nombre');

  // 🖼️ el logo: dudoso espera, lo aprueba o lo quita quien revisa los fondos, y le llega al Líder
  const lr = yo(300, 'leo', { accion: 'crear', nombre: 'Logos', sigla: 'LG', logo_url: 'https://pub.r2.dev/logos-crews/b.webp', logo_v: 'revisar' });
  const pubLg = () => CW.crewsPublico(o).crews.find((c) => c.id === 'Logos');
  ok(lr.ok && lr.logo === 'revisar' && pubLg().logo === '' && pubLg().desc === CREAR.desc
    && CW.crewLogosDueno(o).pend.some((x) => x.id === 'Logos') && CW.crewMia(o, { quien: id(300), de: 'leo' }).logo_pend === true,
  'un logo dudoso: la crew se crea, el logo espera y no se ve');
  ok(CW.crewDueno(o, { que: 'logo', crew: 'Logos', si: true }).ok && pubLg().logo.endsWith('/b.webp')
    && bandeja.some((b) => b.quien === id(300) && /ya se ve/.test(b.titulo)), 'aprobado: se ve, y al Líder le llega');
  const ql = CW.crewDueno(o, { que: 'logo', crew: 'Logos', si: false, motivo: 'no va' });
  ok(ql.ok && ql.viejos[0].endsWith('/b.webp') && pubLg().logo === '' && bandeja.some((b) => b.quien === id(300) && /se quitó/.test(b.titulo)),
    'y se puede quitar uno que ya se ve (lo que el filtro dejó pasar)');
  yo(301, 'lu', { accion: 'pedir', crew: 'Logos' });
  yo(300, 'leo', { accion: 'decidir', a: 'lu', si: true });
  ok(yo(301, 'lu', { accion: 'logo', logo_url: 'https://pub.r2.dev/logos-crews/c.webp', logo_v: 'ok' }).error === 'rol'
    && CW.chequeoLogo(o, { de: 'lu' }).error === 'rol' && CW.chequeoLogo(o, { de: 'leo' }).ok, 'el logo lo cambia el Líder');
  const nl = yo(300, 'leo', { accion: 'logo', logo_url: 'https://pub.r2.dev/logos-crews/d.webp', logo_v: 'ok' });
  ok(nl.ok && pubLg().logo.endsWith('/d.webp') && yo(300, 'leo', { accion: 'desc', desc: 'Otra descripción, más larga' }).ok
    && pubLg().desc === 'Otra descripción, más larga' && yo(300, 'leo', { accion: 'desc', desc: 'no' }).error === 'desc',
  'el Líder cambia el logo y la descripción');
  ok(CW.chequeoCrear(o, Object.assign({ quien: id(302), de: 'mia', inicial: 5000, nombre: 'Logos', sigla: 'LG' }, CREAR)).error === 'nombre_usado'
    && CW.chequeoCrear(o, Object.assign({ quien: id(302), de: 'mia', inicial: 5000, nombre: 'Nueva', sigla: 'NV' }, CREAR)).ok,
  'el chequeo de crear, sin escribir nada (antes de gastar la IA en el logo)');
  CW.crewDueno(o, { que: 'borrar', crew: 'Logos' });

  // ⏳ la primera semana, en el tiempo
  const DIA = 86400000;
  CW.crewDueno(o, { que: 'borrar', crew: 'Ricos 2' });
  const t0 = Date.now();
  const sol = yo(200, 'sol', { accion: 'crear', nombre: 'Solos', sigla: 'SL', entrada: 'abierta' });
  const pubSol = () => CW.crewsPublico(o).crews.find((c) => c.id === 'Solos');
  ok(sol.ok && Math.abs(sol.vence - (t0 + CW.PRUEBA_MS)) < 5000 && pubSol().vence === sol.vence
    && bandeja.some((b) => b.quien === id(200) && b.titulo === '⏳ Solos: tenés una semana'),
  'una crew nueva nace con una semana, y al Líder le llega al crearla');
  ok(CW.crewsPublico(o).crews.filter((c) => c.oficial).every((c) => c.vence === 0), 'las de la Liga no tienen semana');
  const cuenta = (t) => bandeja.filter((b) => b.quien === id(200) && b.titulo === t).length;
  CW.crewVencer(o, t0 + 3 * DIA);
  ok(!cuenta('⏳ Quedan 2 días para Solos'), 'a mitad de semana, nada');
  CW.crewVencer(o, t0 + 5.5 * DIA);
  CW.crewVencer(o, t0 + 5.6 * DIA);
  ok(cuenta('⏳ Quedan 2 días para Solos') === 1 && bandeja.find((b) => b.titulo === '⏳ Quedan 2 días para Solos').cuerpo.startsWith('Le faltan 2 personas'),
    'a dos días le llega el recordatorio, una sola vez');
  ok(yo(201, 'tom', { accion: 'pedir', crew: 'Solos' }).ok && pubSol().vence > 0, 'con una persona más todavía no queda');
  CW.crewVencer(o, t0 + 6.5 * DIA);
  ok(cuenta('⏳ Último día para Solos') === 1 && bandeja.find((b) => b.titulo === '⏳ Último día para Solos').cuerpo.startsWith('Le falta 1 persona'),
    'el último día, otro, con lo que falta');
  const trio = yo(210, 'tri', { accion: 'crear', nombre: 'Trio', sigla: 'TR', entrada: 'abierta' });
  yo(211, 'u1', { accion: 'pedir', crew: 'Trio' });
  yo(212, 'u2', { accion: 'pedir', crew: 'Trio' });
  ok(trio.ok && CW.crewVencer(o, t0 + 8 * DIA) === 1 && !pubSol() && CW.crewsPublico(o).crews.some((c) => c.id === 'Trio'),
    'pasada la semana, la que no llegó se borra y la que llegó queda');
  ok(bandeja.some((b) => b.quien === id(200) && b.titulo === 'Solos se borró')
    && bandeja.some((b) => b.quien === id(201) && b.titulo === 'Solos se borró')
    && yo(201, 'tom', { accion: 'crear', nombre: 'Tomas', sigla: 'TM' }).ok, 'les llega a todos, y quedan libres sin esperar');
  ok(CW.crewDueno(o, { que: 'borrar', crew: 'Trio' }).ok && bandeja.some((b) => b.quien === id(211) && b.titulo === 'Trio se cerró'),
    'al cerrar una crew, a su gente le llega (las cuentas se buscan antes de borrar)');
}

console.log(mal ? `\n  🔴 ${mal} mal, ${bien} bien` : `  ✅ crews: ${bien} bien`);
if (mal) process.exit(1);
