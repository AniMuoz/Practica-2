from Berfre import (dia, filtro1, filtro1_preview,
                    inventario, inventario_preview,
                    total, total_preview,
                    pedir_archivo_visual,
                    modificar_diccionarios,
                    dic_agregar, dic_modificar, dic_eliminar,
                    dic_exportar_bytes, dic_importar_excel)
import private.informacion_delicada.diccionario
import io
import json
import os
from flask import (Flask, render_template, request, redirect,
                   url_for, session, send_file)
import sys

# Detectar si se está ejecutando como un .exe compilado
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    front_flask = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    front_flask = Flask(__name__)

# Clave secreta requerida para que Flask pueda usar 'session'
front_flask.secret_key = 'practica2_clave_secreta_desarrollo'

# ─── PERSISTENCIA GENÉRICA DE DICCIONARIOS ───────────────────────────────────

_JSON_DIR = os.path.join(os.path.dirname(__file__), 'private', 'informacion_delicada')

# Archivo JSON de override por nombre de diccionario
_JSON_FILES = {
    'ubicaciones': os.path.join(_JSON_DIR, 'ubicaciones_override.json'),
    'precios':     os.path.join(_JSON_DIR, 'precios_override.json'),
    'material':    os.path.join(_JSON_DIR, 'material_override.json'),
}

# Etiquetas legibles para la UI
_DIC_LABELS = {
    'ubicaciones': 'Ubicaciones',
    'precios':     'Precios',
    'material':    'Materiales',
}

# Nombres válidos
_DIC_VALIDOS = list(_DIC_LABELS.keys())


def _cargar_diccionario(nombre: str, ruta_excel: str = None) -> dict:
    """
    Devuelve el diccionario combinando el base del .py con el JSON de override.
    Para 'material' se necesita ruta_excel para cargar el base dinámico.
    """
    if nombre == 'ubicaciones':
        base = dict(private.informacion_delicada.diccionario.ubicaciones)
    elif nombre == 'precios':
        base = dict(private.informacion_delicada.diccionario.precios)
    elif nombre == 'material':
        if ruta_excel:
            try:
                base = dict(private.informacion_delicada.diccionario.creardicmar(ruta_excel))
            except Exception:
                base = {}
        else:
            base = {}
    else:
        return {}

    # Aplicar overrides del JSON (tienen prioridad sobre la base)
    json_path = _JSON_FILES.get(nombre)
    if json_path and os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                override = json.load(f)
            base.update(override)
        except Exception:
            pass
    return base


def _guardar_diccionario(nombre: str, dic: dict) -> None:
    """Persiste el diccionario completo en el JSON de override correspondiente."""
    json_path = _JSON_FILES.get(nombre)
    if json_path:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(dic, f, ensure_ascii=False, indent=2)


def _validar_nombre(nombre: str) -> str:
    """Valida y devuelve el nombre del diccionario; si es inválido retorna 'ubicaciones'."""
    return nombre if nombre in _DIC_VALIDOS else 'ubicaciones'

# ─── RUTAS PRINCIPALES ───────────────────────────────────────────────────────

@front_flask.route('/')
def home():
    mi_variable = "¡Hola desde Python!"
    ruta = session.get('ruta', '')
    alerta = session.pop('alerta', None)
    return render_template('front.html', dato=mi_variable, dia_hoy=dia, ruta=ruta, alerta=alerta)

@front_flask.route('/ruta', methods=['GET'])
def ruta():
    archivo_seleccionado = pedir_archivo_visual()
    if archivo_seleccionado:
        session['ruta'] = archivo_seleccionado
    return redirect(url_for('home'))

# ─── STOCK TOTAL ─────────────────────────────────────────────────────────────

@front_flask.route('/stock/preview', methods=['GET'])
def stock_preview():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    columnas, filas = total_preview(ruta)
    return render_template('front.html',
                           dato="¡Hola desde Python!",
                           dia_hoy=dia,
                           ruta=ruta,
                           alerta=None,
                           preview_titulo="Stock Total",
                           preview_columnas=columnas,
                           preview_filas=filas,
                           descarga_url=url_for('stock_descargar'))

