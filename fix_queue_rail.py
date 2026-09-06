import os

with open('packages/frontend/src/pages/coordinator/CoordSchedulerPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "function QueueRail({ queue, myProgram, currentProgram }) {\n  if (!queue || queue.length === 0) return null\n",
    "function QueueRail({ queue, myProgram, currentProgram }) {\n  const isDark = document.documentElement.getAttribute('data-mode') === 'dark'\n  if (!queue || queue.length === 0) return null\n"
)

content = content.replace(
    "color: (status === 'active' || isMine) ? G.meadowDeep : meta.color",
    "color: (status === 'active' || isMine) ? (isDark ? G.meadow : G.meadowDeep) : meta.color"
)

content = content.replace(
    "border: isMine ? 2.5px solid  : 1.5px solid ,",
    "border: isMine ? 2.5px solid  : 1.5px solid ,"
)

with open('packages/frontend/src/pages/coordinator/CoordSchedulerPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("QueueRail updated")
