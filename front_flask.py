from Berfre import (dia, filtro1, filtro1_preview,
                    inventario, inventario_preview,
                    total, total_preview,
                    pedir_archivo_visual)
import private.informacion_delicada.diccionario
import io
from flask import Flask, render_template, request, redirect, url_for, session, send_file
import sys
import os
from flask import Flask

# Detectar si se está ejecutando como un .exe compilado
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    front_flask = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    front_flask = Flask(__name__)

# Clave secreta requerida para que Flask pueda usar 'session'
front_flask.secret_key = 'practica2_clave_secreta_desarrollo'

@front_flask.route('/')
def home():
    mi_variable = "¡Hola desde Python!"
    # Obtenemos la ruta almacenada en la sesión (o cadena vacía si no existe)
    ruta = session.get('ruta', '')
    # Obtenemos la alerta si existe y la eliminamos de la sesión para mostrarla solo una vez
    alerta = session.pop('alerta', None)
    return render_template('front.html', dato=mi_variable, dia_hoy=dia, ruta=ruta, alerta=alerta)

@front_flask.route('/ruta', methods=['GET'])
def ruta():
    archivo_seleccionado = pedir_archivo_visual()
    if archivo_seleccionado:
        # Guardamos la ruta en la sesión del usuario
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
    dicub, dicpre, dicmat = diccionarios(ruta)
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
    dicub, dicpre, dicmat = diccionarios(ruta)
    nombre_archivo, ruta_creacion = inventario(ruta, dicub)
    return send_file(ruta_creacion,
                     as_attachment=True,
                     download_name=nombre_archivo,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# ─── UTILIDADES ───────────────────────────────────────────────────────────────

def diccionarios(ruta):
    dicub = private.informacion_delicada.diccionario.ubicaciones
    dicpre = private.informacion_delicada.diccionario.precios
    dicmat = private.informacion_delicada.diccionario.creardicmar(ruta)
    return dicub, dicpre, dicmat

if __name__ == '__main__':
    front_flask.run(debug=True, port=5000)  
#
#
#