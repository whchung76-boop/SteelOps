import os
import datetime
from email.utils import parsedate_to_datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]

class GmailAuthRequiredException(Exception):
    """Exception raised when Gmail authorization is required."""
    def __init__(self, auth_url):
        self.auth_url = auth_url
        super().__init__("Gmail authorization is required. Please visit the authentication URL.")

def get_gmail_service():
    """
    Initializes and returns a Gmail API service client.
    Supports either environment variables (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)
    or standard local OAuth files (token.json, credentials.json).
    """
    creds = None
    
    # 1. Try to load from environment variables (No browser pop-up needed)
    client_id = os.getenv("GMAIL_CLIENT_ID")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET")
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN")
    
    if client_id and client_secret and refresh_token:
        try:
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=client_id,
                client_secret=client_secret,
                scopes=SCOPES
            )
            # Force refresh to verify credentials and fetch active access token
            creds.refresh(Request())
            print("[INFO] Gmail API authenticated successfully using environment variables.")
        except Exception as e:
            print(f"[WARNING] Failed to authenticate using environment variables: {e}")
            creds = None

    # 2. Fall back to standard credentials.json / token.json
    if not creds:
        token_path = os.getenv("GMAIL_TOKEN_JSON_PATH", "token.json")
        credentials_path = os.getenv("GMAIL_CREDENTIALS_JSON_PATH", "credentials.json")
        
        if os.path.exists(token_path):
            try:
                creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            except Exception as e:
                print(f"[WARNING] Failed to load {token_path}: {e}")
                creds = None
                
        # If no valid credentials, run Web authorization flow
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                except Exception as e:
                    print(f"[WARNING] Failed to refresh token: {e}")
                    creds = None
                    
            if not creds:
                if not os.path.exists(credentials_path):
                    raise FileNotFoundError(
                        f"OAuth credentials file not found at '{credentials_path}'. "
                        "Please configure GMAIL_* environment variables or download 'credentials.json' from GCP."
                    )
                # Instead of blocking via run_local_server, raise GmailAuthRequiredException
                from google_auth_oauthlib.flow import Flow
                flow = Flow.from_client_secrets_file(
                    credentials_path,
                    scopes=SCOPES,
                    redirect_uri="http://localhost:8000/api/gmail/oauth2callback"
                )
                # First call to generate flow.code_verifier
                flow.authorization_url(prompt='consent', access_type='offline')
                # Second call to embed flow.code_verifier as the state param
                auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline', state=flow.code_verifier)
                raise GmailAuthRequiredException(auth_url)

    return build('gmail', 'v1', credentials=creds)

def get_attachment_content(message_id, filename, service=None):
    """
    Downloads the attachment from Gmail and extracts its content as a text string.
    Supports Excel (.xlsx, .xls) and PDF (.pdf) formats.
    """
    import base64
    import io
    import pandas as pd
    import PyPDF2
    
    if not service:
        service = get_gmail_service()
        
    try:
        # 1. Fetch message details to find the attachment_id
        message = service.users().messages().get(userId='me', id=message_id).execute()
        payload = message.get('payload', {})
        
        def find_attachment_id(parts_list, target_filename):
            for part in parts_list:
                if part.get('filename') == target_filename:
                    return part.get('body', {}).get('attachmentId')
                if part.get('parts'):
                    found_id = find_attachment_id(part.get('parts'), target_filename)
                    if found_id:
                        return found_id
            return None
            
        parts = payload.get('parts', [])
        if not parts and 'body' in payload:
            parts = [payload]
            
        attachment_id = find_attachment_id(parts, filename)
        if not attachment_id:
            print(f"[WARNING] Attachment '{filename}' not found in message {message_id}")
            return ""
            
        # 2. Download the attachment bytes
        attachment = service.users().messages().attachments().get(
            userId='me', messageId=message_id, id=attachment_id
        ).execute()
        
        data = attachment.get('data')
        if not data:
            return ""
            
        file_bytes = base64.urlsafe_b64decode(data.encode('UTF-8'))
        
        # 3. Parse content based on file extension
        ext = os.path.splitext(filename)[1].lower()
        text_content = ""
        
        if ext in ['.xlsx', '.xls']:
            excel_file = io.BytesIO(file_bytes)
            xls = pd.ExcelFile(excel_file)
            sheets_text = []
            
            # 템플릿 타입 탐지
            filename_lower = filename.lower()
            sheet_names_lower = [s.lower() for s in xls.sheet_names]
            
            is_posco = (
                "posco" in filename_lower or 
                "포스코" in filename_lower or 
                "광양" in filename_lower or 
                "포항" in filename_lower or 
                "제경비" in sheet_names_lower
            )
            is_hyundai = (
                "hyundai" in filename_lower or 
                "현대제철" in filename_lower or 
                "당진" in filename_lower
            )
            
            if is_posco:
                template_type = "POSCO"
                template_guide = (
                    "=== TEMPLATE TYPE: POSCO ===\n"
                    "[구조 및 매핑 가이드]\n"
                    "- '갑지' 시트: 견적의 기본 정보(Ref. No., Date, 공급자 등)와 총 공급가액을 표기함.\n"
                    "- '을지' 시트: 주요 자재비 및 직접 노무비 단가/금액 상세 내역을 표기함.\n"
                    "- '제경비' 시트: 간접비(경비, 산재보험료, 고용보험료 등) 내역이 포함됨.\n"
                    "=============================\n\n"
                )
            elif is_hyundai:
                template_type = "현대제철"
                template_guide = (
                    "=== TEMPLATE TYPE: 현대제철 ===\n"
                    "[구조 및 매핑 가이드]\n"
                    "- '갑지' 시트: 회사명(현대제철), 담당자(이영철 책임매니저 등), 그리고 총 견적 금액 합계와 대분류 항목(1. 자재비, 2. 노무비, 3. 경비, 4. 일반관리비, 5. 기업이윤)을 표기함.\n"
                    "- '을지' 시트: 자재비 및 노무비의 품명, 규격, 수량, 단가, 공급가액 등의 세부 구성 내역을 표기함.\n"
                    "=============================\n\n"
                )
            else:
                template_type = "일반(Generic)"
                template_guide = "=== TEMPLATE TYPE: 일반(Generic) ===\n\n"
                
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                df_str = df.to_string(index=False, header=True)
                sheets_text.append(f"--- Sheet: {sheet_name} ---\n{df_str}")
                
            text_content = template_guide + "\n\n".join(sheets_text)
            
        elif ext == '.pdf':
            pdf_file = io.BytesIO(file_bytes)
            reader = PyPDF2.PdfReader(pdf_file)
            pages_text = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    pages_text.append(f"--- Page {i+1} ---\n{page_text}")
            text_content = "\n\n".join(pages_text)
        else:
            text_content = file_bytes.decode('utf-8', errors='ignore')
            
        return text_content
        
    except Exception as e:
        print(f"[ERROR] Failed to parse attachment '{filename}' from msg {message_id}: {e}")
        return f"Error parsing attachment {filename}: {str(e)}"

