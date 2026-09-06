import os

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']",
    "const isDark = document.documentElement.getAttribute('data-mode') === 'dark'\nconst DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']"
)

content = content.replace(
    "sortKey===col.key?'var(--meadow)':'var(--muted)'",
    "sortKey===col.key? (isDark ? 'var(--mint)' : 'var(--meadow)') : 'var(--muted)'"
)

content = content.replace(
    "color={r==='Lab'?'#A78BFA':r==='TBA'?'#F59E0B':'var(--meadow)'}",
    "color={r==='Lab'?'#A78BFA':r==='TBA'?'#F59E0B':(isDark ? 'var(--mint)' : 'var(--meadow)')}"
)

content = content.replace(
    "color: 'var(--meadow)', background:'var(--meadow-soft)', padding:'2px 7px', borderRadius:5, border:'1px solid var(--meadow-border)'",
    "color: isDark ? 'var(--mint)' : 'var(--meadow)', background:'var(--meadow-soft)', padding:'2px 7px', borderRadius:5, border:'1px solid var(--meadow-border)'"
)

content = content.replace(
    "color: 'var(--meadow)', fontSize:11.5, fontWeight:700, border:'1px solid var(--meadow-border)'",
    "color: isDark ? 'var(--mint)' : 'var(--meadow)', fontSize:11.5, fontWeight:700, border:'1px solid var(--meadow-border)'"
)

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("FacultyEventsTable updated with isDark logic")
