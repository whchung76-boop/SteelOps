import os
import datetime
from email.utils import parsedate_to_datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

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
            
            email_list.append({
                "message_id": msg['id'],
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "attachment_name": attachment_name,
                "received_at": received_at
            })
            
        return email_list, next_page_token
    except Exception as e:
        print(f"[ERROR] Error occurred while retrieving Gmail messages: {e}")
        if hasattr(e, "auth_url"):
            raise e
        return [], None
