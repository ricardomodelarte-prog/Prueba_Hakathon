# Servidor local para probar la demo:  python servir.py   ->  http://localhost:8000/
# Sirve la carpeta docs/, desactiva la caché del navegador (así siempre ves la última versión)
# y fija los tipos MIME para que Chrome muestre las páginas en vez de descargarlas.
import functools
import http.server
import pathlib
import sys


class Manejador(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".glb": "model/gltf-binary",
        ".mind": "application/octet-stream",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
carpeta = pathlib.Path(__file__).resolve().parent / "docs"
print(f"Abre http://localhost:{puerto}/ en Chrome  (Ctrl+C para parar)")
http.server.ThreadingHTTPServer(("", puerto), functools.partial(Manejador, directory=str(carpeta))).serve_forever()
