import os
import os.path as path
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill, NamedStyle
import datetime
from sympy import true
from diccionariotemp import ubicaciones, precios

dicub = ubicaciones
dicpre = precios


# inicializa variable de tiempo
fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month) + str(fecha.day)
print("Codigo de dia: ", dia)

#Funcion para realizar filtros y mostrar solo el stock de M501
def filtro1():
    # inicializa manejo de archivos
    #test = input("Ingrese el nombre del archivo de recuperacion con su extencion ==> ")
    test = r"C:\Users\Anibal M\Desktop\practica 2\Practica-2\private\excel base\EXPORT.XLSX"
    excel = openpyxl.load_workbook(test)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20

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
            id = hoja2.cell(row = i, column = 1).value
            hoja.cell(row = x, column = 1, value = id)
            descripcion = hoja2.cell(row = i, column = 2).value
            hoja.cell(row = x, column = 2, value = descripcion)
            utilizacion = hoja2.cell(row = i, column = 4).value
            hoja.cell(row = x, column = 3, value = utilizacion)
            x += 1

    #hoja['A1'] = hoja2.cell(row = 1, column = 1).value
    #hoja['B3'] = 'EMPRESA: PRETORIANOS SEGURIDAD'
    print(f"i = {i} y x = {x}")
    mango.save(f"Prueba_de_planilla_M501.xlsx")
    return

#Planilla todas la bodegas
def total():
    # inicializa manejo de archivos
    test = r"C:\Users\Anibal M\Desktop\practica 2\Practica-2\private\excel base\EXPORT.XLSX"
    excel = openpyxl.load_workbook(test)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
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
        bodega = hoja2.cell(row = i, column = 1).value
        if bodega != hoja2.cell(row = i - 1, column = 1).value:
            id = hoja2.cell(row = i, column = 1).value
            hoja.cell(row = x, column = 1, value = id)
            descripcion = hoja2.cell(row = i, column = 2).value
            hoja.cell(row = x, column = 2, value = descripcion)
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
            i = i + 4
            x += 1
    print(f"i = {i} y x = {x}")
    mango.save(f"Prueba_de_planilla_stock_region.xlsx")
    return

#Inventario de la bodega M501 con ubicacion
def inventario(dicub):
    # inicializa manejo de archivos
    test = r"C:\Users\Anibal M\Desktop\practica 2\Practica-2\private\excel base\EXPORT.XLSX"
    excel = openpyxl.load_workbook(test)
    mango = openpyxl.Workbook()
    hoja2 = excel.active
    hoja = mango.active

    #Variable que maneja la fila en la que se esta escribiendo
    x = 4

    #Diseño de las celdas
    hoja.column_dimensions['A'].width = 20
    hoja.column_dimensions['B'].width = 52
    hoja.column_dimensions['C'].width = 20
    hoja.column_dimensions['D'].width = 15
    hoja.column_dimensions['E'].width = 15

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
    for i in range(1, hoja2.max_row + 1):
        bodega = hoja2.cell(row = i, column = 3).value
        if bodega == "M501":
            id = hoja2.cell(row = i, column = 1).value
            hoja.cell(row = x, column = 1, value = id)
            descripcion = hoja2.cell(row = i, column = 2).value
            hoja.cell(row = x, column = 2, value = descripcion)
            if dicub.get(hoja2.cell(row = i, column = 1).value) != None:
                ubicacion = dicub[hoja2.cell(row = i, column = 1).value]
                hoja.cell(row = x, column = 3, value = ubicacion)
            utilizacion = hoja2.cell(row = i, column = 4).value
            hoja.cell(row = x, column = 4, value = utilizacion)
            x += 1

    print(f"i = {i} y x = {x}")
    ordenador(mango, hoja)
    mango.save(f"Prueba_de_planilla_invetario.xlsx")
    return

def var_ord(mango, hoja, i):
    if hoja.cell(row = i, column = 3).value is None or hoja.cell(row = i, column = 3).value == "":
            cont = 00
    else:
        cont = int(hoja.cell(row = i, column = 3).value[-2:])
    if hoja.cell(row = i + 1, column = 3).value is None or hoja.cell(row = i + 1, column = 3).value == "":
        comp = 00
    else:
        comp = int(hoja.cell(row = i + 1, column = 3).value[-2:])
    return (cont, comp)

def ordenador(mango, hoja):
    m = 1
    #Ordena la planilla por ubicacion
    for i in range(4, hoja.max_row + 1):
        cont, comp = var_ord(mango, hoja, i)
        while cont < comp and i < hoja.max_row:
            if cont == 00:
                print(f"cont = {cont} y comp = {comp}")
                print(f"supreme victory {m}")
                op1 = hoja.cell(row = i, column = 1).value
                op2 = hoja.cell(row = i, column = 2).value
                op3 = hoja.cell(row = i, column = 3).value
                op4 = hoja.cell(row = i, column = 4).value
                op5 = hoja.cell(row = i + 1, column = 1).value
                op6 = hoja.cell(row = i + 1, column = 2).value
                op7 = hoja.cell(row = i + 1, column = 3).value
                op8 = hoja.cell(row = i + 1, column = 4).value

                hoja.cell(row = i, column = 1, value = op5)
                hoja.cell(row = i, column = 2, value = op6)
                hoja.cell(row = i, column = 3, value = op7)
                hoja.cell(row = i, column = 4, value = op8)

                hoja.cell(row = i + 1, column = 1, value = op1)
                hoja.cell(row = i + 1, column = 2, value = op2)
                hoja.cell(row = i + 1, column = 3, value = "")
                hoja.cell(row = i + 1, column = 4, value = op4)
            else:
                print(f"cont = {cont} y comp = {comp}")
                print(f"supreme victory {m}")
                op1 = hoja.cell(row = i, column = 1).value
                op2 = hoja.cell(row = i, column = 2).value
                op3 = hoja.cell(row = i, column = 3).value
                op4 = hoja.cell(row = i, column = 4).value
                op5 = hoja.cell(row = i + 1, column = 1).value
                op6 = hoja.cell(row = i + 1, column = 2).value
                op7 = hoja.cell(row = i + 1, column = 3).value
                op8 = hoja.cell(row = i + 1, column = 4).value

                hoja.cell(row = i, column = 1, value = op5)
                hoja.cell(row = i, column = 2, value = op6)
                hoja.cell(row = i, column = 3, value = op7)
                hoja.cell(row = i, column = 4, value = op8)

                hoja.cell(row = i + 1, column = 1, value = op1)
                hoja.cell(row = i + 1, column = 2, value = op2)
                hoja.cell(row = i + 1, column = 3, value = op3)
                hoja.cell(row = i + 1, column = 4, value = op4)
            if i > 4:
                i -= 1
            cont, comp = var_ord(mango, hoja, i)
            m += 1
    return

#Selector de filtro
z = int(input("Elije el numero de la opcion que quieres usar\n1.- Filtro para solo M501\n2.- Filtro stock total\n3.- Planilla de inventario\n>> "))
if z == 1:
    filtro1()
if z == 2:
    total()
if z == 3:
    inventario(dicub)