# El dibujo bajo demanda — lo medido y lo que falta

Estado al **20/09/2026**. Es el punto 4 de los cuatro que quedaban.

---

## La decisión que ya estaba tomada

**No se pre-generan las tarjetas. Se dibujan cuando alguien las pide.**
Medido: con 5,6 eventos diarios, **126 de 138 quedan viejas cada día, y 62
de ellas sin haber jugado** — el OVR se normaliza contra el máximo del pool
y los puestos son relativos.

```
pre-generar las 13 de cada uno   1.802 min/mes   90 % de Actions  ❌
bajo demanda                         73 min/mes    4 %            ✅
```

---

## ✅ PROBADO EL 20/09/2026: CLOUDFLARE DIBUJA NUESTRA CARTA

Dlx agregó los permisos que faltaban —**`Browser Run · Edit`** y
**`D1 · Edit`**, este último ya decidido para el cursor del polling y que
también faltaba—. Con eso se pudo hacer la prueba:

```bash
python herramientas/probar_navegador.py --carta
```

Manda el HTML **real** de una carta de Servidor, guarda el PNG y **lo resta
contra el que sale local**:

| | |
|---|---|
| tamaño | **1200×1948**, igual que el local |
| esquinas | alfa **0** en las cuatro — la silueta, no una caja |
| **error medio, imagen entera** | **1,034/255** |
| la foto | **0,00** — idéntica |
| el texto grande (`74`, `KONAN`) | **0 px de corrimiento** |

Para comparar: el paso a webp q90 que **ya está en producción** mide
**1,24/255**. O sea que la carta de la nube está más cerca de la local que
algo que ya se está sirviendo.

⚠️ **Ojo con las dos cifras que da la herramienta.** «24,90/255» es el
promedio **sólo sobre los píxeles que difieren** y «1,034» sobre la imagen
entera. Las dos son ciertas y contestan preguntas distintas; mezclarlas hace
parecer roto algo que no lo está.

### Lo que la prueba encontró, y no era de Cloudflare

**Las 138 de 138 llevaban un emoji del sistema en su TAG.** Está contado en
el commit del arreglo; el resumen es que ese carácter lo ponía la máquina
que dibuja, así que Actions —que corre en **Linux**— iba a sacar otro, o un
cuadradito si el contenedor no trae fuente. **Arreglado**: los 17 emoji del
proyecto viven en `comun/fonts/embed.css` bajo la familia `LigaEmoji`, y los
generan `herramientas/emoji_embed.py` + `herramientas/pila_emoji.py`.

### Lo único que sigue distinto, y se decidió dejarlo

El texto del chip mide **479 px local y 459 en la nube**. Medido apagando
cosas de a una:

```
letter-spacing 1.1px -> 0       479/459  ->  440/408   EMPEORA
font-size .54rem -> 9px         440/408  ->  440/429   mejora, no cierra
text-rendering:geometricPrecision          no mueve el numero
```

**Local da 440 con `.54rem` y con `9px`**, o sea que **Chrome en Windows
redondea el tamaño de letra a píxel entero y el de Linux no**. Es una
diferencia de plataforma.

Dlx lo miró a tamaño de Discord —donde es indistinguible— y a 2×:
*«si está bien como está»*. Y hay un motivo de fondo: **de acá en adelante
las cartas las dibuja la nube**, así que la que importa es ésa; la
diferencia sólo existe contra las viejas.

---

## El bloqueo que hubo, y cómo se resolvió

Durante unas horas del 20/09 esto estuvo frenado porque **el token no tenía
el permiso**. Queda escrito porque el síntoma es confuso y va a volver el
día que se rote el token:

```
KV · R2 · Workers      GET 200
Browser Rendering      GET 401      <- y el token decia `active`
```

⚠️ **`/user/tokens/verify` NO alcanza**: dice que el token es válido, no que
tenga el permiso. El nuestro salía `active` y aun así no podía abrir un
navegador. Lo que lo detecta es pegarle a cada servicio, que es lo que hace
`herramientas/probar_navegador.py`.

⚠️ **En el panel el permiso se llama «Browser Run», no «Browser Rendering».**
Se agrega en *My Profile → API Tokens → editar → + Add more →
`Account · Browser Run · Edit`*. **Editar un token no cambia su valor**, así
que el `.env` no se toca.

⚠️ **De paso faltaba `D1 · Edit`**, que ya estaba decidido para el cursor del
polling y que nadie había notado. Se agregó junto con el otro.

⚠️ **Hay un segundo camino y es peor.** Browser Rendering también entra al
Worker como *binding*, sin token — pero pide `@cloudflare/puppeteer`
empaquetado adentro, y este proyecto despliega **un solo `.js` sin paso de
build** (`bot/desplegar.py` manda el archivo tal cual). Montar un bundler
para esto es más trabajo y más cosas que se pueden romper que agregar un
permiso.

