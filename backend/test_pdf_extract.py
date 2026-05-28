import json
import asyncio
from unittest.mock import MagicMock, patch

# main.py에서 함수 가져오기
from main import upload_spec_file

async def run_test():
    # 1. 가상의 PDF 테이블 데이터 모의(Mock) 설정
    mock_pdf = MagicMock()
    mock_page = MagicMock()
    
    # pdfplumber의 extract_tables() 반환 형태 시뮬레이션
    mock_page.extract_tables.return_value = [
        [
            ["Item No", "품명", "규격", "수량", "단가"],
            ["1", "유압 모터", "7.5kW", "2", "3500000"],
            ["2", "PLC 제어반", "Siemens S7-1500", "1", "7500000"],
            ["3", "센서류", "2D LiDAR", "4", "800000"],
            [None, None, None, None, None]  # 빈 행 (필터링 테스트용)
        ]
    ]
    mock_pdf.pages = [mock_page]

    # 가상의 UploadFile 객체 생성
    class MockUploadFile:
        def __init__(self, filename):
            self.filename = filename
        async def read(self):
            return b"dummy_pdf_bytes"
            
    mock_file = MockUploadFile("sample_specification.pdf")

    # 2. pdfplumber.open 패치 (실제 파일 대신 mock_pdf 반환)
    with patch('main.pdfplumber.open') as mock_open:
        mock_open.return_value.__enter__.return_value = mock_pdf
        
        # 3. main.py의 함수 직접 호출
        result = await upload_spec_file(file=mock_file)
        
        # 4. 추출된 JSON 결과 출력
        print("\n==================================================")
        print("          [로컬 데이터 추출 테스트 결과]          ")
        print("==================================================")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print("==================================================\n")

if __name__ == "__main__":
    asyncio.run(run_test())
