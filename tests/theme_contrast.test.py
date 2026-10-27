"""Check readable contrast for all shipped color themes."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
css = (root / 'src/web/style.css').read_text(encoding='utf-8')
html = (root / 'src/web/template.html').read_text(encoding='utf-8')
themes = re.findall(r'<option value="([a-z]+)" data-i18n="theme', html)
assert len(themes) == 6 and len(set(themes)) == 6
rules = re.findall(r'([^{}]+)\{([^{}]+)\}', css)

def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    channels = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
    return sum(c * weight for c, weight in zip(channels, (.2126, .7152, .0722)))

def ratio(a, b):
    values = sorted((luminance(a), luminance(b)))
    return (values[1] + .05) / (values[0] + .05)

pairs = [('reading-cue', 'reading-bg'), ('reading-active', 'reading-bg'),
         ('ui-text', 'ui-bar'), ('ui-text', 'ui-panel'), ('ui-text', 'ui-control'),
         ('ui-text', 'ui-hover'), ('ui-text', 'ui-input'), ('ui-muted', 'ui-panel'),
         ('ui-muted', 'ui-bar'), ('ui-selected-text', 'ui-selected'),
         ('ui-error-text', 'ui-error-bg'), ('ui-warning-text', 'ui-warning-bg')]
for theme in themes:
    values = {}
    for selector, block in rules:
        selectors = [item.strip() for item in selector.split(',')]
        if ':root' in selectors or f':root[data-theme="{theme}"]' in selectors:
            values.update(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})', block))
    for foreground, background in pairs:
        contrast = ratio(values[foreground], values[background])
        assert contrast >= 4.5, f'{theme}: {foreground} on {background} is {contrast:.2f}'
print('Passed: text and control contrast for all six themes.')
