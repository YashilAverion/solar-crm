const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    const cmd = `cat << 'EOF' > /tmp/check_yield_db.py
import sqlite3
conn = sqlite3.connect('/root/solar-crm/database/solar_v2.db')
cursor = conn.cursor()

print("=== Postcode Yield Factors ===")
cursor.execute('SELECT postcode_prefix, provider, jan, jun, dec FROM postcode_yield_factors')
for r in cursor.fetchall():
    print("  Prefix:", r[0], "| Provider:", r[1], "| Jan/Jun/Dec:", r[2], "/", r[3], "/", r[4])

print("")
print("=== Utility Rate Assumptions ===")
cursor.execute('SELECT provider, supply_charge_per_day, electricity_unit_rate, feed_in_tariff FROM utility_rate_assumptions')
for r in cursor.fetchall():
    print("  Provider:", r[0], "| Supply:", r[1], "| Unit Rate:", r[2], "| FiT:", r[3])

conn.close()
EOF
python3 /tmp/check_yield_db.py
rm -f /tmp/check_yield_db.py
`;

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Remote execution failed:', err);
            conn.end();
            process.exit(1);
        }
        
        stream.on('close', (code, signal) => {
            conn.end();
            process.exit(code === 0 ? 0 : 1);
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).on('error', (err) => {
    console.error('SSH Connection failed:', err.message);
    process.exit(1);
}).connect({
    host: '212.38.94.6',
    port: 22,
    username: 'root',
    password: 'Santyguru11#',
    readyTimeout: 20000
});
