#!/usr/bin/env python3
"""
Simple HTTP server for local development
Run this to test the site with proper HTTP protocol (avoids file:// issues)

Usage:
    python serve.py

Then open: http://localhost:8000
"""

import http.server
import socketserver
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def main():
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print("=" * 60)
        print(f"🚀 FPL Stats Hub Development Server")
        print("=" * 60)
        print(f"\n✅ Server running at: http://localhost:{PORT}")
        print(f"\n📂 Serving files from: {os.getcwd()}")
        print(f"\n🌐 Open in your browser:")
        print(f"   http://localhost:{PORT}")
        print(f"\n⌨️  Press Ctrl+C to stop the server\n")
        print("=" * 60 + "\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped. Goodbye!")

if __name__ == "__main__":
    main()
