import ctypes
import os
import re
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import openpyxl
import qrcode
from PIL import ImageDraw, ImageFont

URL_BASE = "https://inventariom501.proyectobodegam501.workers.dev/"
CARPETA_DEFECTO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "QRmateriales")

try:  # nitidez en pantallas de alta resolución (Windows)
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

FUENTE = ("Segoe UI", 10)
BG = "#f3f4f6"
ACENTO = "#2563eb"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Generador de QR de materiales (solo nuevos)")
        self.tk.call("tk", "scaling", self.winfo_fpixels("1i") / 72)
        self.geometry("760x580")
        self.minsize(640, 520)
        self.configure(bg=BG)

        st = ttk.Style(self)
        st.theme_use("clam")
        st.configure(".", font=FUENTE, background=BG)
        st.configure("TFrame", background=BG)
        st.configure("TLabel", background=BG, foreground="#111827")
        st.configure("Titulo.TLabel", font=("Segoe UI Semibold", 18))
        st.configure("Sub.TLabel", foreground="#6b7280")
        st.configure("TEntry", padding=6, fieldbackground="white")
        st.configure("TButton", padding=(12, 6))
        st.configure("Accent.TButton", background=ACENTO, foreground="white",
                     font=("Segoe UI Semibold", 11), padding=(16, 10))
        st.map("Accent.TButton", background=[("active", "#1d4ed8"), ("disabled", "#93c5fd")])
        st.configure("Horizontal.TProgressbar", troughcolor="#e5e7eb",
                     background=ACENTO, thickness=14, bordercolor=BG)

        self.var_archivo = tk.StringVar()
        self.var_existentes = tk.StringVar(value=CARPETA_DEFECTO)
        self.var_carpeta = tk.StringVar()
        self.var_bodega = tk.StringVar(value="M501")
        self.var_url = tk.StringVar(value=URL_BASE)
        self.var_estado = tk.StringVar(value="Listo.")

        frm = ttk.Frame(self, padding=28)
        frm.pack(fill="both", expand=True)
        frm.columnconfigure(1, weight=1)
        frm.rowconfigure(9, weight=1)

        ttk.Label(frm, text="Generador de QR (solo nuevos)", style="Titulo.TLabel").grid(
            row=0, column=0, columnspan=3, sticky="w")
        ttk.Label(frm, text="Detecta los QR ya creados en una carpeta y genera únicamente los que faltan",
                  style="Sub.TLabel").grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 18))

        def fila(r, texto):
            ttk.Label(frm, text=texto).grid(row=r, column=0, sticky="w", pady=6, padx=(0, 12))

        fila(2, "Archivo Excel")
        ttk.Entry(frm, textvariable=self.var_archivo).grid(row=2, column=1, sticky="ew")
        ttk.Button(frm, text="Examinar", command=self.elegir_archivo).grid(row=2, column=2, padx=(8, 0))

        fila(3, "Carpeta con QR existentes")
        ttk.Entry(frm, textvariable=self.var_existentes).grid(row=3, column=1, sticky="ew")
        ttk.Button(frm, text="Examinar", command=self.elegir_existentes).grid(row=3, column=2, padx=(8, 0))

        fila(4, "Carpeta destino (nuevos)")
        ttk.Entry(frm, textvariable=self.var_carpeta).grid(row=4, column=1, sticky="ew")
        ttk.Button(frm, text="Examinar", command=self.elegir_carpeta).grid(row=4, column=2, padx=(8, 0))
        ttk.Label(frm, text="Si se deja vacía, se usa la carpeta de QR existentes.",
                  style="Sub.TLabel").grid(row=5, column=1, sticky="w")

        fila(6, "Bodega")
        ttk.Entry(frm, textvariable=self.var_bodega, width=14).grid(row=6, column=1, sticky="w")

        fila(7, "URL base")
        ttk.Entry(frm, textvariable=self.var_url).grid(row=7, column=1, columnspan=2, sticky="ew")

        self.btn = ttk.Button(frm, text="Generar QR nuevos", style="Accent.TButton", command=self.iniciar)
        self.btn.grid(row=8, column=0, columnspan=3, pady=14)

        self.barra = ttk.Progressbar(frm, mode="determinate")
        self.barra.grid(row=10, column=0, columnspan=3, sticky="ew")

        self.log = tk.Text(frm, height=6, state="disabled", font=("Consolas", 10), relief="flat",
                           bg="white", padx=8, pady=8, highlightthickness=1,
                           highlightbackground="#d1d5db")
        self.log.grid(row=9, column=0, columnspan=3, sticky="nsew", pady=12)

        ttk.Label(frm, textvariable=self.var_estado, style="Sub.TLabel").grid(
            row=11, column=0, columnspan=3, sticky="w", pady=(8, 0))

    def elegir_archivo(self):
        ruta = filedialog.askopenfilename(
            title="Selecciona el Excel",
            filetypes=[("Excel", "*.xlsx *.xlsm"), ("Todos", "*.*")],
        )
        if ruta:
            self.var_archivo.set(ruta)

    def elegir_existentes(self):
        ruta = filedialog.askdirectory(title="Carpeta con QR ya creados")
        if ruta:
            self.var_existentes.set(ruta)

    def elegir_carpeta(self):
        ruta = filedialog.askdirectory(title="Carpeta destino")
        if ruta:
            self.var_carpeta.set(ruta)

    def escribir(self, texto):
        self.log.configure(state="normal")
        self.log.insert("end", texto + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def iniciar(self):
        if not os.path.isfile(self.var_archivo.get()):
            messagebox.showerror("Error", "Selecciona un archivo Excel válido.")
            return
        if not self.var_existentes.get().strip() and not self.var_carpeta.get().strip():
            messagebox.showerror("Error", "Selecciona la carpeta con los QR existentes.")
            return
        self.btn.configure(state="disabled")
        threading.Thread(target=self.generar, daemon=True).start()

    @staticmethod
    def detectar_existentes(carpeta):
        """Devuelve el conjunto de materiales (como texto) que ya tienen QR en la carpeta."""
        existentes = set()
        if os.path.isdir(carpeta):
            for nombre in os.listdir(carpeta):
                m = re.fullmatch(r"qr_(.+)\.png", nombre, re.IGNORECASE)
                if m:
                    existentes.add(m.group(1))
        return existentes

    def generar(self):
        try:
            archivo = self.var_archivo.get()
            carpeta_exist = self.var_existentes.get().strip()
            carpeta = self.var_carpeta.get().strip() or carpeta_exist
            bodega = self.var_bodega.get().strip()
            base = self.var_url.get()
            os.makedirs(carpeta, exist_ok=True)

            self.after(0, self.var_estado.set, "Detectando QR existentes...")
            existentes = self.detectar_existentes(carpeta_exist)
            if carpeta != carpeta_exist:
                existentes |= self.detectar_existentes(carpeta)
            self.after(0, self.escribir, f"{len(existentes)} QR ya existentes detectados.")

            self.after(0, self.var_estado.set, "Leyendo Excel...")
            wb = openpyxl.load_workbook(archivo, read_only=True)
            hoja = wb.active
            materiales = []
            vistos = set()
            omitidos = 0
            for fila in hoja.iter_rows(values_only=True):
                if len(fila) >= 3 and fila[2] == bodega and fila[1] != "NULO" and fila[0] is not None:
                    clave = str(fila[0])
                    if clave in vistos:
                        continue
                    vistos.add(clave)
                    if clave in existentes:
                        omitidos += 1
                    else:
                        materiales.append(fila[0])
            wb.close()

            total = len(materiales)
            self.after(0, self.escribir,
                       f"Bodega {bodega}: {total} nuevos, {omitidos} omitidos (ya existen).")
            self.after(0, lambda: self.barra.configure(maximum=max(total, 1), value=0))

            for n, material in enumerate(materiales, 1):
                qr = qrcode.QRCode(version=2, box_size=10, border=5,
                                   error_correction=qrcode.constants.ERROR_CORRECT_M)
                qr.add_data(f"{base}{material}")
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white").get_image().convert("RGB")
                draw = ImageDraw.Draw(img)
                try:
                    fuente = ImageFont.truetype("arialbd.ttf", 30)
                except OSError:
                    fuente = ImageFont.load_default()
                ancho, alto = img.size
                draw.text((ancho / 2, alto - 27), str(material), fill="black",
                          font=fuente, anchor="mm")
                img.save(os.path.join(carpeta, f"qr_{material}.png"))
                self.after(0, self.barra.configure, {"value": n})
                self.after(0, self.var_estado.set, f"Generando {n}/{total}")

            self.after(0, self.var_estado.set, "Completado.")
            self.after(0, self.escribir, f"Listo. {total} QR nuevos guardados en {carpeta}")
        except Exception as e:
            self.after(0, lambda: messagebox.showerror("Error", str(e)))
            self.after(0, self.var_estado.set, "Error.")
        finally:
            self.after(0, lambda: self.btn.configure(state="normal"))


if __name__ == "__main__":
    App().mainloop()
