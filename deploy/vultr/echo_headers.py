"""Setup check (README.md, Step 3): stands in for the API on port 8000, answers one request with
the X-Forwarded-For header Caddy passed on, then exits. Run it before the API is started."""

from http.server import BaseHTTPRequestHandler, HTTPServer


class Echo(BaseHTTPRequestHandler):
    def do_GET(self):
        body = f"X-Forwarded-For: {self.headers.get('X-Forwarded-For')}\n".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


HTTPServer(("127.0.0.1", 8000), Echo).handle_request()
