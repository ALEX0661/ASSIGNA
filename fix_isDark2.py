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
    
    # Replace inline isDark ? 'var(--mint)' : G.meadow with 'var(--meadow-text-hover)'
    content = re.sub(
        r"isDark\s*\?\s*'var\(--mint\)'\s*:\s*G\.meadow(?!\w)",
        r"'var(--meadow-text-hover)'",
        content
    )
    
    # Replace inline isDark ? 'var(--mint)' : 'var(--meadow-text-hover)' with 'var(--meadow-text-hover)'
    content = re.sub(
        r"isDark\s*\?\s*'var\(--mint\)'\s*:\s*'var\(--meadow-text-hover\)'",
        r"'var(--meadow-text-hover)'",
        content
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated more isDark in {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done fixing isDark again!")
