import os
import os.path as path
from pathlib import Path
import sys
from matplotlib.pylab import rint
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill, NamedStyle
import datetime
from sympy import true
#from diccionariotemp import ubicaciones, precios, material
import private.informacion_delicada.diccionario

# inicializa variable de tiempo
fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month) + str(fecha.day)
print("Codigo de dia: ", dia)

#
#PRUEBA DE FLASK
#
from flask import Flask, render_template

Berfre = Flask(__name__)

@Berfre.route('/')
def home():
    mi_variable = "¡Hola desde Python!"
    return render_template('front.html', dato = mi_variable, dia = dia) 

if __name__ == '__main__':
    Berfre.run(debug=True)
#
#
#

#Funcion para realizar filtros y mostrar solo el stock de M501
def filtro1(ruta):
    # inicializa manejo de archivos
    #test = input("Ingrese el nombre del archivo de recuperacion con su extencion ==> ")
    excel = openpyxl.load_workbook(ruta)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    bordes = Border(
            bottom=Side(border_style="medium", color="000000"),
            left=Side(border_style="thin"),
            right=Side(border_style="thin"),
            top=Side(border_style="thin")
            )
    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20
    hoja['A3'].border = bordes
    hoja['B3'].border = bordes
    hoja['C3'].border = bordes
    hoja['A1'].border = bordes
    hoja['B1'].border = bordes
    hoja['A3'].font = Font(bold=True)
    hoja['B3'].font = Font(bold=True)
    hoja['C3'].font = Font(bold=True)
    hoja['A1'].font = Font(bold=True, size=12)
    hoja['B1'].font = Font(bold=True, size=12)

    #Titulo del documento
    hoja['A1'] = "Almacen"
    hoja['B1'] = "M501"

    #Titlos de las columnas
    hoja['A3'] = "Etiqueta de fila"
    hoja['B3'] = "Descripcion del producto"
    hoja['C3'] = "Libre utilización"

    #Filtros para el archivo
    hoja.auto_filter.ref = "A3:C3"
    hoja.auto_filter.add_sort_condition("C4:C" + str(hoja.max_row))

    #Manejo de archivos
    for i in range(1, hoja2.max_row + 1):
        bodega = hoja2.cell(row = i, column = 3).value
        if bodega == "M501":
            if hoja2.cell(row = i, column = 2).value != "NULO":
                id = hoja2.cell(row = i, column = 1).value
                hoja.cell(row = x, column = 1, value = id).border = bordes
                descripcion = hoja2.cell(row = i, column = 2).value
                hoja.cell(row = x, column = 2, value = descripcion).border = bordes
                utilizacion = hoja2.cell(row = i, column = 4).value
                hoja.cell(row = x, column = 3, value = utilizacion).border = bordes
                x += 1

    #hoja['A1'] = hoja2.cell(row = 1, column = 1).value
    #hoja['B3'] = 'EMPRESA: PRETORIANOS SEGURIDAD'
    print(f"i = {i} y x = {x}")
    mango.save(f"Prueba_de_planilla_M501.xlsx")
    return

