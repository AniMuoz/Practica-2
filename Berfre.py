import os
import os.path as path
from pathlib import Path
import sys
import io
from matplotlib.pylab import rint
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill, NamedStyle
from pypdf import PdfReader
import tkinter as tk
from tkinter import filedialog
import datetime
from sympy import true
#from diccionariotemp import ubicaciones, precios, material
import private.informacion_delicada.diccionario

# inicializa variable de tiempo
fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month) + str(fecha.day)
print("Codigo de dia: ", dia)
dia = f"{str(fecha.day)} / {str(fecha.month)} / {str(fecha.year)}"
#
#PRUEBA DE FLASK
#

def maquillaje():
    bordes = Border(
            bottom=Side(border_style="medium", color="000000"),
            left=Side(border_style="thin"),
            right=Side(border_style="thin"),
            top=Side(border_style="thin")
            )
    color = PatternFill(
            start_color='a9e5e5', end_color='5CB800', fill_type='solid')
    vacio = PatternFill(
            start_color='f9e37c', end_color='5CB800', fill_type='solid')
    ding = PatternFill(
            start_color='73C883', end_color='5CB800', fill_type='solid')
    zero = PatternFill(
            start_color='D3D3D3', end_color='5CB800', fill_type='solid')
    return bordes, color, vacio, ding, zero

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
    bordes, color, vacio, ding, zero = maquillaje()

    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20

    col = ['A', 'B', 'C']
    for i in col:
        hoja[f'{i}3'].font = Font(bold=True)
        hoja[f'{i}3'].border = bordes
        hoja[f'{i}3'].fill = color
    hoja['A1'].font = Font(bold=True, size=12)
    hoja['A1'].fill = color
    hoja['A1'].border = bordes
    hoja['B1'].border = bordes
    hoja['B1'].font = Font(bold=True, size=12)
    hoja['B1'].fill = color

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
                if hoja.cell(row = x, column = 3).value == 0 or hoja.cell(row = x, column = 3).value == "0" :
                    hoja[f"C{x}"].fill = zero
                elif hoja.cell(row = x, column = 3).value == "          ":
                    hoja[f"C{x}"].fill = vacio
                else:
                    hoja[f"C{x}"].fill = ding
                x += 1

    #hoja['A1'] = hoja2.cell(row = 1, column = 1).value
    #hoja['B3'] = 'EMPRESA: PRETORIANOS SEGURIDAD'
    print(f"i = {i} y x = {x}")
    nombre_archivo = "Planilla M501.xlsx"
    mango.save(nombre_archivo)
    ruta_creacion = path.abspath(nombre_archivo)
    return nombre_archivo, ruta_creacion

# Versión preview de filtro1: retorna columnas y filas como listas (sin guardar archivo)
def filtro1_preview(ruta):
    excel = openpyxl.load_workbook(ruta)
    hoja2 = excel.active
    columnas = ["Etiqueta de fila", "Descripcion del producto", "Libre utilización"]
    filas = []
    for i in range(1, hoja2.max_row + 1):
        bodega = hoja2.cell(row=i, column=3).value
        if bodega == "M501":
            if hoja2.cell(row=i, column=2).value != "NULO":
                filas.append([
                    hoja2.cell(row=i, column=1).value,
                    hoja2.cell(row=i, column=2).value,
                    hoja2.cell(row=i, column=4).value,
                ])
    return columnas, filas

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
    bordes, color, vacio, ding, zero = maquillaje()

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

    #Diseño
    col = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    for i in col:
        hoja[f'{i}3'].font = Font(bold=True)
        hoja[f'{i}3'].border = bordes
        hoja[f'{i}3'].fill = color
    hoja['A1'].font = Font(bold=True)
    hoja['A1'].fill = color
    hoja['A1'].border = bordes

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
                # Después de escribir los valores de las bodegas en la fila x:
                for col_letra in ['C', 'D', 'E', 'F', 'G', 'H']:
                    val = hoja[f'{col_letra}{x}'].value
                    if val is None or val == "" or val == "          ":
                        hoja[f'{col_letra}{x}'].fill = vacio
                    elif val == "0" or val == 0:
                        hoja[f'{col_letra}{x}'].fill = zero
                    else:
                        hoja[f'{col_letra}{x}'].fill = ding
                x += 1

    print(f"i = {i} y x = {x}")
    nombre_archivo = "Planilla stock regional.xlsx"
    mango.save(nombre_archivo)
    ruta_creacion = path.abspath(nombre_archivo)
    return nombre_archivo, ruta_creacion

