"""
EXPLORAR EL SHEET
=================

Lista las hojas y la cabecera de cada ranking. Sirve para ver si cambiaron las
columnas antes de que un pool salga mal en silencio.

    python3 sheet/explorar_sheet.py
"""
import os, json, sys
# ⚠️ LA CONSOLA DE WINDOWS ABRE EN cp1252 Y ESTE SCRIPT NO PODIA CORRER. La
# cabecera del Ranking Temporada trae un 🥇 y el print reventaba con
# UnicodeEncodeError DESPUES de listar las hojas, o sea que parecia que el
# Sheet estaba mal y era la terminal. Ya paso en otros scripts del repo.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
import gspread
from google.oauth2.service_account import Credentials

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en
# cinco archivos: hoy coinciden y por eso no se nota, pero **la T1
# estrena planilla nueva** y ese dia el que se olvide de actualizar su
# copia lee la planilla vieja y devuelve datos validos de la temporada
# equivocada. No falla: miente.
from planillas import OFICIAL as SHEET  # noqa: E402
# donde esta la cabecera de cada hoja (indice 0)
CABECERAS = {'Ranking Temporada': 15, 'Ranking Competitivo': 11,
             'Ranking Podios': 10, 'Ranking de Ligas': 8}

def main():
    creds = os.path.join(RAIZ, 'creds.json')
    if not os.path.exists(creds):
        print('falta creds.json en la raiz del proyecto'); return
    # SOLO LECTURA a proposito: ninguno de estos scripts escribe en el Sheet.
    # Con `spreadsheets` a secas el token podria modificarlo aunque el codigo
    # no lo haga, y `drive` daba acceso a todo el Drive de la cuenta.
    sc = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    gc = gspread.authorize(Credentials.from_service_account_file(creds, scopes=sc))
    sh = gc.open_by_key(SHEET)
    print('SHEET:', sh.title, '\n')
    for ws in sh.worksheets():
        print('%-24s gid=%-12s %d x %d' % (ws.title, ws.id, ws.row_count, ws.col_count))
    print()
    for hoja, fila in CABECERAS.items():
        try:
            v = ws_ = sh.worksheet(hoja).get_all_values()
        except Exception as e:
            print('%-22s no se pudo leer: %s' % (hoja, e)); continue
        if len(v) <= fila:
            print('%-22s tiene menos filas de las esperadas' % hoja); continue
        H = [x.strip() for x in v[fila] if x.strip()]
        datos = [r for r in v[fila+1:] if r and r[0].strip()]
        print('%s  (cabecera fila %d, %d filas de datos)' % (hoja, fila+1, len(datos)))
        print('   ' + ' · '.join(H))
        print()

if __name__ == '__main__':
    main()
