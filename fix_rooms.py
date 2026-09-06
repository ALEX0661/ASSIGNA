import os
import re

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert isDark if not exists
if 'const isDark =' not in content:
    content = content.replace(
        "import { ChevronDown, Trash2 } from 'lucide-react'",
        "import { ChevronDown, Trash2 } from 'lucide-react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';"
    )

# Fix room-chip text color
content = re.sub(
    r"color:\s*\$\{G\.meadowDeep\};",
    r"color: ;",
    content
)

# Fix chip-del color
content = re.sub(
    r"color:\s*\$\{G\.meadow\};\s*cursor:\s*pointer;",
    r"color: ; cursor: pointer;",
    content
)

# Fix assign-trigger color and border
content = re.sub(
    r"color:\s*\$\{G\.meadowDeep\};\s*border:\s*1px dashed \$\{G\.meadow\};",
    r"color: ; border: 1px dashed ;",
    content
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected text color fixes into RoomsPage.jsx")
