import datetime
import io
import os

import openpyxl
from flask import Flask, flash, redirect, render_template_string, request, send_file, url_for
from openpyxl.styles import Alignment, Border, Font, NamedStyle, Side

app = Flask(__name__)
app.secret_key = "planilla-gastos-test"

data = [[], [], [], [], []]

fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month).zfill(2) + str(fecha.day).zfill(2)
fecha_pro = f"{fecha.day}/{fecha.month}/{fecha.year}"

topicos = [
    "CONSUMOS BASICOS",
    "TELEFONO E INTERNET",
    "GASTOS COMUNES",
    "ARRIENDO DE OFICINA",
    "COMBUSTIBLE",
    "ESCRITORIO Y OFICINA",
    "ESTACIONAMIENTO",
    "ARTICULOS DE ASEO",
    "GASTOS DE REPRESENTACIÓN",
    "VESTUARIO Y CALZADO",
    "PASAJES, PEAJES Y CORREOS",
    "MANTENIMIENTO, REPARACIÓN Y SEGURIDAD",
    "EQUIPAMIENTO",
    "ALIMENTACIÓN",
    "OTROS",
]

PAGE = """
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Gestión de Gastos</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 24px; color: #1a1a1a; }
    h1 { margin-bottom: 4px; }
    .muted { color: #555; margin-top: 0; }
    form.grid { display: grid; grid-template-columns: 160px 280px; gap: 8px 12px; max-width: 480px; align-items: center; }
    label { font-weight: 600; }
    input, select, button { padding: 6px 8px; font-size: 14px; }
    button, .btn { background: #1f4e79; color: white; border: 0; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    button.quitar { background: #8b2e2e; }
    td form { display: flex; gap: 6px; }
    td input, td select { width: 100%; box-sizing: border-box; }
    .actions { margin: 16px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #e8eef4; }
    .flash { background: #fff4d6; border: 1px solid #e0c36a; padding: 8px 12px; margin: 12px 0; }
    footer { margin-top: 28px; color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Gestión de Gastos</h1>
  <p class="muted">Berfre Ltda. · Hoy es {{ fecha_pro }}</p>
  <p class="muted">Codigo de dia: {{ dia }}</p>
  {% with messages = get_flashed_messages() %}
    {% if messages %}
      {% for message in messages %}
        <div class="flash">{{ message }}</div>
      {% endfor %}
    {% endif %}
  {% endwith %}

  <form class="grid" method="post" action="{{ url_for('agregar') }}">
    <label for="topico">Tópico</label>
    <select id="topico" name="topico" required>
      <option value="">Seleccione</option>
      {% for topico in topicos %}
        <option value="{{ topico }}">{{ topico }}</option>
      {% endfor %}
    </select>
    <label for="proveedor">Proveedor</label>
    <input id="proveedor" name="proveedor" required>
    <label for="nboleta">N° Boleta</label>
    <input id="nboleta" name="nboleta" required>
    <label for="fecha_boleta">Fecha boleta</label>
    <input id="fecha_boleta" name="fecha_boleta" required>
    <label for="monto">Monto</label>
    <input id="monto" name="monto" inputmode="numeric" required>
    <span></span>
    <button type="submit">Agregar</button>
  </form>

  <div class="actions">
    <a class="btn" href="{{ url_for('guardar') }}">Guardar datos</a>
    <form method="post" action="{{ url_for('recuperar') }}" enctype="multipart/form-data">
      <input type="file" name="archivo" accept=".xlsx" required>
      <button type="submit">Recuperar datos</button>
    </form>
    <form method="post" action="{{ url_for('procesar') }}">
      <input name="mes" placeholder="Mes" required>
      <button type="submit">Procesar datos</button>
    </form>
  </div>

  <table>
    <thead>
      <tr>
        <th>Tópico</th>
        <th>Proveedor</th>
        <th>N° Boleta</th>
        <th>Fecha boleta</th>
        <th>Monto</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {% for fila in filas %}
        <tr>
          {% if editar == loop.index0 %}
            <td>
              <select name="topico" form="editar-{{ loop.index0 }}" required>
                {% for topico in topicos %}
                  <option value="{{ topico }}" {% if topico == fila[0] %}selected{% endif %}>{{ topico }}</option>
                {% endfor %}
                {% if fila[0] not in topicos %}
                  <option value="{{ fila[0] }}" selected>{{ fila[0] }}</option>
                {% endif %}
              </select>
            </td>
            <td><input name="proveedor" form="editar-{{ loop.index0 }}" value="{{ fila[1] }}" required></td>
            <td><input name="nboleta" form="editar-{{ loop.index0 }}" value="{{ fila[2] }}" required></td>
            <td><input name="fecha_boleta" form="editar-{{ loop.index0 }}" value="{{ fila[3] }}" required></td>
            <td><input name="monto" form="editar-{{ loop.index0 }}" value="{{ fila[4] }}" inputmode="numeric" required></td>
            <td>
              <form id="editar-{{ loop.index0 }}" method="post" action="{{ url_for('modificar', indice=loop.index0) }}"></form>
              <button type="submit" form="editar-{{ loop.index0 }}">Guardar</button>
              <a class="btn" href="{{ url_for('index') }}">Cancelar</a>
            </td>
          {% else %}
            <td>{{ fila[0] }}</td>
            <td>{{ fila[1] }}</td>
            <td>{{ fila[2] }}</td>
            <td>{{ fila[3] }}</td>
            <td>{{ fila[4] }}</td>
            <td>
              <a class="btn" href="{{ url_for('index', editar=loop.index0) }}">Modificar</a>
              <form method="post" action="{{ url_for('eliminar', indice=loop.index0) }}">
                <button class="quitar" type="submit">Quitar</button>
              </form>
            </td>
          {% endif %}
        </tr>
      {% else %}
        <tr><td colspan="6">Sin boletas cargadas.</td></tr>
      {% endfor %}
    </tbody>
  </table>
  <footer>© 2026 Berfre Ltda. Todos los derechos reservados.</footer>
</body>
</html>
"""


