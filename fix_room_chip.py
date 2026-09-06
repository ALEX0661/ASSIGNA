import os

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "background: isLab ? 'color-mix(in srgb, #6D28D9 15%, transparent)' : '#F2F7F4', color: isLab ? '#A78BFA' : '#1C3D2A'",
    "background: isLab ? 'color-mix(in srgb, #6D28D9 15%, transparent)' : 'var(--bg)', color: isLab ? '#A78BFA' : 'var(--ink2)'"
)

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Room chip updated")
