const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\vishr\\OneDrive - Ares Energy\\Solar CRM\\public\\project_profile.html', 'utf8');
const lines = content.split(/\r?\n/);
lines.forEach((line, index) => {
    if (line.includes('isProgrammaticUpdate')) {
        console.log(`L${index + 1}: ${line}`);
    }
});
