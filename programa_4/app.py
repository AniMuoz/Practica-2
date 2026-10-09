"""Bitácora de camión sin base de datos.

El estado vive en el navegador. El servidor solo genera el Excel (.xlsx)
y lee un Excel generado antes para seguir editando ese folio.
"""
import base64
import io
import os
import re
from datetime import date, datetime

from flask import Flask, jsonify, render_template, request, send_file
from openpyxl import Workbook, load_workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.utils import get_column_letter
from openpyxl.utils.units import pixels_to_EMU
from PIL import Image as PilImage

import sys

# Con PyInstaller los archivos incluidos quedan en sys._MEIPASS.
BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
app = Flask(__name__, template_folder=os.path.join(BASE, "templates"))
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

LOGOS = [
    os.path.join(BASE, "icono", "logo-bitacora.png"),
    os.path.join(BASE, "static", "logo-bitacora.png"),
    os.path.join(BASE, "..", "prog2", "back", "assets", "logo-bitacora.png"),
]

COLUMNAS = [
    ("fecha", "FECHA", 9),
    ("chofer", "CHOFER", 9.89),
    ("rut", "RUT", 7.44),
    ("patente", "PATENTE", 6.89),
    ("ruta", "RUTA", 11.33),
    ("h_salida", "H.SALIDA", 6.66),
    ("h_llegada", "H.LLEGADA", 7.89),
    ("km_ini", "KM/INI", 6.89),
    ("km_term", "KM/TERM", 7.33),
    ("km_reco", "KM/RECO", 8.11),
    ("observacion", "OBSERVACION", 27.66),
    ("firma", "FIRMA", 15.55),
]
CAMPOS = [c[0] for c in COLUMNAS]
FIRMA_COL = len(COLUMNAS) - 1
FILA_INICIO = 5
LARGO_MAX = 200
FIRMA_MAX = 1024 * 1024
FUENTE = "Aptos Narrow"
LADO = Side(style="thin")
BORDE = Border(top=LADO, left=LADO, bottom=LADO, right=LADO)


def numero(valor):
    texto = str(valor if valor is not None else "").strip().replace(",", ".")
    if re.fullmatch(r"-?\d+(\.\d+)?", texto):
        return float(texto)
    return None


def recorrido(ini, term):
    a, b = numero(ini), numero(term)
    if a is None or b is None:
        return ""
    r = round(b - a, 3)
    return str(int(r)) if r == int(r) else str(r)


