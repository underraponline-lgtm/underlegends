// 🔍 ¿QUÉ SE PIERDE SI app.js NO DIBUJA LO VIEJO? (04/10/2026, la primera tanda de sacar app.js; Dlx: «A»)
//
// `pintaDatos()` de bot/paginas/app.js corre una lista corta mientras manda la página nueva y la larga si se cae
// (`mandaLoNuevo()`). Esto mira los pintores que la corta deja afuera y lista cada variable de arriba que escriben
// —ellos o lo que llaman—, con quién más la lee: React (`window.X` en web/src) o app.js fuera de esos pintores.
// Si aparece una que lee React y nadie más escribe, hay que llevarla a la lista corta.
//
//   node web/efectos_app.cjs        (usa @babel de web/node_modules)
//
// ⚠️ Lee el AST, no corre nada: una variable escrita por `window['X']` o por `eval` no la ve.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const RAIZ = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(RAIZ, 'bot/paginas/app.js'), 'utf8');
const ast = parser.parse(src, { sourceType: 'script', errorRecovery: true });

const top = new Set(), funcs = new Set();
for (const n of ast.program.body) {
  if (n.type === 'FunctionDeclaration') { top.add(n.id.name); funcs.add(n.id.name); }
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') {
    top.add(d.id.name);
    if (d.init && /Function/.test(d.init.type)) funcs.add(d.id.name);
  }
}
const llama = new Map(), escribe = new Map(), lee = new Map();
const add = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
function dueno(p) {
  let q = p;
  while (q && q.parentPath && q.parentPath.node.type !== 'Program') q = q.parentPath;
  if (!q) return null;
  const n = q.node;
  if (n.type === 'FunctionDeclaration') return n.id.name;
  if (n.type === 'VariableDeclaration') { const d = n.declarations.find((x) => p.node.start >= x.start && p.node.end <= x.end); return d && d.id.name; }
  return '@L' + n.loc.start.line;
}
const esTop = (p, name) => { const b = p.scope.getBinding(name); return top.has(name) && (!b || b.scope.block.type === 'Program'); };
const raizDe = (n) => { while (n && n.type === 'MemberExpression') n = n.object; return n; };
let listas = null;
traverse(ast, {
  AssignmentExpression(p) {
    const r = raizDe(p.node.left);
    if (r && r.type === 'Identifier' && esTop(p, r.name)) { const d = dueno(p); if (d && d !== r.name) add(escribe, d, r.name); }
  },
  UpdateExpression(p) {
    const r = raizDe(p.node.argument);
    if (r && r.type === 'Identifier' && esTop(p, r.name)) { const d = dueno(p); if (d) add(escribe, d, r.name); }
  },
  CallExpression(p) {
    const c = p.node.callee;
    if (c.type === 'MemberExpression' && /^(push|pop|shift|unshift|splice|sort|reverse|set|add|delete|clear)$/.test((c.property && c.property.name) || '')) {
      const r = raizDe(c.object);
      if (r && r.type === 'Identifier' && esTop(p, r.name)) { const d = dueno(p); if (d) add(escribe, d, r.name); }
    }
  },
  ConditionalExpression(p) {
    // la lista corta y la larga de `pintaDatos()`: `(nuevo ? [...] : [...])`
    if (dueno(p) !== 'pintaDatos' || p.node.consequent.type !== 'ArrayExpression' || p.node.alternate.type !== 'ArrayExpression') return;
    const nombres = (a) => a.elements.filter((e) => e && e.type === 'Identifier').map((e) => e.name);
    listas = { corta: nombres(p.node.consequent), larga: nombres(p.node.alternate) };
  },
  Identifier(p) {
    if (!p.isReferencedIdentifier() || !esTop(p, p.node.name)) return;
    const d = dueno(p);
    if (!d || d === p.node.name) return;
    add(funcs.has(p.node.name) ? llama : lee, d, p.node.name);
  },
});
if (!listas) { console.error('🔴 no encontré `nuevo ? [...] : [...]` en pintaDatos()'); process.exit(1); }
const SALTEA = listas.larga.filter((f) => !listas.corta.includes(f)).concat(['pintaFase']);
const cierre = (f) => {
  const vis = new Set(), pila = [f];
  while (pila.length) { const x = pila.pop(); if (vis.has(x)) continue; vis.add(x); for (const y of llama.get(x) || []) pila.push(y); }
  return vis;
};
const web = fs.readdirSync(path.join(RAIZ, 'web/src')).filter((f) => /\.(js|jsx)$/.test(f))
  .map((f) => fs.readFileSync(path.join(RAIZ, 'web/src', f), 'utf8')).join('\n');
const deReact = new Set([...web.matchAll(/\b(?:window|W|w)\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
const enSalteados = new Set(SALTEA.flatMap((f) => [...cierre(f)]));
// lo que corre igual: la lista corta, lo que React llama, lo que llama alguien de afuera de los salteados (`pinta()`
// llama a `pintaVivo()` aunque `pintaHero()` también lo haga) y todo lo que eso llama. ⚠️ Una función muerta que
// llame a algo lo da por vivo: el chequeo puede callar de más, nunca gritar de más
const vivos = new Set(listas.corta);
for (const [d, s] of llama) if (!enSalteados.has(d)) for (const g of s) vivos.add(g);
for (const x of deReact) if (funcs.has(x)) vivos.add(x);
const corre = new Set([...vivos].flatMap((f) => [...cierre(f)]));
const escribenOtros = (v) => [...escribe].some(([d, s]) => s.has(v) && (corre.has(d) || (!funcs.has(d) && !enSalteados.has(d))));
const total = new Map();
for (const f of SALTEA) for (const g of cierre(f)) for (const v of escribe.get(g) || []) {
  if (!total.has(v)) total.set(v, new Set());
  total.get(v).add(g === f ? f : f + '>' + g);
}
let alarma = 0;
console.log('se saltean', SALTEA.length, 'pintores; corren igual:', listas.corta.join(', '));
for (const [v, quien] of [...total].sort()) {
  const lectores = [...lee].filter(([d, s]) => s.has(v) && !enSalteados.has(d)).map(([d]) => d);
  const react = deReact.has(v), otro = escribenOtros(v);
  const marca = react && !otro ? '🔴 la lee React y sólo la escriben pintores salteados' : react ? '⚠️ la lee React (la escribe también otro)' : '';
  if (react && !otro) alarma++;
  console.log(v.padEnd(16), marca + '\n   escriben: ' + [...quien].slice(0, 4).join(' | ') + '\n   leen fuera: ' + (lectores.slice(0, 10).join(', ') || '—'));
}
if (alarma) { console.log('\n🔴', alarma, 'variable(s) que React necesita y ya nadie escribe'); process.exit(1); }
console.log('\n✓ nada de lo que React lee depende sólo de lo que se saltea');