def fetch_gmail_emails(max_results=10, page_token=None):
    """
    Fetches the latest email messages matching the query filter from the user's Gmail inbox.
    Returns a list of structured dictionaries and the next page token.
    """
    # Propagate GmailAuthRequiredException to main.py
    service = get_gmail_service()
    
    # Search for emails with subject containing "[견적서]" or "[참조]"
    query = ""
    
    try:
        results = service.users().messages().list(userId='me', q=query, maxResults=max_results, pageToken=page_token).execute()
        messages = results.get('messages', [])
        next_page_token = results.get('nextPageToken', None)
        
        email_list = []
        for msg in messages:
            msg_detail = service.users().messages().get(userId='me', id=msg['id']).execute()
            
            payload = msg_detail.get('payload', {})
            headers = payload.get('headers', [])
            
            subject = "제목 없음"
            sender = "알 수 없는 발신자"
            date_str = None
            
            for header in headers:
                name_lower = header.get('name', '').lower()
                if name_lower == 'subject':
                    subject = header.get('value', '제목 없음')
                elif name_lower == 'from':
                    sender = header.get('value', '알 수 없는 발신자')
                elif name_lower == 'date':
                    date_str = header.get('value')
            
            snippet = msg_detail.get('snippet', '')
            
            # Parse received_at date to UTC timezone-naive datetime
            received_at = datetime.datetime.utcnow()
            if date_str:
                try:
                    dt = parsedate_to_datetime(date_str)
                    if dt.tzinfo:
                        dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
                    received_at = dt
                except Exception as ex:
                    print(f"[WARNING] Failed to parse email date '{date_str}': {ex}")
            
            # Find any attachment name
            attachment_name = None
            parts = payload.get('parts', [])
            if not parts and 'body' in payload:
                parts = [payload]
                
            def find_attachment_filename(parts_list):
                for part in parts_list:
                    filename = part.get('filename')
                    body = part.get('body', {})
                    attachment_id = body.get('attachmentId')
                    
                    if filename and attachment_id:
                        return filename
                    if part.get('parts'):
                        found = find_attachment_filename(part.get('parts'))
                        if found:
                            return found
                return None
                
            attachment_name = find_attachment_filename(parts)
            attachment_content = None
            if attachment_name:
                try:
                    attachment_content = get_attachment_content(msg['id'], attachment_name, service)
                except Exception as ex:
                    print(f"[WARNING] Failed to fetch/parse attachment '{attachment_name}' for msg {msg['id']}: {ex}")
            
            email_list.append({
                "message_id": msg['id'],
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "attachment_name": attachment_name,
                "attachment_content": attachment_content,
                "received_at": received_at
            })
            
        return email_list, next_page_token
    except Exception as e:
        print(f"[ERROR] Error occurred while retrieving Gmail messages: {e}")
        if hasattr(e, "auth_url"):
            raise e
        return [], None
