import json
with open('src/components/InteractiveParticles.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
if content.startswith('"'):
    try:
        content = json.loads(content + '"') if not content.endswith('"') else json.loads(content)
    except:
        content = content.replace('\\n', '\n').strip('"')
with open('src/components/InteractiveParticles.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