@front_flask.route('/stock/descargar', methods=['GET'])
def stock_descargar():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    nombre_archivo, ruta_creacion = total(ruta)
    return send_file(ruta_creacion,
                     as_attachment=True,
                     download_name=nombre_archivo,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ─── BODEGA (M501) ───────────────────────────────────────────────────────────

@front_flask.route('/bodega/preview', methods=['GET'])
def bodega_preview():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    columnas, filas = filtro1_preview(ruta)
    return render_template('front.html',
                           dato="¡Hola desde Python!",
                           dia_hoy=dia,
                           ruta=ruta,
                           alerta=None,
                           preview_titulo="Bodega M501",
                           preview_columnas=columnas,
                           preview_filas=filas,
                           descarga_url=url_for('bodega_descargar'))

@front_flask.route('/bodega/descargar', methods=['GET'])
def bodega_descargar():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    nombre_archivo, ruta_creacion = filtro1(ruta)
    return send_file(ruta_creacion,
                     as_attachment=True,
                     download_name=nombre_archivo,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ─── INVENTARIO POR LUGAR ─────────────────────────────────────────────────────

@front_flask.route('/inventario_lugar/preview', methods=['GET'])
def inventario_preview_route():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    dicub = _cargar_diccionario('ubicaciones')
    columnas, filas = inventario_preview(ruta, dicub)
    return render_template('front.html',
                           dato="¡Hola desde Python!",
                           dia_hoy=dia,
                           ruta=ruta,
                           alerta=None,
                           preview_titulo="Inventario por Lugar",
                           preview_columnas=columnas,
                           preview_filas=filas,
                           descarga_url=url_for('inventario_descargar'))

@front_flask.route('/inventario_lugar/descargar', methods=['GET'])
def inventario_descargar():
    ruta = session.get('ruta') or request.args.get('ruta')
    if not ruta:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
        return redirect(url_for('home'))
    dicub = _cargar_diccionario('ubicaciones')
    nombre_archivo, ruta_creacion = inventario(ruta, dicub)
    return send_file(ruta_creacion,
                     as_attachment=True,
                     download_name=nombre_archivo,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ─── DICCIONARIOS (genérico para los 3) ──────────────────────────────────────

@front_flask.route('/diccionario_mod', methods=['GET'])
def diccionario_mod():
    nombre = _validar_nombre(request.args.get('dic', 'ubicaciones'))
    ruta_excel = session.get('ruta') if nombre == 'material' else None
    dic = _cargar_diccionario(nombre, ruta_excel)
    alerta = session.pop('alerta', None)
    busqueda = request.args.get('q', '').strip().lower()
    dic_filtrado = dic
    if busqueda:
        dic_filtrado = {k: v for k, v in dic.items()
                        if busqueda in k.lower() or busqueda in str(v).lower()}
    return render_template('diccionario_mod.html',
                           dic=dic_filtrado,
                           dic_nombre=nombre,
                           dic_label=_DIC_LABELS[nombre],
                           dic_labels=_DIC_LABELS,
                           alerta=alerta,
                           busqueda=request.args.get('q', ''),
                           material_sin_ruta=(nombre == 'material' and not ruta_excel))


@front_flask.route('/diccionario_mod/agregar', methods=['POST'])
def diccionario_agregar():
    nombre = _validar_nombre(request.form.get('dic_nombre', 'ubicaciones'))
    clave = request.form.get('clave', '').strip()
    valor = request.form.get('valor', '').strip()
    if not clave:
        session['alerta'] = "Error: la clave no puede estar vacía."
        return redirect(url_for('diccionario_mod', dic=nombre))
    ruta_excel = session.get('ruta') if nombre == 'material' else None
    dic = _cargar_diccionario(nombre, ruta_excel)
    dic_agregar(dic, clave, valor)
    _guardar_diccionario(nombre, dic)
    session['alerta'] = f"✔ Entrada '{clave}' agregada correctamente."
    return redirect(url_for('diccionario_mod', dic=nombre))


@front_flask.route('/diccionario_mod/modificar', methods=['POST'])
def diccionario_modificar():
    nombre = _validar_nombre(request.form.get('dic_nombre', 'ubicaciones'))
    clave = request.form.get('clave', '').strip()
    valor = request.form.get('valor', '').strip()
    if not clave:
        session['alerta'] = "Error: la clave no puede estar vacía."
        return redirect(url_for('diccionario_mod', dic=nombre))
    ruta_excel = session.get('ruta') if nombre == 'material' else None
    dic = _cargar_diccionario(nombre, ruta_excel)
    dic_agregar(dic, clave, valor)
    _guardar_diccionario(nombre, dic)
    session['alerta'] = f"✔ Entrada '{clave}' actualizada correctamente."
    return redirect(url_for('diccionario_mod', dic=nombre))


@front_flask.route('/diccionario_mod/eliminar', methods=['POST'])
def diccionario_eliminar():
    nombre = _validar_nombre(request.form.get('dic_nombre', 'ubicaciones'))
    clave = request.form.get('clave', '').strip()
    if not clave:
        session['alerta'] = "Error: la clave no puede estar vacía."
        return redirect(url_for('diccionario_mod', dic=nombre))
    ruta_excel = session.get('ruta') if nombre == 'material' else None
    dic = _cargar_diccionario(nombre, ruta_excel)
    resultado = dic_eliminar(dic, clave)
    if resultado is None:
        session['alerta'] = f"⚠ La clave '{clave}' no existe en el diccionario."
    else:
        _guardar_diccionario(nombre, resultado)
        session['alerta'] = f"✔ Entrada '{clave}' eliminada correctamente."
    return redirect(url_for('diccionario_mod', dic=nombre))


@front_flask.route('/diccionario_mod/exportar', methods=['GET'])
def diccionario_exportar():
    nombre = _validar_nombre(request.args.get('dic', 'ubicaciones'))
    ruta_excel = session.get('ruta') if nombre == 'material' else None
    dic = _cargar_diccionario(nombre, ruta_excel)
    buffer = dic_exportar_bytes(dic, nombre)
    return send_file(buffer,
                     as_attachment=True,
                     download_name=f"diccionario_{nombre}_exportado.xlsx",
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@front_flask.route('/diccionario_mod/importar', methods=['POST'])
def diccionario_importar():
    nombre = _validar_nombre(request.form.get('dic_nombre', 'ubicaciones'))
    archivo = request.files.get('archivo')
    if not archivo or archivo.filename == '':
        session['alerta'] = "Error: no se seleccionó ningún archivo."
        return redirect(url_for('diccionario_mod', dic=nombre))
    try:
        nuevas = dic_importar_excel(archivo.read())
        ruta_excel = session.get('ruta') if nombre == 'material' else None
        dic = _cargar_diccionario(nombre, ruta_excel)
        dic.update(nuevas)
        _guardar_diccionario(nombre, dic)
        session['alerta'] = f"✔ Importación exitosa: {len(nuevas)} entradas cargadas."
    except Exception as e:
        session['alerta'] = f"Error al importar: {e}"
    return redirect(url_for('diccionario_mod', dic=nombre))

# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    front_flask.run(debug=True, port=5000)