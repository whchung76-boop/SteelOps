import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    with open('../frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        if 'specs?.' in line or 'p.specs' in line or 'selectedProject?.specs' in line or 'selectedProject.specs' in line:
            print(f"L{idx}: {line.strip()}")

if __name__ == '__main__':
    main()
