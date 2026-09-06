import os

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {",
    "export default function SpecializationModal({ specializations, onSave, onClose, isSaving }) {\n  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'\n"
)

# Fix Nav items
content = content.replace(
    "color: active ? 'var(--meadow)' : 'var(--muted)',",
    "color: active ? (isDark ? 'var(--mint)' : 'var(--meadow)') : 'var(--muted)',"
)

# Fix "61 assigned" badge
content = content.replace(
    "background: 'var(--meadow-soft)', color: 'var(--meadow-deep)'",
    "background: 'var(--meadow-soft)', color: isDark ? 'var(--mint)' : 'var(--meadow-deep)'"
)
content = content.replace(
    "background: 'var(--meadow-soft)', color: 'var(--meadow)'",
    "background: 'var(--meadow-soft)', color: isDark ? 'var(--mint)' : 'var(--meadow)'"
)

# Fix breakdown sorting text
content = content.replace(
    "color: sortBy === o.key ? 'var(--meadow)' : 'var(--muted)', border: sortBy === o.key ? '1px solid var(--meadow-border)' : '1px solid transparent'",
    "color: sortBy === o.key ? (isDark ? 'var(--mint)' : 'var(--meadow)') : 'var(--muted)', border: sortBy === o.key ? '1px solid var(--meadow-border)' : '1px solid transparent'"
)

# Fix bottom status bar
content = content.replace(
    "color: 'var(--meadow)'",
    "color: isDark ? 'var(--mint)' : 'var(--meadow)'"
)

with open('packages/frontend/src/components/FacultyDetail/SpecializationModal.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("SpecializationModal updated with isDark logic")