def filas_vista():
    return list(zip(data[0], data[1], data[2], data[3], data[4]))


def leer_boleta():
    topico = request.form.get("topico", "").strip()
    proveedor = request.form.get("proveedor", "").strip()
    nboleta = request.form.get("nboleta", "").strip()
    fecha_boleta = request.form.get("fecha_boleta", "").strip()
    monto = request.form.get("monto", "").strip()
    if not (topico and proveedor and nboleta and fecha_boleta and monto):
        return None, "Debe completar todos los campos."
    try:
        monto = int(monto)
    except ValueError:
        return None, "El monto debe ser un número entero."
    return (topico, proveedor, nboleta, fecha_boleta, monto), None


def workbook_sin_procesar():
    guardar = openpyxl.Workbook()
    hoja1 = guardar.active
    for i in range(len(data[1])):
        hoja1.cell(row=i + 1, column=1, value=data[0][i])
        hoja1.cell(row=i + 1, column=2, value=data[1][i])
        hoja1.cell(row=i + 1, column=3, value=data[2][i])
        hoja1.cell(row=i + 1, column=4, value=data[3][i])
        hoja1.cell(row=i + 1, column=5, value=data[4][i])
    return guardar


def workbook_procesado(mes):
    monto_final = []
    guardias = openpyxl.Workbook()
    hoja = guardias.active

    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )
    accounting_style = NamedStyle(name="accounting", number_format="$#")

    hoja.column_dimensions["B"].width = 60
    hoja.column_dimensions["C"].width = 15
    hoja.column_dimensions["D"].width = 15
    hoja.column_dimensions["E"].width = 25

    mes_txt = mes.upper()
    hoja["B3"] = "EMPRESA: PRETORIANOS SEGURIDAD"
    hoja["B4"] = "DIRECCIÓN: MANUEL BULNES Nº 920, OFICINA 208, QUILPUÉ"
    hoja["B6"] = f"DETALLE GENERAL DE GASTOS MES {mes_txt} DEL AÑO {fecha.year}"
    hoja["B6"].font = Font(bold=True, size=12)

    hoja["B8"] = "CLASIFICACION DEL GASTO"
    hoja["B8"].font = Font(bold=True, size=12)
    hoja["B8"].border = thin_border
    hoja["C8"] = "MONTO ($)"
    hoja["C8"].font = Font(bold=True, size=12)
    hoja["C8"].border = thin_border

    for i in range(9, 25):
        hoja[f"B{i}"].border = thin_border

    for indice, topico in enumerate(topicos):
        hoja.cell(row=9 + indice, column=2, value=topico)

    hoja["B24"] = "TOTAL GASTOS DEL MES"
    hoja["B24"].font = Font(bold=True, size=12)
    # C9:C23 cubre los 15 tópicos, incluido OTROS.
    hoja["C24"] = "=SUM(C9:C23)"
    hoja["C24"].font = Font(bold=True, size=12)
    hoja["C24"].style = accounting_style
    hoja["C24"].border = thin_border

    hoja["D27"] = "FREDDY ANDRES MUÑOZ OLIVARES"
    hoja["D27"].font = Font(bold=True, size=12)
    hoja["D27"].alignment = Alignment(horizontal="center", vertical="center")
    hoja["D28"] = "GERENTE GENERAL"
    hoja["D28"].font = Font(bold=True, size=12)
    hoja["D28"].alignment = Alignment(horizontal="center", vertical="center")

    fila = 31
    for topico in topicos:
        hoja.cell(
            row=fila,
            column=2,
            value=f"DETALLE GASTOS EN {topico} MES {mes_txt} DEL AÑO {fecha.year}",
        ).font = Font(bold=True, size=12)

        x_inicial = fila + 2
        encabezados = ("PROVEEDOR", "N° DE BOLETA", "FECHA", "MONTO ($)")
        for columna, titulo in enumerate(encabezados, start=2):
            celda = hoja.cell(row=x_inicial, column=columna, value=titulo)
            celda.font = Font(bold=True, size=11)
            celda.alignment = Alignment(horizontal="center", vertical="center")
            celda.border = thin_border

        contador = 1
        hoja.cell(row=x_inicial + contador, column=2, value="-").border = thin_border
        hoja.cell(row=x_inicial + contador, column=3, value="-").border = thin_border
        hoja.cell(row=x_inicial + contador, column=4, value="-").border = thin_border
        hoja.cell(row=x_inicial + contador, column=5, value=0).border = thin_border

        x_final = x_inicial
        for j in range(len(data[1])):
            if data[0][j] == topico:
                hoja.cell(row=x_inicial + contador, column=2, value=data[1][j]).border = thin_border
                hoja.cell(row=x_inicial + contador, column=3, value=data[2][j]).border = thin_border
                hoja.cell(row=x_inicial + contador, column=4, value=data[3][j]).border = thin_border
                monto = hoja.cell(row=x_inicial + contador, column=5, value=data[4][j])
                monto.border = thin_border
                monto.style = accounting_style
                contador += 1
                x_final += 1

        for columna in range(2, 6):
            hoja.cell(row=x_final + 1, column=columna).border = thin_border

        total = hoja.cell(row=x_final + 2, column=2, value="VALOR TOTAL")
        total.font = Font(bold=True, size=12)
        hoja.merge_cells(start_row=x_final + 2, start_column=2, end_row=x_final + 2, end_column=4)
        hoja.cell(row=x_final + 2, column=2).alignment = Alignment(horizontal="center", vertical="center")
        for columna in range(2, 5):
            hoja.cell(row=x_final + 2, column=columna).border = thin_border

        valor = hoja.cell(
            row=x_final + 2,
            column=5,
            value=f"=IF(E{x_final}=0,0,SUM(E{x_inicial + 1}:E{x_final}))",
        )
        valor.font = Font(bold=True, size=12)
        valor.style = accounting_style
        valor.border = thin_border

        monto_final.append(f"E{x_final + 2}")
        fila += contador + 6

    for i in range(9, 24):
        celda = hoja.cell(row=i, column=3, value=f"={monto_final[i - 9]}")
        celda.style = accounting_style
        celda.border = thin_border

    return guardias


