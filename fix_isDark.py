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
    
    # Replace inline isDark ? 'var(--mint)' : 'var(--meadow)' with 'var(--meadow-text-hover)'
    content = re.sub(
        r"isDark\s*\?\s*'var\(--mint\)'\s*:\s*'var\(--meadow\)'",
        r"'var(--meadow-text-hover)'",
        content
    )
    
    # Replace inline isDark ? 'var(--mint)' : 'var(--meadow-deep)' with 'var(--meadow-text)'
    content = re.sub(
        r"isDark\s*\?\s*'var\(--mint\)'\s*:\s*'var\(--meadow-deep\)'",
        r"'var(--meadow-text)'",
        content
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated isDark in {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done fixing isDark!")
