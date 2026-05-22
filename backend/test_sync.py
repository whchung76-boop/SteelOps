import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure stdout to use UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import gmail_service

def test_sync():
    try:
        print("Calling fetch_gmail_emails...")
        emails, next_page = gmail_service.fetch_gmail_emails(max_results=5)
        print(f"Success! Fetched {len(emails)} emails.")
        for email in emails:
            print("-" * 50)
            print(f"ID: {email['message_id']}")
            print(f"Subject: {email['subject']}")
            print(f"Attachment Name: {email['attachment_name']}")
            print(f"Attachment Content Length: {len(email['attachment_content']) if email['attachment_content'] else 0}")
    except Exception as e:
        print(f"Error during fetch: {e}")
        if hasattr(e, 'auth_url'):
            print(f"Auth URL required: {e.auth_url}")

if __name__ == "__main__":
    test_sync()
