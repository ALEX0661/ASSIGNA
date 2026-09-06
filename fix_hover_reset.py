import os

filepath = 'packages/frontend/src/pages/LoginPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '.login-root button:hover { background: none; }',
    '.login-root button:not(.login-btn):hover { background: none; }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Excluded login-btn from the blanket background reset!")
