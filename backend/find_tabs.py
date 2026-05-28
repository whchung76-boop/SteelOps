def main():
    with open('../frontend/src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("=== All useState calls ===")
    for line_num, line in enumerate(content.splitlines(), 1):
        if 'useState(' in line:
            print(f"L{line_num}: {line.strip()}")

if __name__ == '__main__':
    main()
