import os

filepath = 'packages/frontend/src/pages/admin/SettingsPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """        </div>

                </div>
        </div>
      </div>

      {/* Floating Toast Notifications */}"""

replacement = """        </div>
      </div>

      {/* Floating Toast Notifications */}"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed extra closing tags")
else:
    print("Target not found!")
