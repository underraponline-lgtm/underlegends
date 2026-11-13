"""Fondo 3 de la pantalla de carga, en 3D (Blender): las tarjetas de verdad paradas en un escenario.

    blender -b --factory-startup -P herramientas/tarjetas_3d.py -- <salida.png> <pc|cel> <carpeta de cartas> \
        <top 5 Temporada, con comas> <top 5 Competitivo, con comas> [eevee|cycles]

Lo llama herramientas/fondos_carga.py. Adelante el top 5 de la Temporada (el #1 al centro, más alto y con su luz),
arriba de una tarima el Competitivo (Dlx: «los competitivos apenas se ven»), y al fondo muchas tarjetas más, en gris y
fuera de foco. Piso negro que refleja, humo sólo detrás de la primera fila y luces blancas: el estilo de la bienvenida,
con el color sólo en las tarjetas del top.

⚠️ EEVEE PIDE PLACA DE VIDEO: en la nube no hay, y ahí va Cycles en la CPU (más lento, mismo cuadro).
"""
import bpy, math, os, random, sys

arg = sys.argv[sys.argv.index('--') + 1:]
SALIDA, FMT, CARTAS = arg[0], arg[1], arg[2]
TEM = arg[3].split(',')        # el primero es el #1: va al centro
COM = arg[4].split(',')
MOTOR = arg[5] if len(arg) > 5 else 'eevee'
random.seed(31)

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
if MOTOR == 'cycles':
    esc.render.engine = 'CYCLES'
    esc.cycles.device = 'CPU'
    esc.cycles.samples = 48
    esc.cycles.use_denoising = True
    esc.cycles.volume_step_rate = 4
    esc.cycles.max_bounces = 4
else:
    for motor in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            esc.render.engine = motor
            break
        except TypeError:
            pass
ee = esc.eevee
for nombre, valor in (('taa_render_samples', 96), ('use_raytracing', True), ('volumetric_tile_size', '4'),
                      ('volumetric_samples', 96), ('use_volumetric_shadows', True), ('use_shadows', True)):
    try:
        setattr(ee, nombre, valor)
    except Exception:
        pass
if FMT == 'pc':
    esc.render.resolution_x, esc.render.resolution_y = 1920, 1080
else:
    esc.render.resolution_x, esc.render.resolution_y = 1080, 2340
esc.render.resolution_percentage = 100
esc.render.film_transparent = False
try:
    esc.view_settings.view_transform = 'AgX'
    esc.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

# ── el mundo: oscuro con humo ──
mundo = bpy.data.worlds.new('mundo'); esc.world = mundo; mundo.use_nodes = True
nt = mundo.node_tree
nt.nodes['Background'].inputs['Color'].default_value = (0.008, 0.004, 0.014, 1)
nt.nodes['Background'].inputs['Strength'].default_value = 1
# el humo vive DETRÁS de la primera fila: así las tarjetas de adelante quedan nítidas y los haces se ven atrás
bpy.ops.mesh.primitive_cube_add(location=(0, 12, 5))
caja = bpy.context.object; caja.scale = (30, 10.5, 6)
mv = bpy.data.materials.new('humo'); mv.use_nodes = True
mn = mv.node_tree.nodes; mn.remove(mn['Principled BSDF'])
vol = mn.new('ShaderNodeVolumePrincipled')
vol.inputs['Density'].default_value = 0.035
vol.inputs['Color'].default_value = (0.92, 0.86, 1, 1)
mv.node_tree.links.new(vol.outputs[0], mn['Material Output'].inputs['Volume'])
caja.data.materials.append(mv)


def material_carta(ruta, gris=False):
    img = bpy.data.images.load(ruta)
    m = bpy.data.materials.new(os.path.basename(ruta)); m.use_nodes = True
    try:
        m.surface_render_method = 'DITHERED'
    except Exception:
        m.blend_method = 'HASHED'
    n = m.node_tree.nodes; l = m.node_tree.links
    p = n['Principled BSDF']
    t = n.new('ShaderNodeTexImage'); t.image = img
    color = t.outputs['Color']
    if gris:   # las de atrás, en blanco y negro (como las cartas de costado en la bienvenida)
        hs = n.new('ShaderNodeHueSaturation')
        hs.inputs['Saturation'].default_value = 0.0
        hs.inputs['Value'].default_value = 0.7
        l.new(t.outputs['Color'], hs.inputs['Color'])
        color = hs.outputs['Color']
    l.new(color, p.inputs['Base Color'])
    l.new(t.outputs['Alpha'], p.inputs['Alpha'])
    p.inputs['Roughness'].default_value = 0.32
    try:
        p.inputs['Coat Weight'].default_value = 0.6
        p.inputs['Coat Roughness'].default_value = 0.08
    except Exception:
        pass
    # un poco de luz propia: la tarjeta se lee aunque la luz no le pegue de frente
    try:
        l.new(color, p.inputs['Emission Color'])
        p.inputs['Emission Strength'].default_value = 0.18
    except Exception:
        pass
    return m, img.size[0] / img.size[1]


def carta(nombre, x, y, alto, rz=0.0, rx=90.0, z0=0.0, ry=0.0, gris=False):
    ruta = os.path.join(CARTAS, nombre + '.webp')
    if not os.path.exists(ruta):
        return None
    m, asp = material_carta(ruta, gris)
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object
    o.scale = (alto * asp, alto, 1)
    o.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    o.location = (x, y, z0 + alto / 2)
    o.data.materials.append(m)
    return o


# ── el piso: negro que refleja ──
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 10, 0))
piso = bpy.context.object
mp = bpy.data.materials.new('piso'); mp.use_nodes = True
pb = mp.node_tree.nodes['Principled BSDF']
pb.inputs['Base Color'].default_value = (0.01, 0.008, 0.014, 1)
pb.inputs['Roughness'].default_value = 0.12
piso.data.materials.append(mp)

