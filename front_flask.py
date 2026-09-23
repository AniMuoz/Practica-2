from Berfre import dia, filtro1, inventario, total, pedir_archivo_visual
import private.informacion_delicada.diccionario

#
#PRUEBA DE FLASK
#
from flask import Flask, render_template, request, redirect, url_for, session

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

@front_flask.route('/stock', methods=['GET'])
def stock_total():
    # Obtenemos la ruta desde la sesión (o desde el formulario si viene como parámetro)
    ruta = session.get('ruta') or request.args.get('ruta')
    if ruta:
        nombre_archivo, ruta_creacion = total(ruta)
        session['alerta'] = f"archivo ({nombre_archivo}) creado en la ruta ({ruta_creacion})"
    else:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
    return redirect(url_for('home'))

@front_flask.route('/bodega', methods=['GET'])
def bodega():
    # Obtenemos la ruta desde la sesión (o desde el formulario si viene como parámetro)
    ruta = session.get('ruta') or request.args.get('ruta')
    if ruta:
        nombre_archivo, ruta_creacion = filtro1(ruta)
        session['alerta'] = f"Archivo {nombre_archivo} creado en la ruta {ruta_creacion}"
    else:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
    return redirect(url_for('home'))

@front_flask.route('/inventario_lugar', methods=['GET'])
def inventario_lugar():
    # Obtenemos la ruta desde la sesión (o desde el formulario si viene como parámetro)
    ruta = session.get('ruta') or request.args.get('ruta')
    dicub, dicpre, dicmat = diccionarios(ruta)
    if ruta:
        nombre_archivo, ruta_creacion = inventario(ruta, dicub)
        session['alerta'] = f"Archivo {nombre_archivo} creado en la ruta {ruta_creacion}"
    else:
        session['alerta'] = "Advertencia: Primero debes seleccionar un archivo."
    return redirect(url_for('home'))

def diccionarios(ruta):
    dicub = private.informacion_delicada.diccionario.ubicaciones
    dicpre = private.informacion_delicada.diccionario.precios
    dicmat = private.informacion_delicada.diccionario.creardicmar(ruta)
    return dicub, dicpre, dicmat

#home()

if __name__ == '__main__':
    front_flask.run(debug=True)
#
#
#