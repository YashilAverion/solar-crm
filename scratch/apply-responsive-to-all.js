const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '..', 'public');

function processHtmlFiles(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Process subdirectories recursively (like uploads, but uploads shouldn't have html, though it's good practice)
            if (file !== 'uploads' && file !== 'node_modules') {
                processHtmlFiles(filePath);
            }
        } else if (file.endsWith('.html')) {
            injectAssets(filePath);
        }
    });
}

function injectAssets(filePath) {
    console.log(`Processing file: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');

    let modified = false;

    // Inject CSS link in <head>
    const cssLink = '<link rel="stylesheet" href="/responsive.css">';
    if (!content.includes('responsive.css') && content.includes('</head>')) {
        console.log(`-> Injecting stylesheet into ${path.basename(filePath)}`);
        content = content.replace('</head>', `    ${cssLink}\n</head>`);
        modified = true;
    }

    // Inject JS script in <body>
    const jsScript = '<script src="/responsive.js"></script>';
    if (!content.includes('responsive.js') && content.includes('</body>')) {
        console.log(`-> Injecting JavaScript into ${path.basename(filePath)}`);
        content = content.replace('</body>', `    ${jsScript}\n</body>`);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully updated: ${path.basename(filePath)}`);
    } else {
        console.log(`Already has assets linked: ${path.basename(filePath)}`);
    }
}

// Start processing
processHtmlFiles(publicDir);
console.log('Finished updating HTML files with responsive assets.');
