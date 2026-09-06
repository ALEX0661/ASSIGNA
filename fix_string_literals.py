import os
import re

directories = ['packages/frontend/src/pages', 'packages/frontend/src/components']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Replace color: 'var(--meadow)' or color: "var(--meadow)" with color: 'var(--meadow-text)'
    content = re.sub(r'color:\s*([\'"])var\(--meadow\)\1', r'color: \1var(--meadow-text)\1', content)
    
    # Also for color: 'var(--meadow-deep)' if any
    content = re.sub(r'color:\s*([\'"])var\(--meadow-deep\)\1', r'color: \1var(--meadow-text)\1', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done string literal replace!")