#Planilla todas la bodegas
def total(ruta):
    # inicializa manejo de archivos
    excel = openpyxl.load_workbook(ruta)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    bordes = Border(
            bottom=Side(border_style="medium", color="000000"),
            left=Side(border_style="thin"),
            right=Side(border_style="thin"),
            top=Side(border_style="thin")
            )
    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 15
    hoja.column_dimensions['D'].width = 15
    hoja.column_dimensions['E'].width = 15
    hoja.column_dimensions['F'].width = 15
    hoja.column_dimensions['G'].width = 15

    #Titulo del documento
    hoja['A1'] = "Stock por bodega"
    
    #Titlos de las columnas
    hoja['A3'] = "Material"
    hoja['B3'] = "Descripcion del producto"
    hoja['C3'] = "M501"
    hoja['D3'] = "M502"
    hoja['E3'] = "M503"
    hoja['F3'] = "M504"
    hoja['G3'] = "M505"
    hoja['H3'] = "Total"
    hoja['H3'].font = Font(bold=True)

    #Filtros para el archivo
    hoja.auto_filter.ref = "A3:H3"

    for i in range(2, hoja2.max_row + 1):
        if hoja2.cell(row = i, column = 2).value != "NULO":
            hoja.cell(row = x, column = 3).border = bordes
            hoja.cell(row = x, column = 4).border = bordes
            hoja.cell(row = x, column = 5).border = bordes
            hoja.cell(row = x, column = 6).border = bordes
            hoja.cell(row = x, column = 7).border = bordes
            bodega = hoja2.cell(row = i, column = 1).value

            if bodega != hoja2.cell(row = i - 1, column = 1).value:
                id = hoja2.cell(row = i, column = 1).value
                hoja.cell(row = x, column = 1, value = id).border = bordes
                descripcion = hoja2.cell(row = i, column = 2).value
                hoja.cell(row = x, column = 2, value = descripcion).border = bordes
                M501 = hoja2.cell(row = i, column = 4).value
                hoja.cell(row = x, column = 3, value = M501)

                if hoja2.cell(row = i + 1, column = 3).value == "M502":
                    M502 = hoja2.cell(row = i + 1, column = 4).value
                    hoja.cell(row = x, column = 4, value = M502)

                if hoja2.cell(row = i + 2, column = 3).value == "M503":
                    M503 = hoja2.cell(row = i + 2, column = 4).value
                    hoja.cell(row = x, column = 5, value = M503)

                if hoja2.cell(row = i + 3, column = 3).value == "M504":
                    M504 = hoja2.cell(row = i + 3, column = 4).value
                    hoja.cell(row = x, column = 6, value = M504)

                if hoja2.cell(row = i + 4, column = 3).value == "M505":
                    M505 = hoja2.cell(row = i + 4, column = 4).value
                    hoja.cell(row = x, column = 7, value = M505)

                hoja.cell(row = x, column = 8, value = M501 + M502 + M503 + M504 + M505).font = Font(bold=True)
                hoja.cell(row = x, column = 8).border = bordes
                i = i + 4
                x += 1
                
    print(f"i = {i} y x = {x}")
    mango.save(f"Prueba_de_planilla_stock_region.xlsx")
    return

#Inventario de la bodega M501 con ubicacion
def inventario(ruta, dicub):
    # inicializa manejo de archivos
    excel = openpyxl.load_workbook(ruta)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    bordes = Border(
        bottom=Side(border_style="medium", color="000000"),
        left=Side(border_style="thin"),
        right=Side(border_style="thin"),
        top=Side(border_style="thin")
        )
    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20
    hoja.column_dimensions['D'].width = 15
    hoja.column_dimensions['E'].width = 15
    hoja['A3'].border = bordes
    hoja['B3'].border = bordes
    hoja['C3'].border = bordes
    hoja['D3'].border = bordes
    hoja['E3'].border = bordes
    hoja['A1'].border = bordes
    hoja['B1'].border = bordes
    hoja['A3'].font = Font(bold=True)
    hoja['B3'].font = Font(bold=True)
    hoja['C3'].font = Font(bold=True)
    hoja['D3'].font = Font(bold=True)
    hoja['E3'].font = Font(bold=True)
    hoja['A1'].font = Font(bold=True, size=12)
    hoja['B1'].font = Font(bold=True, size=12)

    #Titulo del documento
    hoja['A1'] = "Almacen"
    hoja['B1'] = "M501"

    #Titlos de las columnas
    hoja['A3'] = "Etiqueta de fila"
    hoja['B3'] = "Descripcion del producto"
    hoja['C3'] = "Ubicacion"
    hoja['D3'] = "Libre utilización"
    hoja['E3'] = "Existencia"

    #Ordena la planilla por ubicacion
    hoja.auto_filter.ref = "A3:E3"
    hoja.auto_filter.add_sort_condition("C4:C" + str(hoja.max_row))

    #Manejo de archivos
    encabezados = ["Etiqueta de fila", "Descripcion del producto", "Ubicacion", "Libre utilización", "Existencia"]
    for col_idx, texto in enumerate(encabezados, start=1):
        cell = hoja.cell(row=3, column=col_idx, value=texto)
        cell.font = Font(bold=True)
        cell.border = bordes

    # 3. Lectura y Filtrado en memoria
    filas_filtradas = []

    # iter_rows es infinitamente más rápido que recorrer celda por celda
    for row in hoja2.iter_rows(values_only=True):
        if not row or len(row) < 4:
            continue
            
        id_prod = row[0]          # Columna 1
        descripcion = row[1]      # Columna 2
        bodega = row[2]           # Columna 3
        utilizacion = row[3]      # Columna 4

        if bodega == "M501" and descripcion != "NULO":
            # Buscar ubicación en el diccionario
            id_str = str(id_prod)
            ubicacion = ""
            if id_str in dicub and dicub[id_str]:
                ubicacion = dicub[id_str]

            filas_filtradas.append({
                'id': id_prod,
                'descripcion': descripcion,
                'ubicacion': ubicacion,
                'utilizacion': utilizacion,
                'existencia': None
            })

    # 4. ORDENAMIENTO EN MEMORIA (Clave de la velocidad)
    # Criterio: Extrae los 2 primeros caracteres si existen números, de lo contrario da prioridad 0 o valor por defecto
    # 4. ORDENAMIENTO EN MEMORIA
    def obtener_clave_ordenamiento(item):
        ub = str(item['ubicacion']).strip() if item['ubicacion'] else ""
        
        # Si NO tiene ubicación (vacía o None)
        if not ub:
            # Devuelve (1, 0): El '1' la manda al final
            return (1, 0)
        
        # Si SÍ tiene ubicación y empieza con al menos 2 dígitos
        if len(ub) >= 2 and ub[:2].isdigit():
            # Devuelve (0, número): El '0' la pone arriba, ordenada por su valor numérico
            return (0, int(ub[:2]))
        
        # Si tiene texto pero no empieza con números (caso borde)
        return (0, 999)

    # Ordenamos la lista en Python usando la tupla como prioridad
    filas_filtradas.sort(key=obtener_clave_ordenamiento)

    # 5. Escritura rápida en la hoja de destino
    x = 4
    for item in filas_filtradas:
        hoja.cell(row=x, column=1, value=item['id']).border = bordes
        hoja.cell(row=x, column=2, value=item['descripcion']).border = bordes
        hoja.cell(row=x, column=3, value=item['ubicacion']).border = bordes
        hoja.cell(row=x, column=4, value=item['utilizacion']).border = bordes
        hoja.cell(row=x, column=5, value=item['existencia']).border = bordes
        x += 1

    # Agregar Autofiltro visual
    hoja.auto_filter.ref = f"A3:E{x-1}"

    # Guardar archivo
    mango.save("Prueba_de_planilla_invetario.xlsx")
    print("¡Proceso completado con éxito!")
    return

