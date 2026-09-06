import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I put isDark inside the component, but it's used in the style block outside of it
# First, remove it from wherever it is
content = content.replace(
    "const isDark = document.documentElement.getAttribute('data-mode') === 'dark';",
    ""
)

# Second, insert it at the top
content = content.replace(
    "import { ChevronDown, Trash2 } from 'lucide-react'",
    "import { ChevronDown, Trash2 } from 'lucide-react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected isDark to module scope in RoomsPage.jsx")
