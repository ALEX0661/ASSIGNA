import os

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { useMemo, useState } from 'react'\n",
    "import { useMemo, useState } from 'react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';\n"
)

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected isDark into FacultyEventsTable.jsx")