#Selector de filtro


#while True:
#    entrada = input("Introduce la ruta del archivo: ")
#    ruta = Path(entrada)
#    
#    # Verificar si el archivo existe y es un archivo real (no una carpeta)
#    if ruta.is_file():
#        print("¡Archivo encontrado con éxito!")
#        break
#    else:
#        print("Error: El archivo no existe o la ruta es inválida. Inténtalo de nuevo.\n")
import tkinter as tk
from tkinter import filedialog

def pedir_archivo_visual():
    # 1. Crear una ventana raíz oculta para que no aparezca una ventana vacía de fondo
    root = tk.Tk()
    root.withdraw()
    
    # 2. Forzar a que la ventana de selección aparezca al frente de todo
    root.attributes('-topmost', True)
    
    # 3. Abrir el cuadro de diálogo para seleccionar el archivo
    ruta_archivo = filedialog.askopenfilename(
        title="Selecciona un archivo",
        filetypes=[("Todos los archivos", "*.*"), ("Archivos de Texto", "*.txt"), ("Documentos PDF", "*.pdf")]
    )
    
    # 4. Destruir la ventana raíz al terminar
    root.destroy()
    
    return ruta_archivo

# Ejecución del ejemplo
ruta_seleccionada = pedir_archivo_visual()

if ruta_seleccionada:
    print(f"\nRuta seleccionada visualmente: {ruta_seleccionada}")
else:
    print("\nEl usuario canceló la selección.")


# Aquí ya puedes trabajar de forma segura con tu archivo
#print(f"Procesando: {ruta.name}")

dicub = private.informacion_delicada.diccionario.ubicaciones
dicpre = private.informacion_delicada.diccionario.precios
dicmat = private.informacion_delicada.diccionario.creardicmar(ruta_seleccionada)

z = int(input("Elije el numero de la opcion que quieres usar\n1.- Filtro para solo M501\n2.- Filtro stock total\n3.- Planilla de inventario\n>> "))
if z == 1:
    filtro1(ruta_seleccionada)
if z == 2:
    total(ruta_seleccionada)
if z == 3:
    inventario(ruta_seleccionada,dicub)