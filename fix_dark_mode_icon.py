import os

filepath = 'packages/frontend/src/pages/admin/SettingsPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the stroke in the dark mode SVGs
content = content.replace("stroke={'var(--meadow-text-hover)'} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M12 3a6", "stroke={'var(--meadow)'} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M12 3a6")
content = content.replace("stroke={'var(--meadow-text-hover)'} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\"", "stroke={'var(--meadow)'} strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\"")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed dark mode icon stroke")
