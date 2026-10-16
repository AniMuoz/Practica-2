import ctypes
import os
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import openpyxl
import qrcode

URL_BASE = "https://practica-2.anibalmunoz74.workers.dev/"
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
        self.title("Generador de QR de materiales")
        self.tk.call("tk", "scaling", self.winfo_fpixels("1i") / 72)
        self.geometry("760x540")
        self.minsize(640, 480)
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
        self.var_carpeta = tk.StringVar()
        self.var_bodega = tk.StringVar(value="M501")
        self.var_url = tk.StringVar(value=URL_BASE)
        self.var_estado = tk.StringVar(value="Listo.")

        frm = ttk.Frame(self, padding=28)
        frm.pack(fill="both", expand=True)
        frm.columnconfigure(1, weight=1)
        frm.rowconfigure(8, weight=1)

        ttk.Label(frm, text="Generador de QR", style="Titulo.TLabel").grid(
            row=0, column=0, columnspan=3, sticky="w")
        ttk.Label(frm, text="Crea códigos QR de materiales desde un Excel",
                  style="Sub.TLabel").grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 18))

        def fila(r, texto):
            ttk.Label(frm, text=texto).grid(row=r, column=0, sticky="w", pady=6, padx=(0, 12))

        fila(2, "Archivo Excel")
        ttk.Entry(frm, textvariable=self.var_archivo).grid(row=2, column=1, sticky="ew")
        ttk.Button(frm, text="Examinar", command=self.elegir_archivo).grid(row=2, column=2, padx=(8, 0))

        fila(3, "Carpeta destino")
        ttk.Entry(frm, textvariable=self.var_carpeta).grid(row=3, column=1, sticky="ew")
        ttk.Button(frm, text="Examinar", command=self.elegir_carpeta).grid(row=3, column=2, padx=(8, 0))

        fila(4, "Bodega")
        ttk.Entry(frm, textvariable=self.var_bodega, width=14).grid(row=4, column=1, sticky="w")

        fila(5, "URL base")
        ttk.Entry(frm, textvariable=self.var_url).grid(row=5, column=1, columnspan=2, sticky="ew")

        self.btn = ttk.Button(frm, text="Generar QR", style="Accent.TButton", command=self.iniciar)
        self.btn.grid(row=6, column=0, columnspan=3, pady=18)

        self.barra = ttk.Progressbar(frm, mode="determinate")
        self.barra.grid(row=7, column=0, columnspan=3, sticky="ew")

        self.log = tk.Text(frm, height=6, state="disabled", font=("Consolas", 10), relief="flat",
                           bg="white", padx=8, pady=8, highlightthickness=1,
                           highlightbackground="#d1d5db")
        self.log.grid(row=8, column=0, columnspan=3, sticky="nsew", pady=12)

        ttk.Label(frm, textvariable=self.var_estado, style="Sub.TLabel").grid(
            row=9, column=0, columnspan=3, sticky="w")

    def elegir_archivo(self):
        ruta = filedialog.askopenfilename(
            title="Selecciona el Excel",
            filetypes=[("Excel", "*.xlsx *.xlsm"), ("Todos", "*.*")],
        )
        if ruta:
            self.var_archivo.set(ruta)

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
        if not self.var_carpeta.get().strip():
            messagebox.showerror("Error", "Selecciona una carpeta destino.")
            return
        self.btn.configure(state="disabled")
        threading.Thread(target=self.generar, daemon=True).start()

    def generar(self):
        try:
            archivo = self.var_archivo.get()
            carpeta = self.var_carpeta.get()
            bodega = self.var_bodega.get().strip()
            base = self.var_url.get()
            os.makedirs(carpeta, exist_ok=True)

            self.after(0, self.var_estado.set, "Leyendo Excel...")
            wb = openpyxl.load_workbook(archivo, read_only=True)
            hoja = wb.active
            materiales = []
            for fila in hoja.iter_rows(values_only=True):
                if len(fila) >= 3 and fila[2] == bodega and fila[1] != "NULO" and fila[0] is not None:
                    materiales.append(fila[0])
            wb.close()

            total = len(materiales)
            self.after(0, self.escribir, f"{total} materiales en bodega {bodega}.")
            self.after(0, lambda: self.barra.configure(maximum=max(total, 1), value=0))

            for n, material in enumerate(materiales, 1):
                qr = qrcode.QRCode(version=2, box_size=10, border=5,
                                   error_correction=qrcode.constants.ERROR_CORRECT_M)
                qr.add_data(f"{base}{material}")
                qr.make(fit=True)
                qr.make_image(fill_color="black", back_color="white").save(
                    os.path.join(carpeta, f"qr_{material}.png"))
                self.after(0, self.barra.configure, {"value": n})
                self.after(0, self.var_estado.set, f"Generando {n}/{total}")

            self.after(0, self.var_estado.set, "Completado.")
            self.after(0, self.escribir, f"Listo. QR guardados en {carpeta}")
        except Exception as e:
            self.after(0, lambda: messagebox.showerror("Error", str(e)))
            self.after(0, self.var_estado.set, "Error.")
        finally:
            self.after(0, lambda: self.btn.configure(state="normal"))


if __name__ == "__main__":
    App().mainloop()
