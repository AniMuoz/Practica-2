import os
import openpyxl
import datetime
import os.path as path
from openpyxl.styles import Font
from openpyxl.styles import Alignment
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from tkinter import Tk, ttk, filedialog, simpledialog
from PIL import Image, ImageTk  # Para manejar imágenes en la interfaz
from openpyxl.styles import Border, PatternFill, Side

# Datos iniciales
data = [[], [], [], [], []]
monto_final = []

directorio_raiz = os.path.dirname(os.path.abspath(__file__))
ruta_imagen = os.path.join(directorio_raiz, 'images', 'LOGOFOOTER.PNG')

fecha = datetime.date.today()
dia = str(fecha.year) + str(fecha.month).zfill(2) + str(fecha.day).zfill(2)

topicos = ['CONSUMOS BASICOS', 'TELEFONO E INTERNET', 'GASTOS COMUNES', 'ARRIENDO DE OFICINA', 'COMBUSTIBLE', 'ESCRITORIO Y OFICINA', 
    'ESTACIONAMIENTO', 'ARTICULOS DE ASEO', 'GASTOS DE REPRESENTACIÓN', 'VESTUARIO Y CALZADO', 'PASAJES, PEAJES Y CORREOS',
    'MANTENIMIENTO, REPARACIÓN Y SEGURIDAD', 'EQUIPAMIENTO', 'ALIMENTACIÓN', 'OTROS']

# Funciones principales
def guardar_data(data, dia):
    guardar = openpyxl.Workbook()
    hoja1 = guardar.active
    for i in range(len(data[1])):
        hoja1.cell(row=i + 1, column=1, value=data[0][i])
        hoja1.cell(row=i + 1, column=2, value=data[1][i])
        hoja1.cell(row=i + 1, column=3, value=data[2][i])
        hoja1.cell(row=i + 1, column=4, value=data[3][i])
        hoja1.cell(row=i + 1, column=5, value=data[4][i])
    filename = f"Datos_guardados_no_procesados_{dia}.xlsx"
    guardar.save(filename)
    messagebox.showinfo("Guardar datos", f"Datos guardados en {filename}")

def recuperar_data(data):
    filename = filedialog.askopenfilename(title="Seleccione el archivo de recuperación", filetypes=[("Archivos Excel", "*.xlsx")])
    if not filename:
        return

    try:
        excel = openpyxl.load_workbook(filename)
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
        messagebox.showinfo("Recuperar datos", "Datos recuperados con éxito")
        actualizar_tabla()
    except Exception as e:
        messagebox.showerror("Error", f"No se pudo recuperar el archivo: {e}")

FORMATO_PESOS = '_-[$$-340A]* #,##0_-;-[$$-340A]* #,##0_-;_-[$$-340A]* "-"??_-;_-@_-'
FUENTE = "Calibri"
RELLENO_TITULO = PatternFill(start_color="D9D9D9", end_color="D9D9D9", fill_type="solid")
BORDE_FINO = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)


def borde_fila(hoja, fila, columnas):
    for columna in columnas:
        hoja.cell(row=fila, column=columna).border = BORDE_FINO


def combinar_etiqueta(hoja, fila, texto, negrita, centrado, relleno=False):
    hoja.merge_cells(start_row=fila, start_column=2, end_row=fila, end_column=4)
    celda = hoja.cell(row=fila, column=2, value=texto)
    celda.font = Font(name=FUENTE, bold=negrita, size=12)
    celda.alignment = Alignment(horizontal="center" if centrado else "left")
    if relleno:
        celda.fill = RELLENO_TITULO
    borde_fila(hoja, fila, range(2, 5))


def celda_monto(hoja, fila, valor, negrita=False, relleno=False):
    celda = hoja.cell(row=fila, column=5, value=valor)
    celda.font = Font(name=FUENTE, bold=negrita, size=12)
    celda.number_format = FORMATO_PESOS
    celda.alignment = Alignment(horizontal="right")
    celda.border = BORDE_FINO
    if relleno:
        celda.fill = RELLENO_TITULO
    return celda


