import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "border: 1.5px solid ,",
    "border: 1.5px solid ,"
)
content = content.replace(
    "background: show ? l.bg : '#F8F7FC',",
    "background: show ? l.bg : 'var(--surface)',"
)
content = content.replace(
    "color: show ? l.color : '#BDB8D4',",
    "color: show ? l.color : 'var(--muted)',"
)

content = content.replace(
    "border: '1px solid #FEE2E2'",
    "border: '1px solid rgba(239, 68, 68, 0.25)'"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("RatingPips updated")
