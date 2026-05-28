def main():
    with open('../frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.splitlines()
    for idx, line in enumerate(lines, 1):
        if 'handleGmailConvert' in line:
            print(f"L{idx}: {line.strip()}")

if __name__ == '__main__':
    main()
