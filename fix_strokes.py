import os
import re

directories = [
    'packages/frontend/src/pages',
    'packages/frontend/src/components'
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # 1. stroke={G.meadowDeep} -> stroke="var(--meadow-text)"
    content = re.sub(
        r'stroke=\{?G\.meadowDeep\}?',
        r'stroke="var(--meadow-text)"',
        content
    )
    
    # 2. stroke={G.meadow} -> stroke="var(--meadow-text-hover)"
    content = re.sub(
        r'stroke=\{?G\.meadow\}?',
        r'stroke="var(--meadow-text-hover)"',
        content
    )
    
    # 3. background:G.meadowDeep -> background:'var(--meadow-text)'  (only for small dots/badges)
    # Be careful not to replace gradients that need the actual hex. Let's just fix the specific phase dot.
    content = re.sub(
        r"background:\s*G\.meadowDeep\s*\}\}",
        r"background:'var(--meadow-text)' }}",
        content
    )
    
    # 4. border:... G.meadowDeep -> border:... var(--meadow-text)
    content = re.sub(
        r"border:\s*([^]*)\$\{G\.meadowDeep\}([^]*)",
        r"border: \g<1>var(--meadow-text)\g<2>",
        content
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated strokes/borders in {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done fixing SVG strokes and borders!")