def excel_descarga(libro, nombre):
    buffer = io.BytesIO()
    libro.save(buffer)
    buffer.seek(0)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=nombre,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route("/")
def index():
    editar = request.args.get("editar", type=int)
    if editar is not None and (editar < 0 or editar >= len(data[0])):
        editar = None
    return render_template_string(
        PAGE,
        topicos=topicos,
        filas=filas_vista(),
        dia=dia,
        fecha_pro=fecha_pro,
        editar=editar,
    )


@app.post("/agregar")
def agregar():
    boleta, error = leer_boleta()
    if error or boleta[0] not in topicos:
        flash(error or "Debe completar todos los campos.")
        return redirect(url_for("index"))

    for columna, valor in zip(data, boleta):
        columna.append(valor)
    return redirect(url_for("index"))


@app.post("/modificar/<int:indice>")
def modificar(indice):
    if indice < 0 or indice >= len(data[0]):
        flash("Esa boleta ya no está en la tabla.")
        return redirect(url_for("index"))

    boleta, error = leer_boleta()
    if error:
        flash(error)
        return redirect(url_for("index"))

    for columna, valor in zip(data, boleta):
        columna[indice] = valor
    return redirect(url_for("index"))


@app.post("/eliminar/<int:indice>")
def eliminar(indice):
    if indice < 0 or indice >= len(data[0]):
        flash("Esa boleta ya no está en la tabla.")
        return redirect(url_for("index"))
    for columna in data:
        columna.pop(indice)
    return redirect(url_for("index"))


@app.get("/guardar")
def guardar():
    nombre = f"Datos_guardados_no_procesados_{dia}.xlsx"
    return excel_descarga(workbook_sin_procesar(), nombre)


@app.post("/recuperar")
def recuperar():
    archivo = request.files.get("archivo")
    if not archivo or not archivo.filename:
        flash("Seleccione un archivo de recuperación.")
        return redirect(url_for("index"))

    try:
        excel = openpyxl.load_workbook(archivo)
        hoja2 = excel.active
        for i in range(1, hoja2.max_row + 1):
            topi = hoja2.cell(row=i, column=1).value
            prove = hoja2.cell(row=i, column=2).value
            nbole = hoja2.cell(row=i, column=3).value
            febole = hoja2.cell(row=i, column=4).value
            mon = hoja2.cell(row=i, column=5).value
            if not topi or not prove or not nbole or not febole or not mon:
                break
            data[0].append(topi)
            data[1].append(prove)
            data[2].append(nbole)
            data[3].append(febole)
            data[4].append(int(mon))
        excel.close()
        flash("Datos recuperados con éxito.")
    except Exception as error:
        flash(f"No se pudo recuperar el archivo: {error}")
    return redirect(url_for("index"))


@app.post("/procesar")
def procesar():
    mes = request.form.get("mes", "").strip()
    if not mes:
        flash("Ingrese el mes para procesar los datos.")
        return redirect(url_for("index"))
    nombre = f"DETALLE GASTOS BERFRE {mes}_{dia}.xlsx"
    return excel_descarga(workbook_procesado(mes), nombre)


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=5000)
