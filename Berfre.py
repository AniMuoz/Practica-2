import os
import openpyxl
import datetime
import os.path as path

# inicializa variable de tiempo
fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month) + str(fecha.day)
print("Codigo de dia: ", dia)
# inicializa manejo de archivos
#test = input("Ingrese el nombre del archivo de recuperacion con su extencion ==> ")
test = r"C:\Users\Anibal M\Desktop\practica 2\Practica-2\private\excel base\EXPORT.XLSX"
excel = openpyxl.load_workbook(test)
mango = openpyxl.Workbook()
hoja2 = excel.active
hoja = mango.active

x = 2

hoja['A1'] = hoja2.cell(row = 1, column = 1).value
hoja['B1'] = hoja2.cell(row = 1, column = 2).value
hoja['C1'] = hoja2.cell(row = 1, column = 3).value
hoja['D1'] = hoja2.cell(row = 1, column = 4).value
hoja['E1'] = hoja2.cell(row = 1, column = 5).value
hoja['F1'] = hoja2.cell(row = 1, column = 6).value
hoja['G1'] = hoja2.cell(row = 1, column = 7).value

for i in range(1, hoja2.max_row + 1):
    #print(i)
    bodega = hoja2.cell(row = i, column = 3).value
    if bodega == "M501":
        for j in range(1, hoja2.max_column + 1):
            #print(j)
            producto = hoja2.cell(row = i, column = j).value
            hoja.cell(row = x, column = j, value = producto)
        x += 1

#hoja['A1'] = hoja2.cell(row = 1, column = 1).value
#hoja['B3'] = 'EMPRESA: PRETORIANOS SEGURIDAD'
print(f"i = {i}, j = {j} y x = {x}")
mango.save(f"Prueba_de_planilla.xlsx")