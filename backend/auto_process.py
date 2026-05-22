import os
import time
import json
import requests
from send_sample_email import send_email
import take_screenshot

def check_token_scopes():
    token_path = "token.json"
    if not os.path.exists(token_path):
        return False
    try:
        with open(token_path, "r") as f:
            data = json.load(f)
        scopes = data.get("scopes", [])
        required = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send"
        ]
        # Check if all required scopes are in the token
        has_all = all(r in scopes for r in required)
        return has_all
    except Exception as e:
        print(f"Error checking token: {e}")
        return False

def main():
    print("====================================================")
    print("SteelOps Auto Process Daemon Started!")
    print("Waiting for user to authorize the new Google OAuth scopes...")
    print("====================================================")
    
    # 1. Wait for valid token.json with sending scopes
    check_interval = 2
    timeout = 300 # 5 minutes
    elapsed = 0
    
    while elapsed < timeout:
        if check_token_scopes():
            print("\n[SUCCESS] OAuth Token with 'gmail.send' and 'gmail.readonly' detected!")
            break
        time.sleep(check_interval)
        elapsed += check_interval
        if elapsed % 20 == 0:
            print(f"Still waiting for authorization ({elapsed}/{timeout}s)...")
    else:
        print("\n[TIMEOUT] Authorization was not completed within 5 minutes. Exiting.")
        return

    # Let token refresh/settle if needed
    time.sleep(2)
    
    # 2. Send the email with the Hyundai Steel sample excel attachment
    print("\n[STEP 1] Sending the Hyundai Steel sample email...")
    sent = send_email()
    if not sent:
        print("[ERROR] Failed to send the email. Please check credentials/scopes.")
        return
        
    # Wait for the email to be processed/delivered by Google
    print("\n[STEP 2] Waiting 8 seconds for the email to land in the inbox...")
    time.sleep(8)
    
    # 3. Trigger Gmail manual sync on backend
    print("\n[STEP 3] Triggering Gmail Manual Sync via API...")
    try:
        sync_res = requests.post("http://localhost:8000/api/gmail/sync")
        if sync_res.status_code == 200:
            sync_data = sync_res.json()
            intakes = sync_data.get("intakes", [])
            print(f"[SUCCESS] Synced successfully! Total intakes found in DB: {len(intakes)}")
        else:
            print(f"[ERROR] Sync API returned status code {sync_res.status_code}: {sync_res.text}")
            return
    except Exception as e:
        print(f"[ERROR] Failed to connect to Sync API: {e}")
        return
        
    # 4. Find the newly imported intake
    print("\n[STEP 4] Locating the newly imported Gmail intake...")
    try:
        intake_res = requests.get("http://localhost:8000/api/gmail/intakes")
        if intake_res.status_code == 200:
            intakes = intake_res.json().get("intakes", [])
        else:
            print(f"[ERROR] Failed to fetch intakes: {intake_res.text}")
            return
    except Exception as e:
        print(f"[ERROR] Failed to connect to Intakes API: {e}")
        return
        
    target_intake = None
    # Look for the most recent intake with the subject/attachment name we sent
    for intake in intakes:
        if (intake.get("subject") == "견적서 현대제철 샘플 엑셀파일" or 
            intake.get("attachment_name") == "현대제철 샘플 엑셀파일.xlsx"):
            target_intake = intake
            break
            
    if not target_intake:
        print("[ERROR] Could not find the newly sent email in the synced intakes.")
        return
        
    intake_id = target_intake["id"]
    print(f"[SUCCESS] Found target intake. ID: {intake_id} | Subject: {target_intake['subject']} | Status: {target_intake['ai_status']}")
    
    # 5. Convert the intake to project card
    print(f"\n[STEP 5] Converting intake {intake_id} to project card...")
    try:
        convert_res = requests.post(f"http://localhost:8000/api/gmail/intakes/{intake_id}/convert")
        if convert_res.status_code == 200:
            proj = convert_res.json()
            print(f"[SUCCESS] Converted project successfully!")
            print(f"Project ID: {proj.get('id')}")
            print(f"Title: {proj.get('title')}")
            print(f"Customer: {proj.get('customer', {}).get('name')}")
            print(f"Specs: Speed={proj.get('specs', {}).get('speed')}, PLC={proj.get('specs', {}).get('plc_type')}, Env={proj.get('specs', {}).get('environment')}")
        else:
            print(f"[ERROR] Convert API returned status code {convert_res.status_code}: {convert_res.text}")
            return
    except Exception as e:
        print(f"[ERROR] Failed to connect to Convert API: {e}")
        return
        
    # Wait a bit before taking screenshots
    time.sleep(3)
    
    # 6. Take screenshots of the updated UI
    print("\n[STEP 6] Capturing screenshots of the updated UI using Playwright...")
    try:
        take_screenshot.run()
        print("[SUCCESS] All screenshots captured successfully!")
    except Exception as e:
        print(f"[ERROR] Failed to capture screenshots: {e}")

if __name__ == "__main__":
    main()
