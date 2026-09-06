import os

filepath = 'packages/frontend/src/pages/LoginPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the bad reset rule
content = content.replace(
    '.login-root button:not(.login-btn):hover { background: none; }',
    '/* global hover reset removed as index.css already guards with :not([class]) */'
)

# And while we are here, let's restore the original specificity for login-btn:disabled, just to keep the CSS clean
content = content.replace(
    '.login-root .login-btn:disabled { background: linear-gradient(135deg, var(--meadow) 0%, var(--meadow-deep) 100%); opacity: .6; cursor: default; box-shadow: none; color: #fff; }',
    '.login-btn:disabled { opacity: .6; cursor: default; box-shadow: none; }'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed bad hover reset and restored original login-btn disabled style")
