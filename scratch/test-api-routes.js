// Set test port to prevent conflicts
process.env.PORT = 3999;

const axios = require('axios');
const app = require('../server'); // Starts the server on port 3999

async function runTests() {
    console.log('Testing configurations API routes...');
    
    try {
        // Test GET /api/configurations without auth
        const resGet = await axios.get('http://localhost:3999/api/configurations');
        console.error('ERROR: GET /api/configurations returned success without login!');
        process.exit(1);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('SUCCESS: GET /api/configurations correctly returned 401 Unauthorized (Auth works!).');
        } else {
            console.error('ERROR: GET /api/configurations failed with unexpected error:', err.message);
            process.exit(1);
        }
    }

    try {
        // Test POST /api/configurations without auth
        const resPost = await axios.post('http://localhost:3999/api/configurations', {
            config_key: 'table_density',
            config_value: 'compact'
        });
        console.error('ERROR: POST /api/configurations returned success without login!');
        process.exit(1);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.log('SUCCESS: POST /api/configurations correctly returned 401 Unauthorized (Auth works!).');
        } else {
            console.error('ERROR: POST /api/configurations failed with unexpected error:', err.message);
            process.exit(1);
        }
    }

    console.log('All API security verification tests passed!');
    process.exit(0);
}

// Wait a bit for server to boot
setTimeout(runTests, 2000);
