import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert isDark if not exists
if 'const isDark =' not in content:
    content = content.replace(
        "import { ChevronDown, Trash2 } from 'lucide-react'",
        "import { ChevronDown, Trash2 } from 'lucide-react'\n\nconst isDark = document.documentElement.getAttribute('data-mode') === 'dark';"
    )

# Fix .room-chip
content = content.replace(
    "font-size: 12.5px; font-weight: 700; color: ${G.meadowDeep};",
    "font-size: 12.5px; font-weight: 700; color: ${isDark ? 'var(--mint)' : G.meadowDeep};"
)

# Fix .chip-del
content = content.replace(
    "border-radius: 5px; color: ${G.meadow}; cursor: pointer; transition: all 0.1s;",
    "border-radius: 5px; color: ${isDark ? 'var(--mint)' : G.meadow}; cursor: pointer; transition: all 0.1s;"
)

# Fix .assign-trigger
content = content.replace(
    "background: var(--surface); color: ${G.meadowDeep}; border: 1px dashed ${G.meadow};",
    "background: var(--surface); color: ${isDark ? 'var(--mint)' : G.meadowDeep}; border: 1px dashed ${isDark ? 'var(--mint)' : G.meadow};"
)

# Fix .assigned-pill
content = content.replace(
    "background: ${G.meadowSoft}; color: ${G.meadowDeep}; border: 1px solid ${G.meadowBorder};",
    "background: ${G.meadowSoft}; color: ${isDark ? 'var(--mint)' : G.meadowDeep}; border: 1px solid ${G.meadowBorder};"
)

# Fix units Lecture color
content = content.replace(
    "color: G.meadowDeep, fontWeight: 700",
    "color: isDark ? 'var(--mint)' : G.meadowDeep, fontWeight: 700"
)

# Fix "Clear all filters" button color
content = content.replace(
    "color: G.meadow, background: 'none'",
    "color: isDark ? 'var(--mint)' : G.meadow, background: 'none'"
)

# Fix edit assigned rooms icon button color
content = content.replace(
    "cursor: 'pointer', color: G.meadow, display: 'flex'",
    "cursor: 'pointer', color: isDark ? 'var(--mint)' : G.meadow, display: 'flex'"
)

# Fix program filter active text color
content = content.replace(
    "color: progFilter === p ? G.meadowDeep : G.muted,",
    "color: progFilter === p ? (isDark ? 'var(--mint)' : G.meadowDeep) : G.muted,"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected text color fixes safely into RoomsPage.jsx using exact string matches")
