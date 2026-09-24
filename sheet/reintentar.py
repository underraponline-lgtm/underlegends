# -*- coding: utf-8 -*-
"""AGUANTAR UN «AHORA NO» DE GOOGLE SIN TIRAR LA CORRIDA.

    from reintentar import leer
    v = leer(hoja.get_all_values)

🔴 UN 429 TUMBABA EL CICLO ENTERO. Medido el 23/09/2026: la corrida
murió en el paso 2 con *«Quota exceeded for quota metric 'Read requests'
and limit 'Read requests per minute per user'»* **después** de haber
detectado dos eventos, cargado 21 filas de resultados y escrito las
cinco vitrinas. Todo ese trabajo se tiró por un límite que se pasa solo
en sesenta segundos.

⚠️ NO ES UNA FALLA, ES UN «AHORA NO». La cuota de Sheets es **por
minuto**: esperar sirve de verdad. Tratarla como un error es la misma
confusión que `CLAUDE.md` documenta con el pool vacío — un estado leído
como un fallo.

⚠️ Y EL CICLO LEE MUCHO MÁS QUE ANTES. Cinco vitrinas, cada una con su
cabecera y su verificación, más tres builders. Rozar la cuota dejó de
ser raro el día que las otras cuatro vitrinas entraron al ciclo.

⚠️ SOLO EL 429 Y EL 5xx. Un 400 o un 404 no mejoran esperando:
reintentarlos esconde el error real detrás de un minuto de espera.
"""
import sys
import time

#: cuánto esperar antes de cada reintento. La cuota es por minuto, así
#: que el último intento cae del otro lado de la ventana.
# ⚠️ HASTA 90 s, Y NO 45: después de una ráfaga Google sigue
# diciendo 429 más de un minuto. Medido el 24/09/2026 a las 12:23 PM
# ET: del primer 429 al último pasaron 93 s con cinco intentos, y el
# paso de las vitrinas murió igual. El trabajo tiene 20 min de techo
# y tarda ~6: la paciencia entra.
ESPERAS = (5, 15, 30, 60, 90)


def _es_cuota(e):
    """¿Este error es «esperá» y no «está mal»?"""
    txt = str(e)
    if '429' in txt or 'Quota exceeded' in txt or 'RATE_LIMIT' in txt:
        return True
    # gspread expone el código en `response`
    cod = getattr(getattr(e, 'response', None), 'status_code', None)
    return cod == 429 or (cod is not None and cod >= 500)


def leer(fn, *a, **kw):
    """Llama `fn(*a, **kw)` reintentando si Google dice que esperes."""
    ultimo = None
    for i, espera in enumerate((0,) + ESPERAS):
        if espera:
            time.sleep(espera)
        try:
            return fn(*a, **kw)
        except Exception as e:                           # noqa: BLE001
            if not _es_cuota(e):
                raise
            ultimo = e
            if i < len(ESPERAS):
                print('   ⏳ Sheets pidió esperar; %ds y reintento (%d/%d)'
                      % (ESPERAS[i], i + 1, len(ESPERAS)))
                sys.stdout.flush()
    raise ultimo


def _self_check():
    print('\n  reintentar.py — self-check\n')
    mal = 0

    class Falso(Exception):
        def __init__(self, txt, cod=None):
            Exception.__init__(self, txt)
            if cod is not None:
                self.response = type('r', (), {'status_code': cod})()

    casos = [
        ('un 429 se reintenta', Falso('APIError: [429]: Quota exceeded'), True),
        ('un 500 también', Falso('boom', 500), True),
        ('un 404 NO', Falso('APIError: [404]: no existe'), False),
        ('un 400 tampoco', Falso('APIError: [400]: mal pedido'), False),
    ]
    for que, e, esp in casos:
        ok = _es_cuota(e) is esp
        mal += not ok
        print('   %s %-24s %s' % ('✅' if ok else '🔴', que,
                                  'espera' if esp else 'levanta'))

    # 🔴 Y TIENE QUE DEVOLVER EL VALOR CUANDO EL SEGUNDO INTENTO ANDA.
    # Un reintento que reintenta y no devuelve es peor que no tenerlo.
    estado = {'n': 0}

    def flaky():
        estado['n'] += 1
        if estado['n'] < 2:
            raise Falso('APIError: [429]: Quota exceeded')
        return 'listo'

    global ESPERAS
    guardo, ESPERAS = ESPERAS, (0, 0, 0, 0)
    try:
        r = leer(flaky)
    finally:
        ESPERAS = guardo
    ok = r == 'listo' and estado['n'] == 2
    mal += not ok
    print('   %s el segundo intento devuelve el valor   %r en %d intento(s)'
          % ('✅' if ok else '🔴', r, estado['n']))

    # y un error que no es de cuota sube enseguida, sin esperar
    try:
        leer(lambda: (_ for _ in ()).throw(Falso('APIError: [404]: no')))
        ok = False
    except Exception as e:                               # noqa: BLE001
        ok = '404' in str(e)
    mal += not ok
    print('   %s un 404 sube enseguida, sin esperar' % ('✅' if ok else '🔴'))

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    raise SystemExit(_self_check())
