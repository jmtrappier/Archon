const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Starting TreeView test with Playwright...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"], .min-h-screen', {
      timeout: 10000
    });
    console.log('✅ App loaded successfully');

    // Navigate to projects page
    console.log('📍 Navigating to projects...');
    await page.goto('http://localhost:3737/projects', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for projects to load
    await page.waitForSelector('text=/Project|PROJET|project/i, .grid, [class*="project"]', {
      timeout: 10000
    });
    console.log('✅ Projects page loaded');

    // Click on the first project (Archon - TRAXIS)
    const projectLink = await page.locator('a[href*="/projects/"], [class*="project-card"]').first();
    if (await projectLink.count() > 0) {
      console.log('📍 Clicking on first project...');
      await projectLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('⚠️  No project found, navigating directly...');
      await page.goto('http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376', {
        waitUntil: 'networkidle'
      });
    }

    // Wait for tasks tab to load
    await page.waitForSelector('[class*="tab"], text=/Tasks|Board|Table/i', { timeout: 10000 });
    console.log('✅ Project loaded');

    // Look for Tree button in view controls
    console.log('🔍 Looking for Tree view button...');

    // Check if Tree button exists
    const treeButton = page.locator('button:has-text("Tree"), button:has(svg[class*="GitBranch"])');
    const treeButtonCount = await treeButton.count();

    if (treeButtonCount > 0) {
      console.log('✅ Tree button found!');

      // Click Tree button
      await treeButton.click();
      console.log('✅ Clicked Tree view button');

      // Wait for TreeView to load
      await page.waitForTimeout(2000);

      // Check for TreeView elements
      const treeViewExists = await page.locator('[class*="tree"], [class*="expand"], [class*="collapse"]').count() > 0;

      if (treeViewExists) {
        console.log('✅ TreeView is displayed!');

        // Test expand/collapse
        const expandButtons = page.locator('svg[class*="ChevronRight"], svg[class*="ChevronDown"]');
        const expandCount = await expandButtons.count();
        console.log(`📊 Found ${expandCount} expandable items`);

        // Test search functionality
        const searchInput = page.locator('input[placeholder*="Search"]');
        if (await searchInput.count() > 0) {
          console.log('✅ Search input found');
          await searchInput.fill('test');
          await page.waitForTimeout(500);
          await searchInput.clear();
        }

        // Test filter dropdowns
        const filterSelects = page.locator('select');
        const selectCount = await filterSelects.count();
        console.log(`📊 Found ${selectCount} filter dropdowns`);

        // Take screenshot
        await page.screenshot({
          path: '.playwright-mcp/treeview-success.png',
          fullPage: true
        });
        console.log('📸 Screenshot saved: treeview-success.png');

      } else {
        console.log('❌ TreeView content not visible');

        // Check console for errors
        page.on('console', msg => {
          if (msg.type() === 'error') {
            console.log('Console error:', msg.text());
          }
        });

        await page.screenshot({
          path: '.playwright-mcp/treeview-error.png',
          fullPage: true
        });
      }

    } else {
      console.log('❌ Tree button NOT found - checking ViewControls...');

      // Debug: Check what buttons are visible
      const visibleButtons = await page.locator('button').evaluateAll(buttons =>
        buttons.map(b => b.textContent?.trim()).filter(Boolean)
      );
      console.log('Visible buttons:', visibleButtons);

      // Check if ViewControls exists
      const viewControls = await page.locator('[class*="fixed bottom"], [class*="view-control"]').count();
      console.log(`ViewControls found: ${viewControls > 0}`);

      // Check current view mode
      const tableButton = await page.locator('button:has-text("Table")').count();
      const boardButton = await page.locator('button:has-text("Board")').count();
      console.log(`Table button: ${tableButton > 0}, Board button: ${boardButton > 0}`);

      // Take diagnostic screenshot
      await page.screenshot({
        path: '.playwright-mcp/treeview-missing-button.png',
        fullPage: true
      });
      console.log('📸 Diagnostic screenshot saved');

      // Check for import errors in console
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(2000);
      if (consoleErrors.length > 0) {
        console.log('Console errors found:', consoleErrors);
      }
    }

    // Additional debugging - check HTML structure
    const htmlContent = await page.locator('body').innerHTML();
    if (htmlContent.includes('GitBranch')) {
      console.log('✅ GitBranch icon reference found in HTML');
    } else {
      console.log('❌ GitBranch icon NOT found in HTML');
    }

    if (htmlContent.includes('tree') || htmlContent.includes('Tree')) {
      console.log('✅ "tree" text found in HTML');
    } else {
      console.log('❌ "tree" text NOT found in HTML');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: '.playwright-mcp/treeview-error-state.png',
      fullPage: true
    });

    // Log page content for debugging
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    const url = page.url();
    console.log('Current URL:', url);
  }

  await browser.close();
  console.log('🏁 Test completed');
})();