# un disco de luz bajo Makma
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.95, fill_type='NGON', location=(0, 0, 0.004))
disco = bpy.context.object
md = bpy.data.materials.new('disco'); md.use_nodes = True
pd = md.node_tree.nodes['Principled BSDF']
pd.inputs['Base Color'].default_value = (0, 0, 0, 1)
try:
    pd.inputs['Emission Color'].default_value = (1.0, 1.0, 1.0, 1)
    pd.inputs['Emission Strength'].default_value = 0.55
except Exception:
    pass
disco.data.materials.append(md)

# ── las tarjetas ──
# adelante, la Temporada en arco: el #1 al centro y más grande, el #2 y el #3 a su lado, el #4 y el #5 en las puntas
LUGAR_F = [(0, 0, 2.55, 0), (1.7, 0.35, 2.1, -12), (-1.7, 0.35, 2.1, 12), (3.2, 0.9, 1.95, -24), (-3.2, 0.9, 1.95, 24)]
frente = [(k,) + l for k, l in zip(TEM, LUGAR_F)]
for k, x, y, h, rz in frente:
    carta(f'{k}__temporada', x, y, h, rz=rz)
# atrás, el Competitivo, con el mismo orden
LUGAR_A = [(0, 2.7, 2.2, 0), (-1.8, 2.75, 2.05, 7), (1.8, 2.75, 2.05, -7), (-3.6, 2.95, 1.95, 14), (3.6, 2.95, 1.95, -14)]
atras = [(k,) + l for k, l in zip(COM, LUGAR_A)]
# el Competitivo, arriba de una tarima: así se ve entero por encima de la primera fila (Dlx: «los competitivos apenas se ven»)
TARIMA = 2.15
bpy.ops.mesh.primitive_cube_add(location=(0, 2.85, TARIMA / 2))
tar = bpy.context.object; tar.scale = (5.4, 0.75, TARIMA / 2)
mt = bpy.data.materials.new('tarima'); mt.use_nodes = True
pt = mt.node_tree.nodes['Principled BSDF']
pt.inputs['Base Color'].default_value = (0.012, 0.011, 0.016, 1)
pt.inputs['Roughness'].default_value = 0.18
tar.data.materials.append(mt)
bpy.ops.mesh.primitive_cube_add(location=(0, 2.09, TARIMA - 0.012))    # el filo de luz de la tarima
filo = bpy.context.object; filo.scale = (5.4, 0.012, 0.012)
mf = bpy.data.materials.new('filo'); mf.use_nodes = True
pf = mf.node_tree.nodes['Principled BSDF']
try:
    pf.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    pf.inputs['Emission Strength'].default_value = 6
except Exception:
    pass
filo.data.materials.append(mf)
for k, x, y, h, rz in atras:
    carta(f'{k}__competitivo', x, y, h, rz=rz, z0=TARIMA)
# al fondo, todas las demás flotando
usadas = {f'{k}__temporada' for k in TEM} | {f'{k}__competitivo' for k in COM}
resto = sorted(f[:-5] for f in os.listdir(CARTAS) if f.endswith('.webp') and f[:-5] not in usadas)
random.shuffle(resto)
for i, k in enumerate(resto[:70]):
    x = random.uniform(-13, 13)
    y = random.uniform(5, 16)
    z0 = random.uniform(-0.2, 6.5)
    carta(k, x, y, random.uniform(1.6, 2.3), rz=random.uniform(-35, 35), rx=90 + random.uniform(-18, 18),
          ry=random.uniform(-25, 25), z0=z0, gris=True)

# ── luces ──
def luz(tipo, loc, rot, energia, color, tam=None, angulo=None):
    d = bpy.data.lights.new(tipo + str(loc), tipo)
    d.energy = energia; d.color = color
    if tam is not None:
        d.size = tam
    if angulo is not None:
        d.spot_size = math.radians(angulo); d.spot_blend = 0.5
    o = bpy.data.objects.new(d.name, d); bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = tuple(math.radians(a) for a in rot)
    return o


luz('AREA', (0, -7, 5), (58, 0, 0), 480, (1, 0.96, 0.94), tam=7)                 # la principal, suave
luz('SPOT', (-7, 6, 6), (55, 0, -130), 8000, (1, 1, 1), angulo=38)         # contraluz magenta
luz('SPOT', (7, 6, 6), (55, 0, 130), 8000, (1, 1, 1), angulo=38)           # contraluz celeste
luz('SPOT', (0, 0.6, 8), (0, 0, 0), 5000, (1, 0.97, 0.92), angulo=24)               # la de Makma, de arriba
for x in (-10, -5, 0, 5, 10):                                                          # haces al fondo
    luz('SPOT', (x, 18, 9), (-35, 0, 0), 3500, (1, 1, 1), angulo=14)

# ── la cámara ──
cd = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(cam); esc.camera = cam
if FMT == 'pc':
    cam.location = (0, -14.6, 3.0)
    cam.rotation_euler = (math.radians(88.6), 0, 0)
    cd.lens = 40
else:
    cam.location = (0, -12.5, 2.9)
    cam.rotation_euler = (math.radians(87.5), 0, 0)
    cd.lens = 32
    cd.sensor_fit = 'VERTICAL'
cd.dof.use_dof = True
cd.dof.focus_distance = math.hypot(cam.location.y, cam.location.z - 1.4)
cd.dof.aperture_fstop = 1.8

esc.render.image_settings.file_format = 'PNG'
esc.render.filepath = SALIDA
bpy.ops.render.render(write_still=True)
print('listo', SALIDA)
