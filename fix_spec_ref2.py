import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { useTour } from '../../hooks/useTour.jsx'\n",
    "import { useTour } from '../../hooks/useTour.jsx'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';\n"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected isDark after imports")
