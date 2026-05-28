import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    with open('../frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        if idx >= 1417 and idx <= 1697:
            if 'specs' in line or 'plc' in line or 'comm' in line or 'speed' in line or 'environment' in line:
                print(f"L{idx}: {line.strip()}")

if __name__ == '__main__':
    main()
