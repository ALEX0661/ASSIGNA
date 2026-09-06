import os

filepath = 'packages/frontend/src/pages/admin/SchedulerPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('stroke={G.meadowDeep}', 'stroke="var(--meadow-text)"')
content = content.replace('stroke={G.meadow}', 'stroke="var(--meadow-text)"')
content = content.replace('background:G.meadowDeep', 'background:"var(--meadow-text)"')
content = content.replace('border: idle ? 2px solid  : phaseActive ? 2.5px solid ', 'border: idle ? 2px solid  : phaseActive ? 2.5px solid var(--meadow-text)')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed SchedulerPage.jsx")
