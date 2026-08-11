import http.server, ssl
server_address = ('localhost', 8443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket, server_side=True, certfile='server.pem', ssl_version=ssl.PROTOCOL_TLS)
print("Serving HTTPS on https://localhost:8443 ...")
httpd.serve_forever()
