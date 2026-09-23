from Berfre import dia, filtro1, inventario, total, pedir_archivo_visual

#
#PRUEBA DE FLASK
#
from flask import Flask, render_template, request, redirect, url_for

front_flask = Flask(__name__)

@front_flask.route('/')
def home():
    mi_variable = "¡Hola desde Python!"
    return render_template('front.html', dato = mi_variable, dia_hoy = dia) 

@front_flask.route('/ruta', methods=['GET'])
def ruta():
    ruta = pedir_archivo_visual()
    ruta
    return redirect(url_for('home'))

@front_flask.route('/stock', methods=['GET'])
def stock_total():
    ruta = request.args.get('ruta')
    total(ruta)
    return redirect(url_for('home'))

#home()

if __name__ == '__main__':
    front_flask.run(debug=True)
#
#
#