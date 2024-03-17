from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

fkey = '/data/devel/canvas-backend/key.pem'
fcrt = '/data/devel/canvas-backend/cert.pem'

class SecureHTTPServer(HTTPServer):
    def __init__(self, server_address, RequestHandlerClass, bind_and_activate=True,
                 certfile=None, keyfile=None):
        super().__init__(server_address, RequestHandlerClass, bind_and_activate)
        self.socket = ssl.wrap_socket(self.socket,
                                      server_side=True,
                                      certfile=certfile,
                                      keyfile=keyfile,
                                      ssl_version=ssl.PROTOCOL_TLS)

def run(server_class=SecureHTTPServer, handler_class=SimpleHTTPRequestHandler):
    server_address = ('', 4443)  # Listen on port 4443 for HTTPS
    httpd = server_class(server_address, handler_class,
                         certfile=fcrt, keyfile=fkey)
    print('Starting https server...')
    httpd.serve_forever()

# test with curl -v https://localhost:4443

if __name__ == '__main__':
    run()
