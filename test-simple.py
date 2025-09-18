#!/usr/bin/env python3

import subprocess
import time
import json
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def test_treeview():
    print("🔍 Testing TreeView implementation...")

    # Test if server is running
    try:
        response = requests.get("http://localhost:3737", timeout=5)
        print(f"✅ Server is running (status: {response.status_code})")
    except Exception as e:
        print(f"❌ Server not accessible: {e}")
        return False

    # Set up Chrome options for headless mode
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")

    driver = None
    try:
        driver = webdriver.Chrome(options=chrome_options)
        print("🌐 Browser started")

        # Navigate to the app
        driver.get("http://localhost:3737")
        print("📍 Navigated to Archon")

        # Wait for app to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # Navigate to projects
        driver.get("http://localhost:3737/projects")
        time.sleep(2)

        # Navigate to the specific project
        project_url = "http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376"
        driver.get(project_url)
        print("📍 Navigated to project")

        # Wait for page to load
        time.sleep(3)

        # Look for Tree button
        try:
            tree_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Tree')]")
            if tree_buttons:
                print(f"✅ Found Tree button: {len(tree_buttons)}")

                # Click the Tree button
                tree_buttons[0].click()
                print("✅ Clicked Tree button")
                time.sleep(2)

                # Check if TreeView is displayed
                tree_elements = driver.find_elements(By.XPATH, "//*[contains(@class, 'tree') or contains(text(), 'Expand All') or contains(text(), 'Collapse All')]")
                if tree_elements:
                    print(f"✅ TreeView displayed successfully ({len(tree_elements)} elements)")

                    # Test search functionality
                    search_inputs = driver.find_elements(By.XPATH, "//input[contains(@placeholder, 'Search')]")
                    if search_inputs:
                        print("✅ Search input found")
                        search_inputs[0].send_keys("test")
                        time.sleep(1)
                        search_inputs[0].clear()

                    # Test filters
                    selects = driver.find_elements(By.TAG_NAME, "select")
                    print(f"📊 Found {len(selects)} filter dropdowns")

                    # Test expand/collapse buttons
                    expand_buttons = driver.find_elements(By.XPATH, "//*[name()='svg' and contains(@class, 'w-4 h-4')]")
                    print(f"📊 Found {len(expand_buttons)} interactive elements")

                    return True
                else:
                    print("❌ TreeView not displayed after clicking Tree button")
                    return False
            else:
                print("❌ Tree button not found")

                # Debug: Check what buttons are available
                all_buttons = driver.find_elements(By.TAG_NAME, "button")
                button_texts = [btn.text.strip() for btn in all_buttons if btn.text.strip()]
                print(f"Available buttons: {button_texts}")

                return False

        except Exception as e:
            print(f"❌ Error testing Tree button: {e}")
            return False

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

    finally:
        if driver:
            driver.quit()
            print("🔚 Browser closed")

if __name__ == "__main__":
    success = test_treeview()
    if success:
        print("🎉 TreeView test PASSED!")
    else:
        print("💥 TreeView test FAILED!")

        # Additional debugging
        print("\n🔧 Debugging info:")
        try:
            result = subprocess.run(['curl', '-s', 'http://localhost:3737'],
                                  capture_output=True, text=True, timeout=5)
            if "Archon" in result.stdout:
                print("✅ Server responding with Archon content")
            else:
                print("❌ Server not responding correctly")
        except Exception as e:
            print(f"❌ Could not reach server: {e}")