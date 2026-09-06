import os

with open('packages/frontend/src/components/FacultyDetail/ScheduleSection.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("'#FFFFFF'", "'var(--surface)'")

with open('packages/frontend/src/components/FacultyDetail/ScheduleSection.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ScheduleSection updated")
