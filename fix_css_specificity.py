import os

filepath = 'packages/frontend/src/index.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('[data-mode="dark"] {', ':root[data-mode="dark"] {')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.css specificity")
