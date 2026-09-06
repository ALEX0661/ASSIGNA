import os

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const isDark = document.documentElement.getAttribute('data-mode') === 'dark'\nconst DAY_ORDER",
    "const DAY_ORDER"
)

content = content.replace(
    "export default function FacultyEventsTable({ events, computeUnits, fetchError, onExport }) {\n  const [sortKey, setSortKey]",
    "export default function FacultyEventsTable({ events, computeUnits, fetchError, onExport }) {\n  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'\n  const [sortKey, setSortKey]"
)

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Moved isDark inside component")
