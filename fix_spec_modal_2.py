import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "color: active ? 'var(--meadow)' : 'var(--muted2)'",
    "color: active ? (isDark ? 'var(--mint)' : 'var(--meadow)') : 'var(--muted2)'"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed active text color in SpecializationModal")
