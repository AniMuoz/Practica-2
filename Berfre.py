import os
import openpyxl
import datetime
import os.path as path

# inicializa variable de tiempo
fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month) + str(fecha.day)
print("Codigo de dia: ", dia)
# inicializa manejo de archivos
test = input("Ingrese el nombre del archivo de recuperacion con su extencion ==> ")
excel = openpyxl.load_workbook(test)
hoja = excel.active

excel.save(f"Prueba_de_planilla{dia}.xlsx")