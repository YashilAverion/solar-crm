const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    const cmd = `cat << 'EOF' > /tmp/seed_charges.py
import sqlite3
conn = sqlite3.connect('/root/solar-crm/database/solar_v2.db')
cursor = conn.cursor()
charges = [
    ('Battery Installation Upto 30 kWh', 'battery_base', 2350.00, 'WA', 'Yes', 31),
    ('Battery Installation 30 kWh to 42 kWh', 'battery_base', 3100.00, 'WA', 'Yes', 32),
    ('Battery Installation Above 42 kWh - Per kWh', 'battery_per_kwh', 100.00, 'WA', 'Yes', 33)
]
for c in charges:
    cursor.execute('SELECT COUNT(*) FROM installation_charge_items WHERE LOWER(TRIM(charge_name)) = LOWER(?)', (c[0],))
    if cursor.fetchone()[0] == 0:
        cursor.execute('INSERT INTO installation_charge_items (charge_name, charge_type, rate, state, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)', c)
        print("Inserted:", c[0])
    else:
        print("Already exists:", c[0])
conn.commit()

# Print all battery charges now
cursor.execute('SELECT id, charge_name, rate FROM installation_charge_items WHERE charge_name LIKE "%Battery%" OR charge_name LIKE "%Bollard%"')
print("Current DB Charges:")
for r in cursor.fetchall():
    print("  -", r)
conn.close()
EOF
python3 /tmp/seed_charges.py
rm -f /tmp/seed_charges.py
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
