"""📣 Un aviso de Dlx a la campana del equipo de TODOS los socios (26/11/2026).

Dlx: «send partners a message asking them to load their socials in Tu página». Va a la campana del panel de cada socio
(`avisoSocios()` en bot/avisos.js → `avisarEquipo()`): su bandeja y el push del teléfono. **Nunca por DM.** La clave hace
que correrlo dos veces no vuelva a sonar.

    python herramientas/avisar_socios.py --ver          # qué se manda, sin mandar
    python herramientas/avisar_socios.py --mandar       # lo manda
    python herramientas/avisar_socios.py --mandar FRZ   # sólo a esos servidores
"""
import os
import sys

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bot'))
import clave_ciclo as CC  # noqa: E402
import fotos as F  # noqa: E402

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'

# ✍️ el texto: corto (la campana corta el título a 120 y el cuerpo a 240), en «tú»
AVISO = {
    'clave': 'redes-2026-11-26',
    'titulo': '📲 Carga tus redes en «Tu página»',
    'cuerpo': ('Así tus batallas salen en Instagram como colaboración con tu cuenta y tus videos se ven en la Liga. '
               'En tu panel, «Tu página»: Instagram, TikTok y YouTube.'),
}


def main():
    a = sys.argv[1:]
    svs = [x.upper() for x in a if not x.startswith('--')]
    print('título:', AVISO['titulo'], '(%d)' % len(AVISO['titulo']))
    print('cuerpo:', AVISO['cuerpo'], '(%d)' % len(AVISO['cuerpo']))
    if '--mandar' not in a:
        print('\n(sin --mandar no se manda nada)')
        return
    k = CC.clave(F.env('DISCORD_TOKEN'))
    d = dict(AVISO, **({'svs': svs} if svs else {}))
    r = requests.post(WORKER + '/avisos/socios-aviso', json=d, headers={'x-lg-ciclo': k}, timeout=60)
    j = r.json() if r.ok else {}
    if not j.get('ok'):
        sys.exit('❌ no se mandó (%s): ¿está desplegado el Worker con /avisos/socios-aviso?' % r.status_code)
    por = j.get('por') or {}
    print('\n✅ a %d servidores, %d personas' % (len(por), sum(v for v in por.values() if v > 0)))
    for sv, n in sorted(por.items()):
        print('   %-6s %s' % (sv, 'falló' if n < 0 else n))


if __name__ == '__main__':
    main()
