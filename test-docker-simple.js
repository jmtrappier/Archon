// Test simple pour TreeView avec Docker
const puppeteer = require('puppeteer');

async function testTreeViewDocker() {
  console.log('🐳 Testing TreeView with Docker containers...');

  const browser = await puppeteer.launch({
    headless: false, // Fenêtre visible
    slowMo: 500,     // Ralentir pour voir
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Naviguer vers l'application Docker
    console.log('📍 Navigating to Docker Archon (http://localhost:3737)...');
    await page.goto('http://localhost:3737', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Attendre que React se charge
    await page.waitForTimeout(3000);

    // Screenshot initial
    await page.screenshot({ path: '.playwright-mcp/docker-home-page.png', fullPage: true });
    console.log('📸 Screenshot: docker-home-page.png');

    // Vérifier si la page se charge
    const content = await page.content();
    if (content.includes('Archon')) {
      console.log('✅ Page loads with Archon content');
    } else {
      console.log('❌ Page does not contain Archon content');
      return false;
    }

    // Naviguer vers le projet
    const projectUrl = 'http://localhost:3737/projects/a37b53ff-e647-44a4-998b-e920582ed376';
    console.log('📍 Navigating to project...');
    await page.goto(projectUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    // Screenshot de la page projet
    await page.screenshot({ path: '.playwright-mcp/docker-project-page.png', fullPage: true });
    console.log('📸 Screenshot: docker-project-page.png');

    // Chercher le bouton Tree
    console.log('🔍 Looking for Tree button...');

    const treeButton = await page.$('button[aria-label*="tree" i], button:has-text("Tree")');

    if (treeButton) {
      console.log('✅ Tree button found!');

      // Cliquer sur le bouton Tree
      await treeButton.click();
      console.log('🖱️ Clicked Tree button');

      await page.waitForTimeout(2000);

      // Screenshot après clic
      await page.screenshot({ path: '.playwright-mcp/docker-treeview-page.png', fullPage: true });
      console.log('📸 Screenshot: docker-treeview-page.png');

      // Vérifier les éléments TreeView
      const expandAllButton = await page.$('button:has-text("Expand All")');
      const collapseAllButton = await page.$('button:has-text("Collapse All")');
      const searchInput = await page.$('input[placeholder*="Search"]');

      console.log('🔍 TreeView elements check:');
      console.log('  - Expand All button:', expandAllButton ? '✅' : '❌');
      console.log('  - Collapse All button:', collapseAllButton ? '✅' : '❌');
      console.log('  - Search input:', searchInput ? '✅' : '❌');

      if (expandAllButton && collapseAllButton && searchInput) {
        console.log('🎉 TreeView test PASSED!');

        // Test rapide de fonctionnalité
        await searchInput.type('test');
        await page.waitForTimeout(500);
        await searchInput.click({ clickCount: 3 }); // Sélectionner tout
        await searchInput.press('Backspace'); // Effacer

        console.log('✅ Search functionality tested');
        return true;
      } else {
        console.log('❌ TreeView elements missing');
        return false;
      }

    } else {
      console.log('❌ Tree button not found');

      // Debug: lister tous les boutons
      const buttons = await page.$$eval('button', btns =>
        btns.map(btn => btn.textContent?.trim()).filter(text => text)
      );

      console.log(`📊 Available buttons: ${buttons.slice(0, 10).join(', ')}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);

    await page.screenshot({ path: '.playwright-mcp/docker-error.png', fullPage: true });
    console.log('📸 Error screenshot: docker-error.png');

    return false;
  } finally {
    // Garder le navigateur ouvert pour inspection
    console.log('🔚 Test completed. Browser left open for inspection.');
    console.log('   Press Ctrl+C to close when done.');

    // Attendre indéfiniment
    await new Promise(() => {});
  }
}

// Lancer le test
testTreeViewDocker().catch(console.error);