import os

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "Thursday:  { bg:'#FCE7F3', color:'#9D174D', border:'#FBCFE8' },",
    "Thursday:  { bg:'rgba(219, 39, 119, 0.1)', color:'#F472B6', border:'rgba(219, 39, 119, 0.25)' },"
)

content = content.replace(
    "Tuesday:   { bg:'rgba(59, 130, 246, 0.1)', color:'#60A5FA', border:'#BFDBFE' },",
    "Tuesday:   { bg:'rgba(59, 130, 246, 0.1)', color:'#60A5FA', border:'rgba(59, 130, 246, 0.25)' },"
)

with open('packages/frontend/src/components/FacultyEventsTable.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DAY_COLORS updated")
