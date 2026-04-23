import base64
import zlib
import urllib.request
import os

def render_kroki(input_path, output_path):
    with open(input_path, 'r') as f:
        code = f.read()
    
    compressed = zlib.compress(code.encode('utf-8'), 9)
    encoded = base64.urlsafe_b64encode(compressed).decode('utf-8')
    url = f"https://kroki.io/mermaid/png/{encoded}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        out_file.write(response.read())
    print(f"Rendered {output_path}")

render_kroki('docs/c4_context.mmd', 'docs/c4_context.png')
render_kroki('docs/c4_container.mmd', 'docs/c4_container.png')
render_kroki('docs/c4_component.mmd', 'docs/c4_component.png')