def fecha_valida(texto):
    try:
        datetime.strptime(texto, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def decodificar_firma(valor):
    m = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", valor or "")
    if not m:
        return None
    datos = base64.b64decode(m.group(1))
    if len(datos) > FIRMA_MAX:
        return None
    try:
        PilImage.open(io.BytesIO(datos)).verify()
    except Exception:
        return None
    return datos


def armar_excel(folio, filas):
    wb = Workbook()
    ws = wb.active
    ws.title = "Hoja1"
    ws.page_setup.orientation = "landscape"
    for i, (_, _, ancho) in enumerate(COLUMNAS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = ancho

    ws.row_dimensions[1].height = 33.6
    ws["C1"] = "PLANILLA CONTROL DE VIAJE"
    ws["C1"].font = Font(name=FUENTE, size=26, bold=True)
    ws.merge_cells("K1:L1")
    ws["K1"] = f"FOLIO Nº {folio}"
    ws["K1"].font = Font(name=FUENTE, size=26, bold=True)
    ws["K1"].alignment = Alignment(horizontal="center")

    for ruta in LOGOS:
        if os.path.exists(ruta):
            logo = XlImage(ruta)
            logo.width, logo.height = 136, 59.5
            ws.add_image(logo, "A1")
            break

    for i, (_, titulo, _) in enumerate(COLUMNAS, start=1):
        c = ws.cell(row=4, column=i, value=titulo)
        c.font = Font(name=FUENTE, size=8, bold=True)
        c.alignment = Alignment(horizontal="center")
        c.border = BORDE

    for idx, fila in enumerate(filas):
        r = FILA_INICIO + idx
        ws.row_dimensions[r].height = 28.5
        for pos, (campo, _, ancho) in enumerate(COLUMNAS, start=1):
            valor = str(fila.get(campo, "") or "").strip()
            if campo != "firma":
                valor = valor[:LARGO_MAX]
            c = ws.cell(row=r, column=pos)
            c.font = Font(name=FUENTE, size=11)
            c.border = BORDE
            c.alignment = Alignment(horizontal="center", vertical="center",
                                    wrap_text=(campo == "observacion"))
            if campo == "km_reco":
                valor = recorrido(fila.get("km_ini"), fila.get("km_term"))
            if campo in ("km_ini", "km_term", "km_reco"):
                n = numero(valor)
                if n is not None:
                    valor = int(n) if n == int(n) else n
            elif campo == "fecha":
                if valor and fecha_valida(valor):
                    valor = "/".join(reversed(valor.split("-")))
                c.alignment = Alignment(horizontal="center", vertical="center", shrink_to_fit=True)
            elif campo == "firma":
                datos = decodificar_firma(valor)
                if datos:
                    pil = PilImage.open(io.BytesIO(datos))
                    w_cel, h_cel = round(ancho * 7 + 5), round(28.5 * 96 / 72)
                    esc = min(1, (w_cel - 4) / pil.width, (h_cel - 4) / pil.height)
                    w, h = max(1, round(pil.width * esc)), max(1, round(pil.height * esc))
                    img = XlImage(io.BytesIO(datos))
                    img.anchor = OneCellAnchor(
                        _from=AnchorMarker(col=FIRMA_COL, row=r - 1,
                                           colOff=pixels_to_EMU((w_cel - w) // 2),
                                           rowOff=pixels_to_EMU((h_cel - h) // 2)),
                        ext=XDRPositiveSize2D(pixels_to_EMU(w), pixels_to_EMU(h)),
                    )
                    ws.add_image(img)
                    valor = ""
            if valor != "":
                c.value = valor
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out


def imagenes_del_zip(contenido):
    """Lee las imágenes directo del .xlsx (sirve para planillas de Excel, ExcelJS u openpyxl)."""
    import posixpath
    import zipfile
    import xml.etree.ElementTree as ET

    XDR = "{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}"
    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    resultado = {}
    with zipfile.ZipFile(io.BytesIO(contenido)) as z:
        nombres = set(z.namelist())
        for nombre in nombres:
            if not re.fullmatch(r"xl/drawings/drawing\d+\.xml", nombre):
                continue
            rels = {}
            ruta_rels = f"xl/drawings/_rels/{posixpath.basename(nombre)}.rels"
            if ruta_rels in nombres:
                for rel in ET.fromstring(z.read(ruta_rels)):
                    destino = rel.get("Target", "")
                    if destino.startswith("/"):
                        destino = destino.lstrip("/")
                    else:
                        destino = posixpath.normpath(posixpath.join("xl/drawings", destino))
                    rels[rel.get("Id")] = destino
            for ancla in ET.fromstring(z.read(nombre)):
                desde = ancla.find(XDR + "from")
                blip = next(ancla.iter(A + "blip"), None)
                if desde is None or blip is None:
                    continue
                hasta = ancla.find(XDR + "to")
                col_ini = int(desde.findtext(XDR + "col"))
                col_fin = int(hasta.findtext(XDR + "col")) if hasta is not None else col_ini
                fila = int(desde.findtext(XDR + "row")) + 1
                destino = rels.get(blip.get(R + "embed"))
                if destino not in nombres or not (col_ini <= FIRMA_COL <= col_fin) or fila < FILA_INICIO:
                    continue
                datos = z.read(destino)
                try:
                    buf = io.BytesIO()
                    PilImage.open(io.BytesIO(datos)).convert("RGBA").save(buf, "PNG")
                    datos = buf.getvalue()
                except Exception:
                    continue
                resultado[fila] = "data:image/png;base64," + base64.b64encode(datos).decode()
    return resultado


def leer_excel(archivo):
    contenido = archivo.read()
    wb = load_workbook(io.BytesIO(contenido))
    ws = wb.active
    m = re.search(r"(\d+)", str(ws["K1"].value or ""))
    folio = int(m.group(1)) if m else None

    try:
        firmas = imagenes_del_zip(contenido)
    except Exception as e:
        app.logger.warning("Lectura directa de imágenes falló: %s", e)
        firmas = {}
    for img in getattr(ws, "_images", []):
        try:
            ancla = img.anchor
            marca = getattr(ancla, "_from", None)
            if marca is None:
                continue
            fin = getattr(ancla, "to", None)
            col_ini = marca.col
            col_fin = fin.col if fin is not None else marca.col
            # Excel puede mover o ensanchar la imagen: se acepta si toca la columna FIRMA.
            if not (col_ini <= FIRMA_COL <= col_fin):
                continue
            fila_img = marca.row + 1
            if fila_img < FILA_INICIO:
                continue
            # Si el desplazamiento la dejó casi al borde inferior, pertenece a la fila siguiente.
            datos = img._data()
            try:
                im = PilImage.open(io.BytesIO(datos))
                buf = io.BytesIO()
                im.convert("RGBA").save(buf, "PNG")
                datos = buf.getvalue()
            except Exception:
                pass
            firmas.setdefault(fila_img, "data:image/png;base64," + base64.b64encode(datos).decode())
        except Exception as e:
            app.logger.warning("No se pudo leer una imagen: %s", e)

    filas = []
    ultima = FILA_INICIO - 1
    for r in range(FILA_INICIO, max([ws.max_row, *firmas.keys()]) + 1):
        fila = {}
        vacia = r not in firmas
        for pos, campo in enumerate(CAMPOS, start=1):
            v = ws.cell(row=r, column=pos).value
            if isinstance(v, (datetime, date)):
                v = v.strftime("%Y-%m-%d")
            elif isinstance(v, float) and v == int(v):
                v = int(v)
            v = "" if v is None else str(v).strip()
            if campo == "fecha":
                m2 = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", v)
                if m2:
                    v = f"{m2.group(3)}-{int(m2.group(2)):02d}-{int(m2.group(1)):02d}"
            if campo == "fecha":
                m3 = re.match(r"(\d{4}-\d{2}-\d{2})", v)
                v = m3.group(1) if m3 and fecha_valida(m3.group(1)) else ""
            v = v[:LARGO_MAX]
            if v != "":
                vacia = False
            fila[campo] = v
        if campo_firma := firmas.get(r):
            fila["firma"] = campo_firma
        if not vacia:
            ultima = r
        filas.append(fila)
    filas = filas[: ultima - FILA_INICIO + 1]
    for f in filas:
        f["km_reco"] = recorrido(f["km_ini"], f["km_term"])
    return folio, filas


def buscar(*rutas):
    for r in rutas:
        r = os.path.normpath(os.path.join(BASE, r))
        if os.path.exists(r):
            return r
    return None


@app.get("/logo.png")
def logo():
    ruta = buscar("icono/logo.png", "Images/logo.png", "images/logo.png", "static/logo.png",
                  "icono/favicon.png", "icono/logo.ico", "icono/icono.ico",
                  "../programa_3/Images/logo.png")
    return send_file(ruta) if ruta else ("", 404)


@app.get("/favicon.ico")
def favicon():
    ruta = buscar("icono/favicon.ico", "icono/logo.ico", "icono/icono.ico", "static/favicon.ico",
                  "../programa_3/icono/favicon.ico", "../programa_3/icono/icono.ico")
    if not ruta:
        return ("", 404)
    resp = send_file(ruta, mimetype="image/x-icon")
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/favicon.png")
def favicon_png():
    ruta = buscar("icono/favicon.png", "icono/logo.png", "static/favicon.png", "../programa_3/icono/favicon.png",
                  "static/logo.png", "../programa_3/Images/logo.png")
    if not ruta:
        return ("", 404)
    resp = send_file(ruta, mimetype="image/png")
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.post("/api/apagar")
def apagar():
    def cerrar():
        import time
        time.sleep(0.5)
        os._exit(0)

    import threading
    threading.Thread(target=cerrar, daemon=True).start()
    return jsonify(ok=True)


@app.get("/")
def inicio():
    return render_template("index.html", columnas=[{"campo": c, "titulo": t} for c, t, _ in COLUMNAS])


@app.post("/api/exportar")
def exportar():
    datos = request.get_json(silent=True) or {}
    folio = str(datos.get("folio", "")).strip()
    if not re.fullmatch(r"[1-9]\d{0,8}", folio):
        return jsonify(error="Folio inválido: debe ser un número desde 1."), 400
    filas = datos.get("filas")
    if not isinstance(filas, list):
        return jsonify(error="No hay filas para exportar."), 400
    for f in filas:
        if not isinstance(f, dict):
            return jsonify(error="Filas inválidas."), 400
        fecha = str(f.get("fecha", "") or "")
        if fecha and not fecha_valida(fecha):
            return jsonify(error="Hay una fecha no válida."), 400
    try:
        salida = armar_excel(folio, filas)
    except Exception as e:
        app.logger.exception("Error al armar el Excel")
        return jsonify(error=f"No se pudo generar la planilla: {e}"), 500
    return send_file(
        salida,
        as_attachment=True,
        download_name=f"Bitacora folio {folio}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.post("/api/importar")
def importar():
    archivo = request.files.get("archivo")
    if not archivo:
        return jsonify(error="Falta el archivo."), 400
    try:
        folio, filas = leer_excel(archivo.stream)
    except Exception:
        return jsonify(error="No se pudo leer el archivo. Sube una planilla generada por este programa (.xlsx)."), 400
    return jsonify(folio=folio, filas=filas)


if __name__ == "__main__":
    import threading
    import webbrowser

    threading.Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:5004")).start()
    app.run(host="127.0.0.1", port=5004, debug=False)