---

## ✅ LO QUE SÍ SE MIDIÓ, Y DECIDE EL DISEÑO

La idea del dibujo bajo demanda es **invertir el costo**: armar el HTML es
barato, abrir un navegador es caro. O sea que el HTML se pre-genera y se
guarda, y el navegador remoto sólo entra cuando alguien pide la carta.

Eso depende de cuánto pese el HTML. Medido sobre una carta de Servidor:

| | |
|---|---|
| las fuentes (`embed.css`) | 543,7 KB |
| el CSS de la carta | 14,9 KB |
| el cuerpo HTML | 748,9 KB — de eso **735,3 KB son 8 `data:` URI** |
| **total autocontenido** | **1.307,4 KB** |
| **con enlaces a R2** | **28,5 KB** |

**46 veces más chico.**

```
                          autocontenido    con enlaces
las 469 personas              598,8 MB        13,0 MB
las 4 cartas de cada una    2.395,3 MB        52,2 MB
```

⚠️ **Y la razón por la que hoy se embebe todo NO aplica en Cloudflare.** El
exportador local mete fuentes e imágenes en base64 porque *«Chromium no
llega al CDN de Discord ni a Google Fonts desde un entorno aislado»*. El
navegador de Browser Rendering **sí tiene internet**, así que puede bajar
las fuentes y las imágenes de R2 — que además ya es público
(`pub-*.r2.dev`).

⚠️ **El tope de un valor de KV son 25 MB**, así que hasta el autocontenido
entraría. El problema nunca fue el tope por valor: son **las 1.000
escrituras diarias** y el total.

---

## Los límites que van a mandar

| | |
|---|---|
| **Browser Run** | **10 min/día**, 3 concurrentes, 1 navegador nuevo cada 20 s |
| una carta | ~2,2 s → **~270 cartas por día** |
| KV escrituras | 1.000/día |
| R2 | 368 MB de 10 GB |

⚠️ **El techo diario es el que importa, y hay un riesgo nuevo que el modelo
pre-generado no tenía**: alguien insistiendo con `/card` puede quemar los 10
minutos. Lo tapa el caché —si la guardada es más nueva que el dato, no se
redibuja— pero **eso hay que confirmarlo midiendo**, no suponerlo. El freno
al spam que ya existe (`FRENO`: 4 comandos / 30 s) ayuda pero no alcanza:
cuatro personas distintas pidiendo cartas distintas pasan el freno y gastan
el presupuesto igual.

---

## El orden, y por dónde va

1. ~~**Una carta, una vez.**~~ ✅ **hecho el 20/09.** Sale a **1,034/255** de
   la local, con la foto idéntica. Y encontró el bug del emoji, que era
   invisible y afectaba a las 138.
2. **La misma carta con enlaces.** Subir las fuentes y los escudos a R2 y
   repetir. Tiene que dar **idéntico**; si da distinto, el problema está en
   qué no cargó, y eso se ve restando las dos imágenes.
3. **El caché.** El Worker compara el sello de la guardada contra
   `meta.sello` y sólo redibuja si está vieja.
4. **El presupuesto.** Contar los minutos gastados por día y cortar antes
   del techo, con un mensaje que diga qué pasó — no un error mudo.

⚠️ **Los pasos 1 y 2 son la mitad del trabajo y no se pueden saltear.** Los
dos errores que este proyecto ya se comió —`KeyError: 'URBF'` que tumbaba
las 138 por 2 personas, y una carpeta con su copia vieja del pool— **los dos
pasan la lectura del código**. El que los encuentra es generar y mirar.

Y el paso 1 lo demostró: la prueba salió «bien» en tamaño, transparencia y
peso, y **aun así había un bug que afectaba a las 138**. Sólo apareció al
restar las dos imágenes y mirar *dónde* diferían.

---

## 🔴 LO QUE FALTA ANTES QUE NADA: REDIBUJAR

**Las cartas que sirve el bot están en R2 con el emoji viejo y sin las 103
caras nuevas.** Hasta que se redibujen, el arreglo de la foto y el del emoji
existen en el repo y no en Discord.

```
3.220 cartas en R2      3,0 h en tanda (bot/cartas_nuevas.py, 3,35 s c/u)
las 552 principales     ~0,5 h  (138 × 4)
```

⚠️ **Y es la última vez que haría falta**, porque es exactamente lo que el
dibujo bajo demanda elimina: la carta se redibuja cuando alguien la pide, y
nunca más hay que correr un lote de tres horas.
