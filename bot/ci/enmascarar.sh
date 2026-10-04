#!/usr/bin/env bash
# 🛡️ CADA VALOR DE LOS SECRETOS, ENMASCARADO POR SEPARADO (04/10/2026, la lista de seguridad de Dlx).
#
#   bash bot/ci/enmascarar.sh .env creds.json [oauth_token.json]
#
# 🔴 POR QUÉ EXISTE. `ENV_FILE` y `CREDS_JSON` son secrets de VARIAS líneas, y GitHub tapa un secret así renglón por
# renglón: si un script imprime UN valor de adentro —sin el `NOMBRE=` de su línea— sale tal cual. Pasó: la auditoría
# del 29/09 imprimió `fotos/<FOTOS_SAL>-t1/` (`comun/temporada.py`), y con esa sal cualquiera arma la dirección de las
# caras en el R2 público. Quedó a la vista en el repo público.
#
# ⚠️ Se corre apenas se escriben los archivos, antes de cualquier otra cosa. `::add-mask::` no se ve en el log: el
# runner lo consume y desde ahí tapa ese texto en todo lo que siga. Un valor corto (menos de 6) no se tapa: taparía
# medio log y no protege nada.
set -u
for f in "$@"; do
  [ -f "$f" ] || continue
  case "$f" in
    *.json)
      # del JSON, sólo los campos que son credencial: taparlo entero también taparía «service_account» o la URL de Google
      python - "$f" <<'PY'
import io, json, sys
CAMPOS = ('private_key', 'private_key_id', 'client_id', 'client_email', 'client_secret', 'refresh_token', 'token',
          'access_token', 'id_token')
try:
    d = json.load(io.open(sys.argv[1], encoding='utf-8-sig'))
except Exception:
    sys.exit(0)
vistos = set()
def recorrer(x):
    if isinstance(x, dict):
        for k, v in x.items():
            if k in CAMPOS and isinstance(v, str):
                for l in v.splitlines():
                    l = l.strip()
                    if len(l) >= 6:
                        vistos.add(l)
            else:
                recorrer(v)
    elif isinstance(x, list):
        for v in x:
            recorrer(v)
recorrer(d)
for v in sorted(vistos):
    print('::add-mask::' + v)
PY
      ;;
    *)
      # del .env, cada valor: lo que va después del primer `=`, sin comillas
      while IFS= read -r l || [ -n "$l" ]; do
        case "$l" in ''|'#'*) continue ;; esac
        v="${l#*=}"
        v="${v%$'\r'}"
        v="${v#\"}"; v="${v%\"}"; v="${v#\'}"; v="${v%\'}"
        [ "${#v}" -ge 6 ] && echo "::add-mask::$v"
      done < "$f"
      ;;
  esac
done
exit 0
