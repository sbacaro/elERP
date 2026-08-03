#!/usr/bin/env python3
"""Bridge mínimo ESC/POS para elERP (rede local).

Recebe POST /print com body application/octet-stream e envia à impressora TCP :9100
ou grava em arquivo para debug.

Uso:
  pip install (stdlib only)
  python tools/print_bridge.py --printer 192.168.0.50:9100
"""
from __future__ import annotations

import argparse
import socket
from http.server import BaseHTTPRequestHandler, HTTPServer


def send_raw(host: str, port: int, data: bytes) -> None:
    with socket.create_connection((host, port), timeout=5) as sock:
        sock.sendall(data)


class Handler(BaseHTTPRequestHandler):
    printer_host = "127.0.0.1"
    printer_port = 9100
    dump_path = ""

    def do_OPTIONS(self):  # CORS for Pages
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-elERP-Job")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length)
        try:
            if self.path.startswith("/fiscal"):
                # stub ACK — integre com ACBr/DLL no seu ambiente
                body = b'{"ok":true,"note":"stub fiscal bridge"}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if self.dump_path:
                with open(self.dump_path, "ab") as f:
                    f.write(data)
            else:
                send_raw(self.printer_host, self.printer_port, data)
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"ok")
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).encode()
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--listen", default="127.0.0.1:9100")
    ap.add_argument("--printer", default="", help="host:port da térmica RAW (ex. 192.168.0.50:9100)")
    ap.add_argument("--dump", default="", help="grava bytes em arquivo em vez de enviar")
    args = ap.parse_args()
    host, port = args.listen.split(":")
    Handler.dump_path = args.dump
    if args.printer:
        ph, pp = args.printer.split(":")
        Handler.printer_host = ph
        Handler.printer_port = int(pp)
    httpd = HTTPServer((host, int(port)), Handler)
    print(f"elERP print bridge em http://{host}:{port}/print")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