def armar_detalle(data, topicos, mes):
    guardias = openpyxl.Workbook()
    hoja = guardias.active
    mes_txt = mes.upper()
    hoja.title = f"GASTOS {mes_txt} {fecha.year}"[:31]

    hoja.column_dimensions["B"].width = 59.43
    hoja.column_dimensions["C"].width = 13
    hoja.column_dimensions["D"].width = 11.29
    hoja.column_dimensions["E"].width = 19.14

    hoja["B3"] = "EMPRESA: PRETORIANOS SEGURIDAD"
    hoja["B3"].font = Font(name=FUENTE, size=11)
    hoja["B4"] = "DIRECCIÓN: MANUEL BULNES Nº 920, OFICINA 208, QUILPUÉ"
    hoja["B4"].font = Font(name=FUENTE, size=11)
    hoja["B6"] = f"DETALLE GENERAL DE GASTOS MES {mes_txt} DEL AÑO {fecha.year}"
    hoja["B6"].font = Font(name=FUENTE, bold=True, size=12)

    combinar_etiqueta(hoja, 8, "CLASIFICACION DEL GASTO", True, True, True)
    monto_titulo = hoja.cell(row=8, column=5, value="MONTO")
    monto_titulo.font = Font(name=FUENTE, bold=True, size=12)
    monto_titulo.alignment = Alignment(horizontal="center")
    monto_titulo.fill = RELLENO_TITULO
    monto_titulo.border = BORDE_FINO

    for indice, topico in enumerate(topicos):
        combinar_etiqueta(hoja, 9 + indice, topico, False, False)

    fila_total = 9 + len(topicos)
    combinar_etiqueta(hoja, fila_total, "TOTAL GASTOS DEL MES", True, True, True)
    celda_monto(hoja, fila_total, f"=SUM(E9:E{fila_total - 1})", negrita=True, relleno=True)

    firma = fila_total + 3
    hoja.cell(row=firma, column=4, value="FREDDY ANDRES MUÑOZ OLIVARES").font = Font(name=FUENTE, bold=True, size=12)
    hoja.cell(row=firma, column=4).alignment = Alignment(horizontal="center")
    hoja.cell(row=firma + 1, column=4, value="GERENTE GENERAL").font = Font(name=FUENTE, bold=True, size=12)
    hoja.cell(row=firma + 1, column=4).alignment = Alignment(horizontal="center")

    totales = {}
    fila = firma + 4
    for topico in topicos:
        filas = [j for j in range(len(data[1])) if data[0][j] == topico]
        if not filas:
            continue

        titulo = hoja.cell(
            row=fila,
            column=2,
            value=f"DETALLE GASTOS EN {topico} MES {mes_txt} DEL AÑO {fecha.year}",
        )
        titulo.font = Font(name=FUENTE, bold=True, size=12)

        encabezado = fila + 2
        for columna, texto in enumerate(("PROVEEDOR", "N° BOLETA", "FECHA", "MONTO"), start=2):
            celda = hoja.cell(row=encabezado, column=columna, value=texto)
            celda.font = Font(name=FUENTE, bold=True, size=12)
            celda.alignment = Alignment(horizontal="center")
            celda.fill = RELLENO_TITULO
            celda.border = BORDE_FINO

        primera = encabezado + 1
        for desplazamiento, j in enumerate(filas):
            actual = primera + desplazamiento
            proveedor = hoja.cell(row=actual, column=2, value=data[1][j])
            proveedor.font = Font(name=FUENTE, size=12)
            proveedor.border = BORDE_FINO
            boleta = hoja.cell(row=actual, column=3, value=data[2][j])
            boleta.font = Font(name=FUENTE, size=12)
            boleta.alignment = Alignment(horizontal="right")
            boleta.border = BORDE_FINO
            fecha_boleta = hoja.cell(row=actual, column=4, value=data[3][j])
            fecha_boleta.font = Font(name=FUENTE, size=12)
            fecha_boleta.alignment = Alignment(horizontal="center")
            fecha_boleta.border = BORDE_FINO
            celda_monto(hoja, actual, data[4][j])

        ultima = primera + len(filas) - 1
        total_fila = ultima + 1
        combinar_etiqueta(hoja, total_fila, "VALOR TOTAL", True, True, True)
        celda_monto(hoja, total_fila, f"=SUM(E{primera}:E{ultima})", negrita=True, relleno=True)
        totales[topico] = f"E{total_fila}"
        fila = total_fila + 3

    for indice, topico in enumerate(topicos):
        referencia = totales.get(topico, 0)
        celda_monto(hoja, 9 + indice, f"={referencia}" if referencia else 0, negrita=True)

    return guardias


def procesar_datos(data, dia, topicos):
    mes = simpledialog.askstring("Procesar datos", "Ingrese el mes para procesar los datos:")
    if not mes:
        return

    guardias = armar_detalle(data, topicos, mes)
    filename = f"Detalle_gastos_pretorianos_{mes}_{dia}.xlsx"
    guardias.save(filename)
    messagebox.showinfo("Procesar datos", f"Datos procesados y guardados en {filename}")

