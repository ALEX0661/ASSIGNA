import os
import re

directories = ['packages/frontend/src/pages', 'packages/frontend/src/components']

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()

    lines = original.split('\n')
    for i in range(len(lines)):
        line = lines[i]
        
        # Only process lines with 'color:' or 'color='
        if 'color' not in line:
            continue
            
        # We want to replace G.meadowDeep, G.meadowMid, G.meadow if they appear
        # strictly AFTER 'color:' or 'color=' and BEFORE the next ',' or '}' or ';'
        
        # We can split the line into chunks by 'color'
        # e.g. "background: G.meadow, color: isMine ? G.meadow : G.ink"
        # We only want to replace inside the value part of color.
        
        # Since these files are mostly JSX, color: G.meadow or color={G.meadow} or color: isMine ? G.meadow : G.ink
        # Let's find the position of "color:" or "color={"
        
        # A simple hack: just find 'color', then find the next ',' or '}' or ';'.
        # Replace G.meadow inside that substring!
        
        # Find all occurrences of color properties
        def replacer(match):
            prop = match.group(1) # 'color:' or 'color={' or 'color='
            val = match.group(2) # the value part until , or } or ;
            
            # Replace G.meadow variants inside 'val'
            # Must replace longer names first!
            val = re.sub(r'G\.meadowDeep(?!\w)', "'var(--meadow-text)'", val)
            val = re.sub(r'\$\{G\.meadowDeep\}(?!\w)', "var(--meadow-text)", val)
            
            val = re.sub(r'G\.meadowMid(?!\w)', "'var(--meadow-text-hover)'", val)
            val = re.sub(r'\$\{G\.meadowMid\}(?!\w)', "var(--meadow-text-hover)", val)
            
            val = re.sub(r'G\.meadow(?!\w)', "'var(--meadow-text-hover)'", val)
            val = re.sub(r'\$\{G\.meadow\}(?!\w)', "var(--meadow-text-hover)", val)
            
            # Also fix sc.from and sc.to in SchedulerPage if they appear as color
            val = re.sub(r'sc\.from(?!\w)', "'var(--meadow-text)'", val)
            val = re.sub(r'sc\.to(?!\w)', "'var(--meadow-text-hover)'", val)
            
            return prop + val
            
        new_line = re.sub(r'(color\s*[:=]\s*\{?)([^,;\}]+)', replacer, line)
        lines[i] = new_line

    content = '\n'.join(lines)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for d in directories:
    for root, dirs, files in os.walk(d):
        for file in files:
            if file.endswith('.jsx'):
                process_file(os.path.join(root, file))

print("Done safe replace!")
