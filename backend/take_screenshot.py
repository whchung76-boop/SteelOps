import os
import time
from playwright.sync_api import sync_playwright

def run():
    artifact_dir = r"C:\Users\Owner\.gemini\antigravity-ide\brain\d26879d1-3b90-4377-8f0e-a7f2c38b5577"
    if not os.path.exists(artifact_dir):
        os.makedirs(artifact_dir)
        
    inquiry_list_path = os.path.join(artifact_dir, "inquiry_list.png")
    project_list_path = os.path.join(artifact_dir, "project_list.png")
    project_details_path = os.path.join(artifact_dir, "project_details.png")
    
    print("Launching Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a page with 1920x1080 viewport
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        
        print("Navigating to http://localhost:3000/...")
        page.goto("http://localhost:3000/", timeout=60000)
        
        # 1. Wait for default Inquiry page to load and retrieve data
        print("Waiting for Inquiry list to load data...")
        time.sleep(5)  # Wait for API fetch to populate the list
        
        print(f"Taking screenshot of inquiry list to {inquiry_list_path}...")
        page.screenshot(path=inquiry_list_path)
        
        # 2. Go to Project DB Tab
        print("Clicking '프로젝트DB' tab...")
        project_db_tab = page.locator("button:has-text('프로젝트DB')").first
        project_db_tab.click()
        
        print("Waiting for Project list to load...")
        time.sleep(3)  # Wait for project API fetch
        
        print(f"Taking screenshot of project list to {project_list_path}...")
        page.screenshot(path=project_list_path)
        
        # 3. Click the target project row
        print("Clicking project row '현대제철 2열연공장 마킹머신'...")
        project_row = page.locator("text=현대제철 2열연공장 마킹머신").first
        project_row.click()
        
        print("Waiting for slide-in panel to animate...")
        time.sleep(2)
        
        # 4. Click Edit Mode button
        print("Clicking '수정 모드 전환' button...")
        edit_mode_btn = page.locator("button:has-text('수정 모드 전환')").first
        edit_mode_btn.click()
        
        print("Waiting for editing fields to display...")
        time.sleep(2)
        
        print(f"Taking screenshot of project details (edit mode) to {project_details_path}...")
        page.screenshot(path=project_details_path)
        
        print("Screenshots taken successfully!")
        browser.close()

if __name__ == "__main__":
    run()