def agregar_datos():
    topico = combo_topicos.get()
    proveedor = entry_proveedor.get()
    nboleta = entry_nboleta.get()
    fecha_boleta = entry_fecha_boleta.get()
    monto = entry_monto.get()

    if not (topico and proveedor and nboleta and fecha_boleta and monto):
        messagebox.showwarning("Advertencia", "Debe completar todos los campos")
        return

    try:
        monto = int(monto)
    except ValueError:
        messagebox.showerror("Error", "El monto debe ser un número entero")
        return

    data[0].append(topico)
    data[1].append(proveedor)
    data[2].append(nboleta)
    data[3].append(fecha_boleta)
    data[4].append(monto)

    actualizar_tabla()
    limpiar_campos()

def actualizar_tabla():
    for row in tree.get_children():
        tree.delete(row)

    for i in range(len(data[0])):
        tree.insert("", "end", values=(data[0][i], data[1][i], data[2][i], data[3][i], data[4][i]))

def limpiar_campos():
    combo_topicos.set("")
    entry_proveedor.delete(0, tk.END)
    entry_nboleta.delete(0, tk.END)
    entry_fecha_boleta.delete(0, tk.END)
    entry_monto.delete(0, tk.END)

# Configuración de la interfaz gráfica
root = tk.Tk()
root.title("Gestión de Gastos")

frame_logo = ttk.Frame(root)
frame_logo.pack(pady=10)
frame_logo.place(relx=1.0, rely=0.0, anchor="ne", x=-10, y=10)

try:
    img_logo = Image.open(ruta_imagen)  # Reemplaza 'logo.png' con la ruta de tu archivo de logo
    img_logo = img_logo.resize((100, 120))
    img_logo_tk = ImageTk.PhotoImage(img_logo)
    lbl_logo = ttk.Label(frame_logo, image=img_logo_tk)
    lbl_logo.image = img_logo_tk
    lbl_logo.pack()
except Exception as e:
    messagebox.showerror("Error", f"No se pudo cargar el logo: {e}")

frame_form = ttk.Frame(root)
frame_form.pack(pady=10)

lbl_topicos = ttk.Label(frame_form, text="Tópico:")
lbl_topicos.grid(row=0, column=0, padx=5, pady=5)
combo_topicos = ttk.Combobox(frame_form, values=topicos)
combo_topicos.grid(row=0, column=1, padx=5, pady=5)

lbl_proveedor = ttk.Label(frame_form, text="Proveedor:")
lbl_proveedor.grid(row=1, column=0, padx=5, pady=5)
entry_proveedor = ttk.Entry(frame_form)
entry_proveedor.grid(row=1, column=1, padx=5, pady=5)

lbl_nboleta = ttk.Label(frame_form, text="N° Boleta:")
lbl_nboleta.grid(row=2, column=0, padx=5, pady=5)
entry_nboleta = ttk.Entry(frame_form)
entry_nboleta.grid(row=2, column=1, padx=5, pady=5)

lbl_fecha_boleta = ttk.Label(frame_form, text="Fecha Boleta:")
lbl_fecha_boleta.grid(row=3, column=0, padx=5, pady=5)
entry_fecha_boleta = ttk.Entry(frame_form)
entry_fecha_boleta.grid(row=3, column=1, padx=5, pady=5)

lbl_monto = ttk.Label(frame_form, text="Monto:")
lbl_monto.grid(row=4, column=0, padx=5, pady=5)
entry_monto = ttk.Entry(frame_form)
entry_monto.grid(row=4, column=1, padx=5, pady=5)

btn_agregar = ttk.Button(frame_form, text="Agregar", command=agregar_datos)
btn_agregar.grid(row=5, column=0, columnspan=2, pady=10)

frame_table = ttk.Frame(root)
frame_table.pack(pady=10)

columns = ("Tópico", "Proveedor", "N° Boleta", "Fecha Boleta", "Monto")
tree = ttk.Treeview(frame_table, columns=columns, show="headings")
for col in columns:
    tree.heading(col, text=col)
    tree.column(col, width=150)

tree.pack()

frame_buttons = ttk.Frame(root)
frame_buttons.pack(pady=10)

btn_guardar = ttk.Button(frame_buttons, text="Guardar Datos", command=lambda: guardar_data(data, dia))
btn_guardar.grid(row=0, column=0, padx=5)
btn_recuperar = ttk.Button(frame_buttons, text="Recuperar Datos", command=lambda: recuperar_data(data))
btn_recuperar.grid(row=0, column=1, padx=5)
btn_procesar = ttk.Button(frame_buttons, text="Procesar Datos", command=lambda: procesar_datos(data, dia, topicos))
btn_procesar.grid(row=0, column=2, padx=5)

# Agregar el mensaje de derechos reservados
frame_footer = ttk.Frame(root)
frame_footer.pack(side="bottom", fill="x")

lbl_derechos = ttk.Label(frame_footer, text="© 2024 Pretorianos Seguridad. Todos los derechos reservados.", anchor="w")
lbl_derechos.pack(side="left", padx=10, pady=5)

root.mainloop()
