import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from gmail_service import get_gmail_service

def send_email():
    to_email = "whchung76@gmail.com"
    subject = "견적서 현대제철 샘플 엑셀파일"
    body_text = "안녕하세요,\n\n현대제철 샘플 엑셀파일 견적서를 첨부하여 송부드립니다.\n\n감사합니다."
    
    # Path to the source xlsx
    src_file_path = r"C:\Users\Owner\.gemini\antigravity-ide\brain\d26879d1-3b90-4377-8f0e-a7f2c38b5577\scratch\hyundai_2hotroll_marking.xlsx"
    attachment_name = "현대제철 샘플 엑셀파일.xlsx"
    
    if not os.path.exists(src_file_path):
        print(f"[ERROR] Source file not found at: {src_file_path}")
        return False
        
    print(f"Loading credentials and initializing Gmail service...")
    try:
        service = get_gmail_service()
    except Exception as e:
        print(f"[ERROR] Failed to get Gmail service. Authentication might be required with the new scopes: {e}")
        if hasattr(e, "auth_url"):
            print(f"Auth URL: {e.auth_url}")
        return False
        
    print(f"Constructing MIME message...")
    message = MIMEMultipart()
    message['to'] = to_email
    message['subject'] = subject
    
    message.attach(MIMEText(body_text, 'plain', 'utf-8'))
    
    # Read the excel file and attach it
    with open(src_file_path, 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        
        # Correctly encode the filename to prevent header issues
        part.add_header(
            'Content-Disposition',
            'attachment',
            filename=attachment_name
        )
        message.attach(part)
        
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    
    print("Sending message via Gmail API...")
    try:
        sent_msg = service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
        print(f"[SUCCESS] Message sent! ID: {sent_msg['id']}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email via API: {e}")
        return False

if __name__ == "__main__":
    send_email()
