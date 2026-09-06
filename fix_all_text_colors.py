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
    
    # 1. CSS string literals: color: ; -> color: var(--meadow-text);
    content = re.sub(
        r'color:\s*\$\{G\.meadowDeep\}',
        r'color: var(--meadow-text)',
        content
    )
    
    # 2. CSS string literals: color: ; -> color: var(--meadow-text-hover);
    content = re.sub(
        r'color:\s*\$\{G\.meadow\}',
        r'color: var(--meadow-text-hover)',
        content
    )

    # 3. Inline style objects: color: G.meadowDeep -> color: 'var(--meadow-text)'
    # Also handles cases where it might be color:G.meadowDeep
    content = re.sub(
        r'color:\s*G\.meadowDeep(?!\w)',
        r"color: 'var(--meadow-text)'",
        content
    )
    
    # 4. Inline style objects: color: G.meadow -> color: 'var(--meadow-text-hover)'
    content = re.sub(
        r'color:\s*G\.meadow(?!\w)',
        r"color: 'var(--meadow-text-hover)'",
        content
    )
    
    # 5. Handle already modified color: isDark ? 'var(--mint)' : G.meadowDeep
    content = re.sub(
        r"color:\s*isDark\s*\?\s*'var\(--mint\)'\s*:\s*G\.meadowDeep",
        r"color: 'var(--meadow-text)'",
        content
    )

    content = re.sub(
        r"color:\s*\$\{isDark\s*\?\s*'var\(--mint\)'\s*:\s*G\.meadowDeep\}",
        r"color: var(--meadow-text)",
        content
    )
    
    content = re.sub(
        r"color:\s*isDark\s*\?\s*'var\(--mint\)'\s*:\s*G\.meadow",
        r"color: 'var(--meadow-text-hover)'",
        content
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done replacing meadow colors in text properties!")
