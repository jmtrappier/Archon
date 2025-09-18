import { chromium } from 'playwright';

async function testTreeView() {
  console.log('🔍 Testing TreeView with Playwright...');

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Navigate to Archon
    console.log('📍 Navigating to http://localhost:3737...');
    await page.goto('http://localhost:3737', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Navigate to the specific project
    const projectUrl = 'http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376';
    console.log('📍 Navigating to project...');
    await page.goto(projectUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Take screenshot before
    await page.screenshot({
      path: '.playwright-mcp/treeview-playwright-before.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: before');

    // Look for Tree button
    console.log('🔍 Looking for Tree button...');

    // Try different selectors for Tree button
    const treeButtonSelectors = [
      'button:has-text("Tree")',
      'button:has([data-testid="GitBranch"])',
      'button:has(svg)',
      'button[aria-label*="tree" i]',
      'button[title*="tree" i]'
    ];

    let treeButton = null;
    for (const selector of treeButtonSelectors) {
      const button = page.locator(selector);
      if (await button.count() > 0) {
        const buttonText = await button.textContent();
        if (buttonText && buttonText.toLowerCase().includes('tree')) {
          treeButton = button;
          console.log(`✅ Found Tree button with selector: ${selector}`);
          break;
        }
      }
    }

    // If we can't find it by selectors, look through all buttons
    if (!treeButton) {
      console.log('🔍 Searching through all buttons...');
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`📊 Found ${buttonCount} buttons`);

      for (let i = 0; i < buttonCount; i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent();
        if (text && text.toLowerCase().includes('tree')) {
          treeButton = button;
          console.log(`✅ Found Tree button at index ${i}: "${text}"`);
          break;
        }
      }
    }

    // List all button texts for debugging
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`📊 All buttons found (${buttonCount}):`);
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      if (text && text.trim()) {
        console.log(`  - "${text.trim()}"`);
      }
    }

    if (treeButton) {
      console.log('🖱️  Clicking Tree button...');
      await treeButton.click();
      await page.waitForTimeout(2000);

      // Take screenshot after click
      await page.screenshot({
        path: '.playwright-mcp/treeview-playwright-after.png',
        fullPage: true
      });
      console.log('📸 Screenshot taken: after');

      // Check for TreeView indicators
      const treeIndicators = [
        'Expand All',
        'Collapse All',
        'Search',
        'All Status',
        'All Assignees'
      ];

      const foundIndicators = [];
      for (const indicator of treeIndicators) {
        const element = page.locator(`text=${indicator}`);
        if (await element.count() > 0) {
          foundIndicators.push(indicator);
        }
      }

      if (foundIndicators.length > 0) {
        console.log(`✅ TreeView loaded! Found: ${foundIndicators.join(', ')}`);

        // Test search input
        const searchInput = page.locator('input[placeholder*="Search"]');
        if (await searchInput.count() > 0) {
          console.log('✅ Testing search input...');
          await searchInput.fill('test');
          await page.waitForTimeout(500);
          await searchInput.clear();
        }

        // Test dropdown filters
        const selects = page.locator('select');
        const selectCount = await selects.count();
        console.log(`✅ Found ${selectCount} dropdown filters`);

        // Test expand/collapse if available
        const expandButtons = page.locator('svg');
        const expandCount = await expandButtons.count();
        console.log(`✅ Found ${expandCount} SVG icons`);

        console.log('🎉 TreeView test PASSED!');
        return true;

      } else {
        console.log('❌ TreeView indicators not found after clicking');

        // Debug: what's on the page?
        const pageText = await page.textContent('body');
        console.log('Page contains:', pageText.substring(0, 200) + '...');

        return false;
      }

    } else {
      console.log('❌ Tree button not found');

      // Debug: Check URL and page content
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      const pageText = await page.textContent('body');
      if (pageText.includes('Tasks') || pageText.includes('Epic')) {
        console.log('ℹ️  We seem to be on the right page (contains Tasks/Epic)');
      } else {
        console.log('⚠️  Page content doesn\'t seem right');
      }

      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: '.playwright-mcp/treeview-playwright-error.png',
      fullPage: true
    });

    return false;
  } finally {
    await browser.close();
    console.log('🔚 Browser closed');
  }
}

// Run the test
testTreeView().then(success => {
  if (success) {
    console.log('\n🎉 TreeView implementation is working!');
  } else {
    console.log('\n💥 TreeView has issues - check screenshots for debugging');
  }
}).catch(error => {
  console.error('Test runner failed:', error);
});