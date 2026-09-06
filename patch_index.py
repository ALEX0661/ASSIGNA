import os

with open('packages/frontend/src/index.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert into :root
if '--meadow-text:' not in content:
    content = content.replace(
        "--meadow-deep: #0F5C2C;",
        "--meadow-deep: #0F5C2C;\n  --meadow-text: var(--meadow-deep);\n  --meadow-text-hover: var(--meadow);"
    )
    
    # Insert into [data-mode="dark"]
    content = content.replace(
        "[data-mode=\"dark\"] {\n  --bg: #121212;",
        "[data-mode=\"dark\"] {\n  --meadow-text: var(--mint);\n  --meadow-text-hover: var(--mint);\n  --bg: #121212;"
    )

with open('packages/frontend/src/index.css', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated index.css with --meadow-text")
