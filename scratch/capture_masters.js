const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });

    console.log("Logging in...");
    await page.goto('http://localhost:3000/login.html');
    await page.type('#username', 'admin');
    await page.type('#password', 'admin123');
    await page.click('#loginBtn');
    await page.waitForSelector('#sidebar', { timeout: 8000 });

    const pagesToCapture = [
        { name: 'leads_fixed.png', url: 'http://localhost:3000/index.html', selector: '.table' },
        { name: 'products_fixed.png', url: 'http://localhost:3000/products.html', selector: '.table' },
        { name: 'combo_master_fixed.png', url: 'http://localhost:3000/combo_master.html', selector: '#combosTable' },
        { name: 'stc_master_fixed.png', url: 'http://localhost:3000/stc_master.html', selector: '.table' },
        { name: 'email_templates_fixed.png', url: 'http://localhost:3000/email_templates.html', selector: '.templates-grid' },
        { name: 'rebate_live_master_fixed.png', url: 'http://localhost:3000/rebate_live_master.html', selector: '.table' }
    ];

    for (const p of pagesToCapture) {
        console.log(`Navigating to ${p.url}...`);
        await page.goto(p.url);
        try {
            await page.waitForSelector(p.selector, { timeout: 5000 });
        } catch (e) {
            console.log(`Selector ${p.selector} not found, carrying on...`);
        }
        await new Promise(resolve => setTimeout(resolve, 1500));

        const screenshotPath = path.join('C:/Users/vishr/.gemini/antigravity-ide/brain/3662b593-e46d-43d1-bce9-5156725b131c', p.name);
        await page.screenshot({ path: screenshotPath });
        console.log(`Saved screenshot to: ${screenshotPath}`);
    }

    await browser.close();
})();
