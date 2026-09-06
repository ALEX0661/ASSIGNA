import os

filepath = 'packages/frontend/src/pages/admin/SettingsPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("border: 1px solid ,", "border: `1px solid ${G.border}`,")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed syntax error using single quotes powershell")
