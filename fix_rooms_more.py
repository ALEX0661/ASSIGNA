import os

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# .cp-toast.info
content = content.replace(
    "color:;border:1px solid ",
    "color:;border:1px solid "
)

# .modal-room-card
content = content.replace(
    "background: ; color: ; transition: all 0.2s; flex-shrink: 0;",
    "background: ; color: ; transition: all 0.2s; flex-shrink: 0;"
)
content = content.replace(
    "border-color: ; background: ; color: ; box-shadow:",
    "border-color: ; background: ; color: ; box-shadow:"
)

# Status Filter
content = content.replace(
    "color: statusFilter === status ? G.meadowDeep : G.muted",
    "color: statusFilter === status ? (isDark ? 'var(--mint)' : G.meadowDeep) : G.muted"
)

# Bulk Assign Rooms button
content = content.replace(
    "color: G.meadowDeep, border: 'none', fontSize: 12",
    "color: isDark ? 'var(--mint)' : G.meadowDeep, border: 'none', fontSize: 12"
)

with open('packages/frontend/src/pages/admin/RoomsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed the remaining G.meadowDeep text colors")
