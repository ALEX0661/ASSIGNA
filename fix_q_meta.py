import os

with open('packages/frontend/src/pages/coordinator/CoordSchedulerPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix waiting bg
content = content.replace(
    "waiting:    { bg: '#F1F5F9', color: 'var(--muted2)', dot: '#94A3B8', label: 'Waiting' }",
    "waiting:    { bg: 'var(--hover)', color: 'var(--muted2)', dot: 'var(--border)', label: 'Waiting' }"
)

with open('packages/frontend/src/pages/coordinator/CoordSchedulerPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Q_META updated")
