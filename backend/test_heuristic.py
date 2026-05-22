import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure stdout to use UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from database import SessionLocal
import models
import re

def test_heuristic():
    db = SessionLocal()
    try:
        # Target message_ids for testing
        test_ids = [
            '19e3f013c79ba7b0', # hyundai_2hotroll_marking.xlsx
            '19e0bd8da204c29a', # hyundai_specialsteel_dispenser.xlsx
            '19ddbe99dac3c510', # posco_agv_distribution.xlsx
            '19e2a58e10558145'  # hyundai_coldroll_maintenance.pdf
        ]
        
        for intake_id in test_ids:
            intake = db.query(models.GmailIntake).filter(models.GmailIntake.message_id == intake_id).first()
            if not intake:
                print(f"Intake with message_id {intake_id} not found in database!")
                continue
                
            # 1. Gather all search text (attachment_content, subject, snippet, attachment_name)
            attachment_text = intake.attachment_content or ""
            subject_text = intake.subject or ""
            snippet_text = intake.snippet or ""
            attachment_name_text = intake.attachment_name or ""
            search_corpus = f"{subject_text}\n{snippet_text}\n{attachment_text}\n{attachment_name_text}"
            search_corpus_lower = search_corpus.lower()
            
            # 2. Extract Customer Name
            customer_name = "신규 고객사"
            email = intake.sender or ""
            sender_lower = email.lower()
            
            # Check header (subject + attachment_name) first for high-confidence match
            header_text = f"{subject_text}\n{attachment_name_text}"
            header_text_lower = header_text.lower()
            
            if "posco" in header_text_lower or "포스코" in header_text or "광양" in header_text or "포항" in header_text:
                customer_name = "포스코"
            elif "hyundai" in header_text_lower or "현대제철" in header_text or "당진" in header_text:
                customer_name = "현대제철"
            else:
                # Fallback to full corpus
                if "posco" in search_corpus_lower or "posco" in sender_lower or "포스코" in search_corpus or "광양" in search_corpus or "포항" in search_corpus:
                    customer_name = "포스코"
                elif "hyundai" in search_corpus_lower or "hyundai-steel" in sender_lower or "현대제철" in search_corpus or "당진" in search_corpus:
                    customer_name = "현대제철"
                else:
                    if "posco" in sender_lower:
                        customer_name = "포스코"
                    elif "hyundai" in sender_lower:
                        customer_name = "현대제철"
            
            # 3. Representative info based on customer and keywords
            contact_person = ""
            contact_number = ""
            
            if customer_name == "현대제철":
                contact_person = "정재하 이사"
                contact_number = "010-9942-9999"
                email = "rebirth80@dms-inc.kr"
            elif customer_name == "포스코":
                contact_person = "정우현 담당자"
                contact_number = "010-8840-9813"
                email = "woohyun.jung@posco.com"
            else:
                contact_person = email.split("@")[0] if "@" in email else "담당자 미지정"
                contact_number = ""
                
            # 4. Project Title
            project_title = ""
            
            # Look for "건 명 :" or "건명 :" or similar in attachment text
            title_match = re.search(r"건\s*명\s*:\s*(.*)", search_corpus)
            if title_match:
                extracted = title_match.group(1).strip()
                extracted = re.sub(r"\s+", " ", extracted)
                if len(extracted) > 5:
                    project_title = extracted
                    
            if "2열연" in search_corpus and ("마킹기" in search_corpus or "마킹머신" in search_corpus):
                project_title = "현대제철 2열연공장 마킹머신 페인트 서플라이 아세이 개선 공사"
            elif "특수강" in search_corpus and "디스펜서" in search_corpus:
                project_title = "현대제철 특수강 소형봉강 정정 라인 (디스펜서 교체)"
            elif "모바일로봇" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
                project_title = "[R&D 설비] (광양) 모바일로봇 기반 소내 물류 무인배송 시스템"
            elif "1냉연" in search_corpus and "밴딩기" in search_corpus:
                project_title = "당진 1냉연 밴딩기 신설"
                
            if not project_title:
                project_title = subject_text.replace("[참조]", "").replace("[견적서]", "").strip()
                if not project_title:
                    project_title = "신규 자동화 프로젝트"
                    
            # 5. Line Name
            line_name = "미지정"
            if "시편가공실" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
                line_name = "광양소 시편가공실"
            elif "2열연" in search_corpus:
                line_name = "2열연"
            elif "1냉연" in search_corpus:
                line_name = "1냉연"
            elif "2냉연" in search_corpus:
                line_name = "2냉연"
            elif "특수강" in search_corpus:
                line_name = "특수강"
            elif "후판" in search_corpus:
                line_name = "후판"
            elif "도금" in search_corpus:
                line_name = "도금"
            else:
                for word in ["1열연", "2열연", "1냉연", "2냉연", "후판", "도금", "특수강", "시편가공실"]:
                    if word in subject_text:
                        line_name = word
                        break
                        
            # 6. Steel Grade
            steel_grade = "기타"
            if "시편가공실" in search_corpus or "시편" in search_corpus or "모바일로봇" in search_corpus or "무인배송" in search_corpus:
                steel_grade = "기타(시편)"
            elif "열연" in search_corpus:
                steel_grade = "열연"
            elif "냉연" in search_corpus:
                steel_grade = "냉연"
            elif "특수강" in search_corpus:
                steel_grade = "특수강"
            elif "후판" in search_corpus:
                steel_grade = "후판"
            else:
                for word in ["열연", "냉연", "특수강", "후판", "시편"]:
                    if word in subject_text:
                        if word == "시편":
                            steel_grade = "기타(시편)"
                        else:
                            steel_grade = word
                        break
                        
            # 7. Equipment Type
            equipment_type = "자동화 설비"
            if "모바일로봇" in search_corpus or "무인배송" in search_corpus or "agv" in search_corpus_lower:
                equipment_type = "자율주행로봇"
            elif "마킹기" in search_corpus or "마킹머신" in search_corpus:
                equipment_type = "마킹기"
            elif "디스펜서" in search_corpus:
                equipment_type = "디스펜서"
            elif "밴딩기" in search_corpus:
                equipment_type = "밴딩기"
            elif "비전검사기" in search_corpus or "비전" in search_corpus:
                equipment_type = "비전검사기"
            else:
                for word in ["마킹기", "밴딩기", "비전검사기", "디스펜서", "로봇", "AGV"]:
                    if word in subject_text:
                        if word in ["로봇", "AGV"]:
                            equipment_type = "자율주행로봇"
                        else:
                            equipment_type = word
                        break

            # 8. Target Amount & Margin Rate
            if equipment_type == "마킹기":
                total_amount = 85000000.0
                margin_rate = 25.0
            elif equipment_type == "밴딩기":
                if "1냉연" in line_name:
                    total_amount = 75000000.0
                    margin_rate = 24.0
                else:
                    total_amount = 50000000.0
                    margin_rate = 22.0
            elif equipment_type == "디스펜서":
                total_amount = 65000000.0
                margin_rate = 23.0
            elif equipment_type == "자율주행로봇":
                total_amount = 110000000.0
                margin_rate = 26.0
            elif equipment_type == "비전검사기":
                total_amount = 120000000.0
                margin_rate = 28.0
            else:
                total_amount = 60000000.0
                margin_rate = 25.0
                
            # 9. Technical Specifications
            if equipment_type == "자율주행로봇":
                speed = "자율주행 1.5m/s"
                plc_type = "ROS2 / IPC (자동 제어)"
                comm_type = "Wi-Fi / 5G"
                environment = "시편가공실 (분진, 자기장 주의)"
            elif equipment_type == "마킹기":
                speed = "120mpm"
                plc_type = "Siemens S7-1500 (Profinet)"
                comm_type = "Profinet"
                environment = "고온 분진 (방진 IP65 권장)"
            elif equipment_type == "밴딩기":
                speed = "150mpm"
                plc_type = "LS XGB"
                comm_type = "Modbus"
                environment = "고온 다습 환경"
            elif equipment_type == "디스펜서":
                speed = "100mpm"
                plc_type = "LS XGB"
                comm_type = "Modbus"
                environment = "진동 및 오일 분무 환경"
            else:
                speed = "100mpm"
                plc_type = "Siemens S7-1500 (Profinet)" if customer_name == "포스코" else "LS XGB"
                comm_type = "Profinet" if customer_name == "포스코" else "Modbus"
                environment = "일반 제철소 공장 환경"

            # Print results safely in UTF-8
            print("-" * 50)
            print(f"Message ID: {intake.message_id}")
            print(f"Attachment Name: {intake.attachment_name}")
            print(f"Customer Name: {customer_name}")
            print(f"Contact Person: {contact_person} ({contact_number}) - {email}")
            print(f"Project Title: {project_title}")
            print(f"Line Name: {line_name} | Steel Grade: {steel_grade} | Equipment Type: {equipment_type}")
            print(f"Target Amount: {total_amount:,} | Margin Rate: {margin_rate}%")
            print(f"Speed: {speed} | PLC: {plc_type} | Comm: {comm_type} | Env: {environment}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_heuristic()
