import os

filepath = 'packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("background: isDark ? 'rgba(124, 58, 237, 0.05)' : '#FAFAFF'", "background: 'var(--hover)'")
content = content.replace("already ? (isDark ? 'rgba(124, 58, 237, 0.05)' : 'var(--hover)')", "already ? 'color-mix(in srgb, #6D28D9 10%, var(--surface))'")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed static isDark backgrounds in SpecializationModal.jsx")
