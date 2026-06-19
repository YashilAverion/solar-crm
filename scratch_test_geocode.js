const axios = require('axios');
const GOOGLE_API_KEY = 'AIzaSyCGqZk1aifXriaKoS-pvfJtlUEkC9MfZU4';
const gpsString = '23.114898,72.502627';

async function test() {
    const [lat, lng] = gpsString.split(',');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat.trim()},${lng.trim()}&key=${GOOGLE_API_KEY}`;
    try {
        console.log('Fetching:', url);
        const response = await axios.get(url);
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
