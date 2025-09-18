import { chromium } from 'playwright';

async function testTreeViewDocker() {
  console.log('🔍 Testing TreeView with Docker frontend on port 3737...');

  const browser = await chromium.launch({
    headless: false, // Fenêtre visible pour diagnostic
    slowMo: 1000     // Ralentir pour voir ce qui se passe
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Écouter les erreurs console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Écouter les erreurs réseau
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`❌ Network Error: ${response.status()} ${response.url()}`);
      }
    });

    // Navigation vers Archon Docker
    console.log('📍 Navigating to http://localhost:3737...');
    await page.goto('http://localhost:3737', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Attendre que React se charge
    await page.waitForTimeout(3000);

    // Prendre screenshot de l'état initial
    await page.screenshot({
      path: '.playwright-mcp/docker-initial-page.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: docker-initial-page.png');

    // Vérifier si la page est complètement blanche
    const bodyText = await page.textContent('body');
    console.log('🔍 Page content length:', bodyText?.length || 0);

    if (!bodyText || bodyText.trim().length === 0) {
      console.log('❌ Page is completely blank!');

      // Vérifier les erreurs dans la console
      const consoleLogs = await page.evaluate(() => {
        return window.console ? 'Console exists' : 'No console';
      });
      console.log('🔍 Console check:', consoleLogs);

      // Vérifier si React est chargé
      const reactCheck = await page.evaluate(() => {
        return window.React ? 'React loaded' : 'React not found';
      });
      console.log('🔍 React check:', reactCheck);

      // Vérifier l'état du DOM
      const domCheck = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          hasRoot: !!root,
          rootContent: root?.innerHTML?.substring(0, 200) || 'No root content'
        };
      });
      console.log('🔍 DOM check:', domCheck);

      return false;
    }

    console.log('✅ Page has content, proceeding with navigation');

    // Essayer de naviguer vers le projet
    const projectUrl = 'http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376';
    console.log('📍 Navigating to project...');

    await page.goto(projectUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    // Screenshot de la page projet
    await page.screenshot({
      path: '.playwright-mcp/docker-project-page.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: docker-project-page.png');

    // Chercher le bouton Tree
    console.log('🔍 Looking for Tree button...');

    const treeButton = await page.locator('button:has-text("Tree")').first();

    if (await treeButton.count() > 0) {
      console.log('✅ Tree button found!');

      // Cliquer sur le bouton Tree
      await treeButton.click();
      console.log('🖱️ Clicked Tree button');

      await page.waitForTimeout(2000);

      // Screenshot après clic
      await page.screenshot({
        path: '.playwright-mcp/docker-treeview-activated.png',
        fullPage: true
      });
      console.log('📸 Screenshot taken: docker-treeview-activated.png');

      // Vérifier la présence des éléments TreeView
      const expandAllButton = page.locator('button:has-text("Expand All")');
      const collapseAllButton = page.locator('button:has-text("Collapse All")');
      const searchInput = page.locator('input[placeholder*="Search"]');

      const expandExists = await expandAllButton.count() > 0;
      const collapseExists = await collapseAllButton.count() > 0;
      const searchExists = await searchInput.count() > 0;

      console.log('🔍 TreeView elements check:');
      console.log('  - Expand All button:', expandExists ? '✅' : '❌');
      console.log('  - Collapse All button:', collapseExists ? '✅' : '❌');
      console.log('  - Search input:', searchExists ? '✅' : '❌');

      if (expandExists && collapseExists && searchExists) {
        console.log('🎉 TreeView is working correctly!');
        return true;
      } else {
        console.log('❌ TreeView elements missing');
        return false;
      }

    } else {
      console.log('❌ Tree button not found');

      // Debug: lister tous les boutons
      const allButtons = await page.locator('button').all();
      console.log(`📊 Found ${allButtons.length} buttons:`);

      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        const buttonText = await allButtons[i].textContent();
        if (buttonText?.trim()) {
          console.log(`  - "${buttonText.trim()}"`);
        }
      }

      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Screenshot d'erreur
    await page.screenshot({
      path: '.playwright-mcp/docker-error.png',
      fullPage: true
    });

    return false;
  } finally {
    // Laisser la fenêtre ouverte pour diagnostic
    console.log('🔚 Test completed. Browser window left open for debugging.');
    console.log('📱 Press Ctrl+C to close the browser when done.');

    // Attendre indéfiniment pour garder la fenêtre ouverte
    await new Promise(() => {});
  }
}

// Run the test
testTreeViewDocker().catch(error => {
  console.error('Test runner failed:', error);
});