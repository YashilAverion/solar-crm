const db = require('../database/db');

db.serialize(() => {
    db.run("DELETE FROM installation_saved_charges", (err) => {
        if (err) console.error("Error clearing installation_saved_charges:", err.message);
        else console.log("Cleared installation_saved_charges");
    });

    db.run("DELETE FROM installation_documents", (err) => {
        if (err) console.error("Error clearing installation_documents:", err.message);
        else console.log("Cleared installation_documents");
    });

    db.run("DELETE FROM installations_history", (err) => {
        if (err) console.error("Error clearing installations_history:", err.message);
        else console.log("Cleared installations_history");
    });

    db.run("DELETE FROM installations", (err) => {
        if (err) console.error("Error clearing installations:", err.message);
        else console.log("Cleared installations");
    });

    db.run("DELETE FROM sqlite_sequence WHERE name IN ('installations', 'installations_history', 'installation_documents', 'installation_saved_charges')", (err) => {
        if (err) console.error("Error resetting sqlite_sequence:", err.message);
        else console.log("Reset sqlite_sequence for installations");
    });
});

setTimeout(() => {
    console.log("Installations database successfully cleared and reset.");
    process.exit(0);
}, 1000);
