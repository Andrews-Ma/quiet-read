#!/usr/bin/env python3
"""Generate the shared web interface for the Windows application."""
from pathlib import Path
from build import create_html

output = Path(__file__).resolve().parent.parent / 'src' / 'windows' / 'Generated' / 'index.html'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(create_html(), encoding='utf-8')
print(f'Generated {output}')
