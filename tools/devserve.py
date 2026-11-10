#!/usr/bin/env python3
"""Local static server for the prototype: like `python3 -m http.server`, but it tells the browser never to cache,
so a reload always shows the latest CSS and JS. Usage: python3 tools/devserve.py 8000 client"""
import functools, http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = sys.argv[2] if len(sys.argv) > 2 else "client"
http.server.ThreadingHTTPServer(("", port), functools.partial(NoCache, directory=root)).serve_forever()
