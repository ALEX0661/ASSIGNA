import os

with open('packages/frontend/src/index.css', 'r', encoding='utf-8') as f:
    content = f.read()

if '--meadow-text:' not in content:
    content = content.replace(
        "--meadow-deep: #0F5C2C;",
        "--meadow-deep: #0F5C2C;\n  --meadow-text: var(--meadow-deep);\n  --meadow-text-hover: var(--meadow);"
    )
    content = content.replace(
        "[data-mode=\"dark\"] {\n  --bg:",
        "[data-mode=\"dark\"] {\n  --meadow-text: var(--mint);\n  --meadow-text-hover: var(--mint);\n  --bg:"
    )

with open('packages/frontend/src/index.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added --meadow-text to index.css")
