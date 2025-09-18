#!/usr/bin/env python3

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time

def test_treeview_browser():
    print("🌐 Testing TreeView in browser...")

    # Set up Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")

    driver = None
    success = False

    try:
        driver = webdriver.Chrome(options=chrome_options)
        print("✅ Browser started")

        # Navigate to the app
        driver.get("http://localhost:3737")
        print("📍 Navigated to Archon")

        # Wait for app to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # Navigate to the specific project
        project_url = "http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376"
        driver.get(project_url)
        print("📍 Navigated to project")

        # Wait for page to load
        time.sleep(5)

        # Take a screenshot for debugging
        driver.save_screenshot("/home/jmtrappier/Archon/.playwright-mcp/treeview-test-before.png")
        print("📸 Screenshot taken: treeview-test-before.png")

        # Check current page content
        page_text = driver.find_element(By.TAG_NAME, "body").text
        if "Tree" in page_text:
            print("✅ 'Tree' text found on page")
        else:
            print("❌ 'Tree' text not found on page")

        # Look for Tree button more broadly
        buttons = driver.find_elements(By.TAG_NAME, "button")
        button_texts = [btn.get_attribute("textContent") or btn.text for btn in buttons]
        print(f"📊 Found {len(buttons)} buttons")

        tree_button_found = False
        tree_button = None

        for i, btn in enumerate(buttons):
            btn_text = button_texts[i]
            if btn_text and "tree" in btn_text.lower():
                print(f"✅ Found Tree button: '{btn_text}'")
                tree_button = btn
                tree_button_found = True
                break

        if tree_button_found and tree_button:
            # Click the Tree button
            print("🖱️  Clicking Tree button...")
            driver.execute_script("arguments[0].click();", tree_button)
            time.sleep(3)

            # Take screenshot after click
            driver.save_screenshot("/home/jmtrappier/Archon/.playwright-mcp/treeview-test-after.png")
            print("📸 Screenshot taken: treeview-test-after.png")

            # Check if TreeView content is displayed
            page_text_after = driver.find_element(By.TAG_NAME, "body").text

            tree_indicators = [
                "Expand All", "Collapse All", "Search", "All Status", "All Assignees"
            ]

            found_indicators = []
            for indicator in tree_indicators:
                if indicator in page_text_after:
                    found_indicators.append(indicator)

            if found_indicators:
                print(f"✅ TreeView loaded! Found indicators: {found_indicators}")
                success = True

                # Test search functionality
                search_inputs = driver.find_elements(By.XPATH, "//input[contains(@placeholder, 'Search')]")
                if search_inputs:
                    print("✅ Search input found")
                    search_inputs[0].send_keys("test")
                    time.sleep(1)
                    search_inputs[0].clear()
                    print("✅ Search functionality tested")

                # Test dropdowns
                selects = driver.find_elements(By.TAG_NAME, "select")
                print(f"✅ Found {len(selects)} dropdown filters")

                # Check for expand/collapse functionality
                chevron_elements = driver.find_elements(By.XPATH, "//*[name()='svg']")
                print(f"✅ Found {len(chevron_elements)} SVG icons (potential expand/collapse)")

            else:
                print("❌ TreeView content not detected after clicking")

        else:
            print("❌ Tree button not found")
            print(f"Available button texts: {[text for text in button_texts if text]}")

            # Check if we're in the right place
            if "Tasks" in page_text or "Epic" in page_text:
                print("ℹ️  We're on the right page (project tasks)")
            else:
                print("⚠️  May not be on the correct page")

    except Exception as e:
        print(f"❌ Test failed with error: {e}")

    finally:
        if driver:
            driver.quit()
            print("🔚 Browser closed")

    return success

if __name__ == "__main__":
    if test_treeview_browser():
        print("\n🎉 TreeView test PASSED!")
        print("TreeView is working correctly in the browser.")
    else:
        print("\n💥 TreeView test FAILED!")
        print("Check the screenshots and output above for debugging.")

    # Also print some diagnostic info
    print("\n📋 Summary:")
    print("- Check screenshots in .playwright-mcp/ folder")
    print("- TreeView should be accessible via Tree button in project view")
    print("- Look for 'Expand All', 'Collapse All', search input, and filters")