# Versión preview de total: retorna columnas y filas como listas (sin guardar archivo)
def total_preview(ruta):
    excel = openpyxl.load_workbook(ruta)
    hoja2 = excel.active
    columnas = ["Material", "Descripcion del producto", "M501", "M502", "M503", "M504", "M505", "Total"]
    filas = []
    for i in range(2, hoja2.max_row + 1):
        if hoja2.cell(row=i, column=2).value != "NULO":
            bodega = hoja2.cell(row=i, column=1).value
            if bodega != hoja2.cell(row=i - 1, column=1).value:
                M501 = hoja2.cell(row=i, column=4).value or 0
                M502 = hoja2.cell(row=i+1, column=4).value if hoja2.cell(row=i+1, column=3).value == "M502" else 0
                M503 = hoja2.cell(row=i+2, column=4).value if hoja2.cell(row=i+2, column=3).value == "M503" else 0
                M504 = hoja2.cell(row=i+3, column=4).value if hoja2.cell(row=i+3, column=3).value == "M504" else 0
                M505 = hoja2.cell(row=i+4, column=4).value if hoja2.cell(row=i+4, column=3).value == "M505" else 0
                filas.append([
                    hoja2.cell(row=i, column=1).value,
                    hoja2.cell(row=i, column=2).value,
                    M501, M502, M503, M504, M505,
                    M501 + M502 + M503 + M504 + M505,
                ])
    return columnas, filas

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
    bordes, color, vacio, ding, zero = maquillaje()

    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20
    hoja.column_dimensions['D'].width = 15
    hoja.column_dimensions['E'].width = 15
    hoja.column_dimensions['F'].width = 25
    col = ['A', 'B', 'C', 'D', 'E', 'F']
    for i in col:
        hoja[f'{i}3'].font = Font(bold=True)
        hoja[f'{i}3'].border = bordes
        hoja[f'{i}3'].fill = color
    hoja['A1'].font = Font(bold=True, size= 12)
    hoja['A1'].fill = color
    hoja['A1'].border = bordes
    hoja['B1'].border = bordes
    hoja['B1'].font = Font(bold=True, size=12)
    hoja['B1'].fill = color

    #Titulo del documento
    hoja['A1'] = "Almacen"
    hoja['B1'] = "M501"

    #Titlos de las columnas
    hoja['A3'] = "Etiqueta de fila"
    hoja['B3'] = "Descripcion del producto"
    hoja['C3'] = "Ubicacion"
    hoja['D3'] = "sub-ubicacion"
    hoja['E3'] = "Libre utilización"
    hoja['F3'] = "Existencia"

    #Ordena la planilla por ubicacion
    hoja.auto_filter.ref = "A3:F3"
    hoja.auto_filter.add_sort_condition("C4:C" + str(hoja.max_row))

    #Manejo de archivos
    encabezados = ["Etiqueta de fila", "Descripcion del producto", "Ubicacion", "sub-ubicacion", "Libre utilización", "Existencia"]
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

            sub_ubicacion = str(ubicacion).strip()[:4] if ubicacion else ""

            filas_filtradas.append({
                'id': id_prod,
                'descripcion': descripcion,
                'ubicacion': ubicacion,
                'sub_ubicacion': sub_ubicacion,
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
        if hoja.cell(row=x, column= 3).value == "":
            hoja[f'C{x}'].fill = vacio
        hoja.cell(row=x, column=4, value=item['sub_ubicacion']).border = bordes
        if hoja.cell(row=x, column= 4).value == "":
            hoja[f'D{x}'].fill = vacio
        hoja.cell(row=x, column=5, value=item['utilizacion']).border = bordes
        hoja.cell(row=x, column=6, value=item['existencia']).border = bordes
        x += 1

    # Agregar Autofiltro visual
    hoja.auto_filter.ref = f"A3:F{x-1}"

    # Guardar archivo
    nombre_archivo = "Planilla de invetario M501.xlsx"
    mango.save(nombre_archivo)
    ruta_creacion = path.abspath(nombre_archivo)
    print("¡Proceso completado con éxito!")
    return nombre_archivo, ruta_creacion

# Versión preview de inventario: retorna columnas y filas como listas (sin guardar archivo)
def inventario_preview(ruta, dicub):
    excel = openpyxl.load_workbook(ruta)
    hoja2 = excel.active
    columnas = ["Etiqueta de fila", "Descripcion del producto", "Ubicacion", "sub-ubicacion", "Libre utilización", "Existencia"]
    filas_filtradas = []

    for row in hoja2.iter_rows(values_only=True):
        if not row or len(row) < 4:
            continue
        id_prod, descripcion, bodega, utilizacion = row[0], row[1], row[2], row[3]
        if bodega == "M501" and descripcion != "NULO":
            id_str = str(id_prod)
            ubicacion = dicub.get(id_str, "") if id_str in dicub else ""
            sub_ubicacion = str(ubicacion).strip()[:4] if ubicacion else ""
            filas_filtradas.append({
                'id': id_prod,
                'descripcion': descripcion,
                'ubicacion': ubicacion,
                'sub_ubicacion': sub_ubicacion,
                'utilizacion': utilizacion,
                'existencia': None,
            })

    def obtener_clave_ordenamiento(item):
        ub = str(item['ubicacion']).strip() if item['ubicacion'] else ""
        if not ub:
            return (1, 0)
        if len(ub) >= 2 and ub[:2].isdigit():
            return (0, int(ub[:2]))
        return (0, 999)

    filas_filtradas.sort(key=obtener_clave_ordenamiento)
    filas = [[f['id'], f['descripcion'], f['ubicacion'], f['sub_ubicacion'], f['utilizacion'], f['existencia']]
             for f in filas_filtradas]
    return columnas, filas

#Funcion para editar diccionarios, añadiendo, eliminando y editando datos
def modificar_diccionarios(dic, name):
    imp = int(input("Elije el numero de la opcion que quieres usar\n1.- Agregar un valor al diccionario\n2.- Modificar un valor del diccionario\n3.- Eliminar un valor del diccionario\n4.- Importar diccionario\n5.- Exportar diccionario\n>> "))
    if imp == 1:
        clave = input("Ingrese la clave que quiere agregar ==> ")
        valor = input("Ingrese el valor que quiere agregar ==> ")
        dic[clave] = valor
    elif imp == 2:
        clave = input("Ingrese la clave que quiere modificar ==> ")
        if clave in dic:
            valor = input("Ingrese el nuevo valor ==> ")
            dic[clave] = valor
        else:
            print("La clave no existe en el diccionario.")
    elif imp == 3:
        clave = input("Ingrese la clave que quiere eliminar ==> ")
        if clave in dic:
            del dic[clave]
        else:
            print("La clave no existe en el diccionario.")
    elif imp == 4:
        archivo = pedir_archivo_visual()
        try:
            excel = openpyxl.load_workbook(archivo)
            hoja = excel.active
            for i in range(2, hoja.max_row + 1):
                clave = str(hoja.cell(row=i, column=1).value)
                valor = str(hoja.cell(row=i, column=2).value)
                if clave is not None and valor is not None:
                    dic[clave] = valor
        except Exception as e:
            print(f"Error al importar el diccionario: {e}")
    elif imp == 5:
        j = 2

        excel = openpyxl.Workbook()
        hoja = excel.active
        hoja['A1'] = "Codigo"
        hoja['B1'] = name
        for i in dic.keys():
            clave = i
            valor = dic[i]
            
            hoja.cell(row=j, column=1).value = clave
            hoja.cell(row=j, column=2).value = valor
            j += 1
        excel.save(f"diccionario_{name}_exportado.xlsx")
    return

#Añadir ventas al excel de ventas
def añadir_venta(dic_mat, dic_ub, dic_pre, dic_sto, dic_comp, ruta):
    bordes, color, vacio, ding, zero = maquillaje()
    last_pos = 0
    export = openpyxl.load_workbook(ruta)
    temp = export.active
    #diccionarios para el stock
    M501 = {}
    for p in  range(2, temp.max_row + 1):
        if temp.cell(row = p, column = 3).value == "M501":
            M501[str(temp.cell(row = p, column = 1).value)] = temp.cell(row = p, column = 4).value
    M502 = {}
    for p in  range(2, temp.max_row + 1):
        if temp.cell(row = p, column = 3).value == "M502":
            M502[str(temp.cell(row = p, column = 1).value)] = temp.cell(row = p, column = 4).value
    M503 = {}
    for p in  range(2, temp.max_row + 1):
        if temp.cell(row = p, column = 3).value == "M503":
            M503[str(temp.cell(row = p, column = 1).value)] = temp.cell(row = p, column = 4).value
    M504 = {}
    for p in  range(2, temp.max_row + 1):
        if temp.cell(row = p, column = 3).value == "M504":
            M504[str(temp.cell(row = p, column = 1).value)] = temp.cell(row = p, column = 4).value
    M505 = {}
    for p in  range(2, temp.max_row + 1):
        if temp.cell(row = p, column = 3).value == "M505":
            M505[str(temp.cell(row = p, column = 1).value)] = temp.cell(row = p, column = 4).value
    cont = 10
    print("Elija la orden de venta que quiera cargar ")
    ruta_orden = pedir_archivo_visual()
    excel = openpyxl.load_workbook(ruta_orden)
    op = int(input("¿Quiere cargar una pagina de ventas o prefiere crear una nueva?\n1.- Cargar archivo xlsx existente\n2.- Crear nuevo archivo de ventas\n>> "))
    if op < 1 or op > 2:
        print("Una pega...")
        return
    if op == 1:
        ruta_arch = pedir_archivo_visual()
        mango = openpyxl.load_workbook(ruta_arch)
        hoja = mango.active
    else:
        mango = openpyxl.Workbook()
        hoja = mango.active
        last_pos = 1
        encabezado_ventas(hoja, last_pos)
        for q in range(1, hoja.max_column + 1):
            hoja.cell(row = 1, column = q).border = bordes
            hoja.cell(row = 1, column = q).font = Font(bold = true)
    hoja2 = excel.active
    #Elegir comprador
    l = 1
    ite = []
    for clave in dic_comp:
        print(f"{l}.-{dic_comp[clave]}")
        ite.append(dic_comp[clave])
        l += 1
    print(f"{l}.- n/a")
    sell = int(input("¿Quien compra?\n>> "))
    while sell > (len(ite) + 1) or sell < (len(ite) - 1):
        sell = int(input("Elija una opcion valida\n¿Quien compra?\n>> "))
    #Tipo de movimiento
    mov_tip = int(input("¿Que tipo es?\n1.- Venta\n2.- Traspaso\n>> "))
    if mov_tip == 1:
        mov = "VENTA"
    if mov_tip == 2:
        mov = "TRASPASO"
    #Numero de venta
    if mov == "TRASPASO":
        codcomp = "n/a"
    else:
        codcomp = int(input("Introduzca numero de venta\n>> "))
    #Encontrar el final del archivo
    for i in range(1, hoja.max_row + 1):
        if hoja.cell(row = i, column = 1).value == "Pos":
            #print ("new")
            last_pos = i
    j = 0
    #Diseño del archivo
    hoja.column_dimensions['A'].width = 5
    hoja.column_dimensions['C'].width = 50
    hoja.column_dimensions['D'].width = 12
    hoja.column_dimensions['E'].width = 7
    hoja.column_dimensions['F'].width = 7
    hoja.column_dimensions['G'].width = 7
    hoja.column_dimensions['H'].width = 7
    hoja.column_dimensions['I'].width = 7
    hoja.column_dimensions['J'].width = 7
    hoja.column_dimensions['K'].width = 7
    hoja.column_dimensions['L'].width = 4
    hoja.column_dimensions['M'].width = 4
    hoja.column_dimensions['N'].width = 6
    hoja.column_dimensions['O'].width = 11
    hoja.column_dimensions['P'].width = 6
    hoja.column_dimensions['Q'].width = 6
    hoja.column_dimensions['R'].width = 7
    hoja.column_dimensions['S'].width = 9
    hoja.column_dimensions['T'].width = 12
    hoja.column_dimensions['U'].width = 9
    hoja.column_dimensions['V'].width = 6
    hoja.column_dimensions['W'].width = 7
    hoja.column_dimensions['X'].width = 8
    hoja.column_dimensions['Y'].width = 8
    hoja.column_dimensions['Z'].width = 13
    hoja.column_dimensions['AA'].width = 10
    hoja.column_dimensions['AB'].width = 9
    hoja.column_dimensions['AC'].width = 9
    hoja.column_dimensions['AD'].width = 9
    hoja.column_dimensions['AE'].width = 35
    hoja.column_dimensions['AF'].width = 5
    hoja.column_dimensions['AH'].width = 10
    hoja.column_dimensions['AI'].width = 18
    hoja.column_dimensions['AJ'].width = 18
    #Filtros para el archivo
    hoja.auto_filter.ref = "A1:AJ1"
    #Llenar archivo
    for r in range(3, hoja2.max_row + 1):
        j += r
        for q in range(1, hoja.max_column + 1):
            hoja.cell(row = last_pos + 1, column = q).border = bordes
            hoja.cell(row = last_pos + 1, column = q).font = Font(bold = true)
        #itereador
        cant = hoja2.cell(row = j, column = 4).value
        while cant is None or cant == 0:
            j += 1
            if j < hoja2.max_row:
                cant = hoja2.cell(row = j, column = 4).value
            else:
                break
        if j >= hoja2.max_row:
            break
        if hoja.cell(row = last_pos, column = 2).value == hoja2.cell(row = j, column = 1).value:
            j += 1
        #ID
        hoja.cell(row = last_pos + 1, column = 1, value = cont)
        #Codigo de material
        hoja.cell(row = last_pos + 1, column = 2, value = hoja2.cell(row = j, column = 1).value)
        #Descripcion del material
        if str(hoja2.cell(row = j, column = 1).value) in dic_mat:
            hoja.cell(row = last_pos + 1, column = 3, value = dic_mat[str(hoja2.cell(row = j, column = 1).value)])
        #Ubicacion del material
        if str(hoja2.cell(row = j, column = 1).value) in dic_ub:
            hoja.cell(row = last_pos + 1, column = 4, value = dic_ub[str(hoja2.cell(row = j, column = 1).value)])
        #stock M501
        if str(hoja2.cell(row = j, column = 1).value) in M501:
            hoja.cell(row = last_pos + 1, column = 5, value = (M501[str(hoja2.cell(row = j, column = 1).value)]))
        else:
            hoja.cell(row = last_pos + 1, column = 5, value = 0)
        #Stock M502
        if str(hoja2.cell(row = j, column = 1).value) in M502:
            hoja.cell(row = last_pos + 1, column = 6, value = (M502[str(hoja2.cell(row = j, column = 1).value)]))
        else:
            hoja.cell(row = last_pos + 1, column = 6, value = 0)
        #Stock M503
        if str(hoja2.cell(row = j, column = 1).value) in M503:
            hoja.cell(row = last_pos + 1, column = 7, value = (M503[str(hoja2.cell(row = j, column = 1).value)]))
        else:
            hoja.cell(row = last_pos + 1, column = 7, value = 0)
        #Stock M504
        if str(hoja2.cell(row = j, column = 1).value) in M504:
            hoja.cell(row = last_pos + 1, column = 8, value = (M504[str(hoja2.cell(row = j, column = 1).value)]))
        else:
            hoja.cell(row = last_pos + 1, column = 8, value = 0)
        #Stock M505
        if str(hoja2.cell(row = j, column = 1).value) in M505:
            hoja.cell(row = last_pos + 1, column = 9, value = (M505[str(hoja2.cell(row = j, column = 1).value)]))
        else:
            hoja.cell(row = last_pos + 1, column = 9, value = 0)
        #Cantidad
        hoja.cell(row = last_pos + 1, column = 10, value = cant)
        #Entregar
        if str(hoja2.cell(row = j, column = 1).value) in M501:
            if cant <= int(M501[str(hoja2.cell(row = j, column = 1).value)]):
                hoja.cell(row = last_pos + 1, column = 11, value = cant)
                infra = 1
            else:
                hoja.cell(row = last_pos + 1, column = 11, value = 0)
                infra = 0
        else:
            hoja.cell(row = last_pos + 1, column = 11, value = 0)
            infra = 0
        #Peso y tiras
        hoja.cell(row = last_pos + 1, column = 12, value = (hoja2.cell(row = j, column = 3).value))
        #Columna 13 se añaden datos manualmente, se rellena con 0 mientras tanto
        #hoja.cell(row = last_pos + 1, column = 12, value = 0)
        hoja.cell(row = last_pos + 1, column = 13, value = 0)
        #Diferencia
        hoja.cell(row = last_pos + 1, column = 14, value = (int(hoja.cell(row = last_pos + 1, column = 5).value) - int(cant)))
        #Verdadero o falso
        if hoja.cell(row = last_pos + 1, column = 11).value == hoja.cell(row = last_pos + 1, column = 10).value:
            hoja.cell(row = last_pos + 1, column = 15, value = "VERDADERO")
        else:
            hoja.cell(row = last_pos + 1, column = 15, value = "FALSO")
        #Kg por unidad y peso total
        #Columnas 16 y 17 se rellenan manualmente por ahora, se rellena con 0
        hoja.cell(row = last_pos + 1, column = 16, value = 0)
        hoja.cell(row = last_pos + 1, column = 17, value = 0)
        #Precio
        if str(hoja2.cell(row = j, column = 1).value) in dic_pre:
            precio = dic_pre[str(hoja2.cell(row = j, column = 1).value)]
            hoja.cell(row = last_pos + 1, column = 18, value = int(precio))
        else:
            precio = 0
        #Precio total
        hoja.cell(row = last_pos + 1, column = 19, value = (int(cant) * int(precio)))
        #Comprador
        if sell <= (len(ite) - 1):
            hoja.cell(row = last_pos + 1, column = 20, value = (ite[sell - 1]))
        else:
            hoja.cell(row = last_pos + 1, column = 20, value = "n/a")
        #Movimiento
        hoja.cell(row = last_pos + 1, column = 21, value = mov)
        #Almacen

        #N° de ventas
        hoja.cell(row = last_pos + 1, column = 23, value = codcomp)
        #Estado

        #Fecha
        hoja.cell(row = last_pos + 1, column = 27, value = f"{str(fecha.day)}/{str(fecha.month)}/{str(fecha.year)}")
        #Comparar codigos
        hoja[f'AI{last_pos + 1}'] = f"=AG{last_pos + 1} =B{last_pos + 1}"
        #comparar cantidad
        hoja[f'AJ{last_pos + 1}'] = f"=AH{last_pos + 1} =X{last_pos + 1}"
        #Contadores para iterar
        last_pos += 1
        cont += 10
    encabezado_ventas(hoja, last_pos + 1)
    for q in range(1, hoja.max_column + 1):
        hoja.cell(row = last_pos + 1, column = q).border = bordes
        hoja.cell(row = last_pos + 1, column = q).font = Font(bold = true)
    mango.save(f"prueba_venta.xlsx")
    return

def encabezado_ventas(hoja, last_pos):
    amarillo = ["Pos", "Codigo", "Descripcion", "Ubicación", "M501", "M502", "M503", "M504", "M505", "Solicitado", "Entregar", "Med", "Tiras", "Dif", "Comp", "kg x U", "Kg Total GD", "$ x U", "$ Total GD", "Comprador" ,"Movimiento", "Almacen", "N°Venta", "Cant:GD", "GD Esval",	"Estado", "Fecha", "Dif.Pend",	"GD Esval",	"Fecha", "Observacion"]
    gris = ["Pos",	"Codigo",	"SOLICITUD",	"COMPARA CODIGO",	"COMPARA CANT"]

    for i in range(0, len(amarillo)):
        hoja.cell(row = last_pos, column = i + 1, value = amarillo[i]).fill = PatternFill(
                                                        start_color='ffff00', end_color='5CB800', fill_type='solid')
    i += 2
    for j in range(0, len(gris)):
        hoja.cell(row = last_pos, column = i, value = gris[j])
        i += 1
    return

#Funcion para corroborar stock en orden de reserva
def cont_reserva_preview(ruta_reserva, dic_sto, dic_mat, dic_ub, ver=None):
    lector = PdfReader(ruta_reserva)

    # Si no se especifica orientación, autodetectar examinando el texto
    if not ver or ver not in (1, 2, 'horizontal', 'vertical'):
        texto_completo = ""
        for p in lector.pages:
            texto_completo += p.extract_text() + "\n"
        if "Reserva No." in texto_completo:
            ver = 1
        else:
            ver = 2
    elif ver in (1, 'horizontal'):
        ver = 1
    else:
        ver = 2

    orden = []
    num = []
    des = []
    ub = []
    res = []
    sto = []
    num_orden_item = []

    for num_pagina, pagina in enumerate(lector.pages, start=1):
        texto_pagina = pagina.extract_text()
        lineas = texto_pagina.splitlines()
        orden_pagina = None
        for num_linea, linea in enumerate(lineas, start=1):
            linea_limpia = linea.strip()
            if linea_limpia:
                # Rescata datos de ordenes horizontales
                if ver == 1:
                    if linea_limpia[:11] == "Reserva No.":
                        tom = linea_limpia.split(".")
                        tom2 = tom[1].split(" ")
                        orden_pagina = tom2[1]
                        orden.append(tom2[1])
                    if linea_limpia[:2] == "00":
                        tomar = linea_limpia.split(" ")
                        cod = tomar[1]
                        num.append(cod)
                        des.append(dic_mat.get(cod, "Sin descripción"))
                        sto_val = dic_sto.get(cod, 0)
                        sto.append(sto_val if sto_val is not None else 0)
                        if cod in dic_ub and dic_ub[cod] != "          ":
                            ub.append(dic_ub[cod])
                        else:
                            ub.append("No se encontro ubicación")
                        num_orden_item.append(orden_pagina)
                    cant = linea_limpia.split(",")
                    if len(cant) == 2:
                        if cant[1] == "000":
                            res.append(cant[0])
                # Rescata datos de ordenes verticales
                elif ver == 2:
                    if linea_limpia[:5] == "Orden":
                        tom = linea_limpia.split("          ")
                        if len(tom) > 1:
                            tom2 = tom[1].split(" ")
                            orden_pagina = tom2[0]
                            orden.append(tom2[0])
                    if linea_limpia[:8] == "Material":
                        take = linea_limpia.split("    ")
                        if len(take) > 1:
                            tomar = take[1].split(" ")
                            cod = tomar[0]
                            num.append(cod)
                            des.append(dic_mat.get(cod, "Sin descripción"))
                            sto_val = dic_sto.get(cod, 0)
                            sto.append(sto_val if sto_val is not None else 0)
                            if cod in dic_ub and dic_ub[cod] != "          ":
                                ub.append(dic_ub[cod])
                            else:
                                ub.append("No se encontro ubicación")
                            res.append(tomar[1])
                            num_orden_item.append(orden[0] if orden else "")

    columnas = ["N°", "N° Orden", "Código", "Descripción", "Reserva", "Stock", "Ubicación", "Estado"]
    filas = []
    for i in range(len(num)):
        ord_val = num_orden_item[i] if i < len(num_orden_item) and num_orden_item[i] else (orden[0] if orden else "")
        raw_res = res[i] if i < len(res) else 0
        raw_sto = sto[i] if i < len(sto) else 0
        try:
            val_res = int(raw_res)
        except (ValueError, TypeError):
            val_res = 0
        try:
            val_sto = int(raw_sto)
        except (ValueError, TypeError):
            val_sto = 0
        estado = "Disponible" if val_res <= val_sto else "No disponible"
        filas.append([i + 1, ord_val, num[i], des[i], val_res, val_sto, ub[i], estado])
    return columnas, filas

def cont_reserva(dic_sto, dic_mat, dic_ub, ruta_reserva=None):
    # Si no se pasó ruta, solicitarla interactivamente
    if not ruta_reserva:
        ruta_reserva = pedir_archivo_visual()
    if not ruta_reserva:
        return None, None

    columnas, filas = cont_reserva_preview(ruta_reserva, dic_sto, dic_mat, dic_ub)

    # Mostrar en consola para compatibilidad con CLI
    print("N° | N° Orden | Codigo | Descripcion | reserva | stock | ubicacion | Estado")
    for f in filas:
        print(f"{f[0]}.- | {f[1]} | {f[2]} | {f[3]} | {f[4]} | {f[5]} | {f[6]} | {f[7]}")

    # Generar archivo Excel descargable
    mango = openpyxl.Workbook()
    hoja = mango.active
    bordes, color, vacio, ding, zero = maquillaje()

    hoja.column_dimensions['A'].width = 8
    hoja.column_dimensions['B'].width = 18
    hoja.column_dimensions['C'].width = 15
    hoja.column_dimensions['D'].width = 52
    hoja.column_dimensions['E'].width = 12
    hoja.column_dimensions['F'].width = 12
    hoja.column_dimensions['G'].width = 25
    hoja.column_dimensions['H'].width = 16

    hoja['A1'] = "Revisión Stock de Reserva"
    hoja['A1'].font = Font(bold=True, size=12)
    hoja['A1'].fill = color
    hoja['B1'].fill = color
    hoja['A1'].border = bordes
    hoja['B1'].border = Border(
            bottom=Side(border_style="medium", color="000000"),
            right=Side(border_style="thin"),
            )

    for c_idx, col_name in enumerate(columnas, start=1):
        cell = hoja.cell(row=3, column=c_idx, value=col_name)
        cell.font = Font(bold=True)
        cell.fill = color
        cell.border = bordes

    x = 4
    for fila in filas:
        for c_idx, val in enumerate(fila, start=1):
            cell = hoja.cell(row=x, column=c_idx, value=val)
            cell.border = bordes
            if c_idx == 8: # Columna Estado
                if val == "Disponible":
                    cell.fill = ding
                else:
                    cell.fill = vacio
        x += 1

    hoja.auto_filter.ref = f"A3:H{x - 1}"

    nombre_archivo = "Revision_stock_reserva.xlsx"
    mango.save(nombre_archivo)
    ruta_creacion = path.abspath(nombre_archivo)
    return nombre_archivo, ruta_creacion

#Detecta que si un valor es numerico o no
def detector_numerico(linea):
    try:
        float(linea)
        return True
    except ValueError:
        return False

#Muestra una tabla mas detallada de stock en todas las bodegas
def stock_detallado(ruta, dic_ub, dic_pre):
    # inicializa manejo de archivos
    excel = openpyxl.load_workbook(ruta)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    bordes, color, vacio, ding, zero = maquillaje()

    hoja.column_dimensions['A'].width = 15
    hoja.column_dimensions['B'].width = 10
    hoja.column_dimensions['C'].width = 52
    hoja.column_dimensions['D'].width = 8
    hoja.column_dimensions['E'].width = 15
    hoja.column_dimensions['F'].width = 30
    hoja.column_dimensions['G'].width = 8
    hoja.column_dimensions['H'].width = 8
    hoja.column_dimensions['I'].width = 8
    hoja.column_dimensions['J'].width = 8
    hoja.column_dimensions['K'].width = 10
    hoja.column_dimensions['L'].width = 18
    hoja.column_dimensions['M'].width = 15
    hoja.column_dimensions['N'].width = 15
    hoja.column_dimensions['O'].width = 15
    hoja.column_dimensions['P'].width = 18

    #Titulo del documento
    hoja['A1'] = "Stock detallado"
    
    #Titlos de las columnas
    hoja['A3'] = "Ubicación"
    hoja['B3'] = "Codigo"
    hoja['C3'] = "Descripción"
    hoja['D3'] = "M501"
    hoja['E3'] = "Precio x Unidad"
    hoja['F3'] = "Clasificación"
    hoja['G3'] = "M502"
    hoja['H3'] = "M503"
    hoja['I3'] = "M504"
    hoja['J3'] = "M505"
    hoja['K3'] = "Total"
    hoja['L3'] = "Cons.Prom.Mensual"
    hoja['M3'] = "STOCK CRITICO"
    hoja['N3'] = "Stock Max"
    hoja['O3'] = "INDICADOR"
    hoja['P3'] = "Cambio de ubicación"

    #Diseño
    col = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']
    for i in col:
        hoja[f'{i}3'].font = Font(bold=True)
        hoja[f'{i}3'].border = bordes
        hoja[f'{i}3'].fill = color
    hoja['A1'].font = Font(bold=True)
    hoja['A1'].fill = color
    hoja['A1'].border = bordes

    #Filtros para el archivo
    hoja.auto_filter.ref = "A3:P3"

    for i in range(2, hoja2.max_row + 1):
        if hoja2.cell(row = i, column = 2).value != "NULO":
            hoja.cell(row = x, column = 1).border = bordes
            hoja.cell(row = x, column = 2).border = bordes
            hoja.cell(row = x, column = 3).border = bordes
            hoja.cell(row = x, column = 4).border = bordes
            hoja.cell(row = x, column = 5).border = bordes
            hoja.cell(row = x, column = 6).border = bordes
            hoja.cell(row = x, column = 7).border = bordes
            hoja.cell(row = x, column = 8).border = bordes
            hoja.cell(row = x, column = 9).border = bordes
            hoja.cell(row = x, column = 10).border = bordes
            hoja.cell(row = x, column = 11).border = bordes
            hoja.cell(row = x, column = 12).border = bordes
            hoja.cell(row = x, column = 13).border = bordes
            hoja.cell(row = x, column = 14).border = bordes
            hoja.cell(row = x, column = 15).border = bordes
            hoja.cell(row = x, column = 16).border = bordes
            bodega = hoja2.cell(row = i, column = 1).value

            if bodega != hoja2.cell(row = i - 1, column = 1).value:
                id = hoja2.cell(row = i, column = 1).value
                hoja.cell(row = x, column = 2, value = id)
                if str(id) in dic_ub:
                    hoja.cell(row = x, column = 1, value = dic_ub[str(id)])
                descripcion = hoja2.cell(row = i, column = 2).value
                hoja.cell(row = x, column = 3, value = descripcion)
                M501 = hoja2.cell(row = i, column = 4).value
                hoja.cell(row = x, column = 4, value = M501)
                if str(id) in dic_pre:
                    hoja.cell(row = x, column = 5, value = f"${dic_pre[str(id)]}")
                else:
                    hoja.cell(row = x, column = 5, value = "Sin precio")

                if hoja2.cell(row = i + 1, column = 3).value == "M502":
                    M502 = hoja2.cell(row = i + 1, column = 4).value
                    hoja.cell(row = x, column = 7, value = M502)

                if hoja2.cell(row = i + 2, column = 3).value == "M503":
                    M503 = hoja2.cell(row = i + 2, column = 4).value
                    hoja.cell(row = x, column = 8, value = M503)

                if hoja2.cell(row = i + 3, column = 3).value == "M504":
                    M504 = hoja2.cell(row = i + 3, column = 4).value
                    hoja.cell(row = x, column = 9, value = M504)

                if hoja2.cell(row = i + 4, column = 3).value == "M505":
                    M505 = hoja2.cell(row = i + 4, column = 4).value
                    hoja.cell(row = x, column = 10, value = M505)

                hoja.cell(row = x, column = 11, value = M501 + M502 + M503 + M504 + M505).font = Font(bold=True)
                i = i + 4
                # Después de escribir los valores de las bodegas en la fila x:
                for col_letra2 in ['D', 'E', 'G', 'H', 'I', 'J', 'K']:
                    val2 = hoja[f'{col_letra2}{x}'].value
                    if val2 != None and val2 != "" and val2 != 0 and val2 != "0":
                        hoja[f'{col_letra2}{x}'].fill = ding

                for col_letra in ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']:
                    val = hoja[f'{col_letra}{x}'].value
                    if val is None or val == "" or val == "          " or val == "Sin precio":
                        hoja[f'{col_letra}{x}'].fill = vacio

                for col_letra3 in ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']:
                    val3 = hoja[f'{col_letra3}{x}'].value
                    if val3 == 0:
                        hoja[f'{col_letra3}{x}'].fill = zero
                x += 1

    print(f"i = {i} y x = {x}")
    nombre_archivo = "Prueba_de_stock_detallado.xlsx"
    mango.save(nombre_archivo)
    ruta_creacion = path.abspath(nombre_archivo)
    return nombre_archivo, ruta_creacion

# Versión preview de total: retorna columnas y filas como listas (sin guardar archivo)
def stock_detallado_preview(ruta, dic_ub, dic_pre):
    excel = openpyxl.load_workbook(ruta)
    hoja2 = excel.active

    columnas = ["Ubicación","Codigo","Descripción","M501","Precio x Unidad","M502","M503","M504","M505","Total"]
    filas = []
    for i in range(2, hoja2.max_row + 1):
        if hoja2.cell(row=i, column=2).value != "NULO":
            id = hoja2.cell(row = i, column = 1).value
            if str(id) in dic_ub and dic_ub[str(id)] != "          ":
                ubicacion = dic_ub[str(id)]
            else:
                ubicacion = "Sin ubicación"
            if str(id) in dic_pre:
                precio = f"${dic_pre[str(id)]}"
            else:
                precio = "Sin precio"
            bodega = hoja2.cell(row=i, column=1).value
            if bodega != hoja2.cell(row=i - 1, column=1).value:
                M501 = hoja2.cell(row=i, column=4).value or 0
                M502 = hoja2.cell(row=i+1, column=4).value if hoja2.cell(row=i+1, column=3).value == "M502" else 0
                M503 = hoja2.cell(row=i+2, column=4).value if hoja2.cell(row=i+2, column=3).value == "M503" else 0
                M504 = hoja2.cell(row=i+3, column=4).value if hoja2.cell(row=i+3, column=3).value == "M504" else 0
                M505 = hoja2.cell(row=i+4, column=4).value if hoja2.cell(row=i+4, column=3).value == "M505" else 0
                filas.append([
                    ubicacion,
                    hoja2.cell(row=i, column=1).value,
                    hoja2.cell(row=i, column=2).value,
                    M501,  precio,
                    M502, M503, M504, M505,
                    M501 + M502 + M503 + M504 + M505,
                ])
    return columnas, filas

# ─── HELPERS PARA FLASK (sin input()) ────────────────────────────────────────

def dic_agregar(dic: dict, clave: str, valor: str) -> dict:
    """Agrega o sobreescribe una clave en el diccionario."""
    dic[clave] = valor
    return dic

def dic_modificar(dic: dict, clave: str, valor: str):
    """Modifica el valor de una clave existente. Retorna el dict o None si la clave no existe."""
    if clave not in dic:
        return None
    dic[clave] = valor
    return dic

def dic_eliminar(dic: dict, clave: str):
    """Elimina una clave. Retorna el dict o None si la clave no existe."""
    if clave not in dic:
        return None
    del dic[clave]
    return dic

def dic_exportar_bytes(dic: dict, name: str) -> io.BytesIO:
    """Exporta el diccionario a un archivo Excel en memoria (BytesIO)."""
    excel = openpyxl.Workbook()
    hoja = excel.active
    hoja['A1'] = "Codigo"
    hoja['B1'] = name
    for j, (clave, valor) in enumerate(dic.items(), start=2):
        hoja.cell(row=j, column=1, value=clave)
        hoja.cell(row=j, column=2, value=valor)
    buffer = io.BytesIO()
    excel.save(buffer)
    buffer.seek(0)
    return buffer

def dic_importar_excel(file_bytes: bytes) -> dict:
    """Lee un xlsx (bytes) y retorna un dict {clave: valor} desde la fila 2 en adelante."""
    buffer = io.BytesIO(file_bytes)
    excel = openpyxl.load_workbook(buffer)
    hoja = excel.active
    resultado = {}
    for i in range(2, hoja.max_row + 1):
        clave = hoja.cell(row=i, column=1).value
        valor = hoja.cell(row=i, column=2).value
        if clave is not None:
            resultado[str(clave)] = str(valor) if valor is not None else ""
    return resultado

#Seleccion de archivo visualmente
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

#Selecciona que filtro se quiere usar y ejecuta la funcion correspondiente
def main():
        
    # Ejecución del ejemplo
    ruta_seleccionada = pedir_archivo_visual()

    if ruta_seleccionada:
        print(f"\nRuta seleccionada visualmente: {ruta_seleccionada}")
    else:
        print("\nEl usuario canceló la selección.")
        return

    #Se inicializan los diccionarios
    dicub = private.informacion_delicada.diccionario.ubicaciones
    dicpre = private.informacion_delicada.diccionario.precios
    dicmat = private.informacion_delicada.diccionario.creardicmar(ruta_seleccionada)
    dicsto = private.informacion_delicada.diccionario.creardictotal(ruta_seleccionada)
    dicalm = private.informacion_delicada.diccionario.almacenes
    diccrit = private.informacion_delicada.diccionario.critico
    diccom = private.informacion_delicada.diccionario.comprador

    #print("RECUERDA QUE ESTAS TRABAJANDO EN LA LINEA 741")

    z = int(input("Elije el numero de la opcion que quieres usar\n1.- Filtro para solo M501\n2.- Filtro stock total\n3.- Planilla de inventario\n4.- Modificar diccionarios\n5.- Añadir una venta\n6.- Verificar stock de una reserva\n7.- Planilla de stock detallada\n>> "))

    # Confirmación antes de generar el archivo
    confirmar = input(f"¿Seguro que quieres generar el archivo para la opción {z}? (s/n): ").strip().lower()
    if confirmar != 's':
        print("Operación cancelada.")
        return

    if z == 1:
        nombre, ruta_out = filtro1(ruta_seleccionada)
        print(f"Archivo generado: {nombre}\nUbicación: {ruta_out}")
    if z == 2:
        nombre, ruta_out = total(ruta_seleccionada)
        print(f"Archivo generado: {nombre}\nUbicación: {ruta_out}")
    if z == 3:
        nombre, ruta_out = inventario(ruta_seleccionada, dicub)
        print(f"Archivo generado: {nombre}\nUbicación: {ruta_out}")
    if z == 4:
        zan = int(input("Elije el numero de la opcion que quieres usar\n1.- Modificar diccionario de ubicaciones\n2.- Modificar diccionario de precios\n>> "))
        if zan == 1:
            modificar_diccionarios(dicub, "ubicaciones")
        if zan == 2:
            modificar_diccionarios(dicpre, "precios")
    if z == 5:
        añadir_venta(dicmat, dicub, dicpre, dicsto, diccom, ruta_seleccionada)
    if z == 6:
        cont_reserva(dicsto, dicmat, dicub)
    if z == 7:
        stock_detallado(ruta_seleccionada, dicub, dicpre)

if __name__ == '__main__':
    print("Esto solo se ejecutará si corres Berfre.py directamente")
    main()