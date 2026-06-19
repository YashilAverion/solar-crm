const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

let backupState = {
    isRunning: false,
    progress: 0,
    error: null
};

// Safely resolve the project root directory
// If the script is running from the root, process.cwd() works. 
// If placed in a subfolder, we can safely navigate upward until we find package.json.
function getProjectRoot() {
    let currentDir = __dirname;
    while (currentDir !== path.parse(currentDir).root) {
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    return process.cwd(); // Safe fallback
}

const ROOT_DIR = getProjectRoot();

// Safely pre-calculate all files recursively to establish an exact 'total' for progress tracking
function getFilesToArchive(dir, fileList = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            continue; // Safely skip files that cannot be accessed (e.g., locked or deleted mid-scan)
        }
        
        const relPath = path.relative(ROOT_DIR, fullPath);
        const normalizedRelPath = relPath.replace(/\\/g, '/');

        // --- STRICT EXCLUSION RULES ---
        // Prevent infinite loops by excluding the backup directory itself, Node modules, and Git configs
        if (normalizedRelPath.startsWith('SYSTEM_BACKUPS') || 
            normalizedRelPath.startsWith('node_modules') || 
            normalizedRelPath.startsWith('.git') ||
            normalizedRelPath.startsWith('.vscode')) {
            continue;
        }

        // Exclude SQLite active journal files to prevent zip corruption and DB locks
        if (item.endsWith('.db-journal') || 
            item.endsWith('.db-wal') || 
            item.endsWith('.db-shm') ||
            item.endsWith('.zip')) {
            continue;
        }

        if (stat.isDirectory()) {
            getFilesToArchive(fullPath, fileList);
        } else {
            fileList.push({ fullPath, relPath: normalizedRelPath });
        }
    }
    return fileList;
}

function createBackup() {
    if (backupState.isRunning) return false;

    backupState = {
        isRunning: true,
        progress: 0,
        error: null
    };

    try {
        const backupDir = path.join(ROOT_DIR, 'SYSTEM_BACKUPS');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Use a safe timestamp format for filenames
        const dateStr = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        const zipPath = path.join(backupDir, `solar_crm_backup_${dateStr}.zip`);
        
        const output = fs.createWriteStream(zipPath, { highWaterMark: 2 * 1024 * 1024 }); // 2MB chunk buffer prevents pipe blockages
        const archive = archiver('zip', {
            zlib: { level: 6 }, // Balanced compression (stops CPU/Memory spikes on 500MB+ backups)
            statConcurrency: 10 // Caps parallel file reading to prevent 'EMFILE' too many open files errors
        });

        // Pre-calculate exact total files for buttery-smooth frontend progress tracking
        let filesToProcess = [];
        try {
            filesToProcess = getFilesToArchive(ROOT_DIR);
        } catch (walkErr) {
            backupState.isRunning = false;
            backupState.error = 'File indexing failed: ' + walkErr.message;
            return true;
        }

        const totalFiles = filesToProcess.length;
        let processedFiles = 0;

        // --- Event Listeners ---
        output.on('close', () => {
            backupState.isRunning = false;
            backupState.progress = 100;
        });

        output.on('error', (err) => {
            backupState.isRunning = false;
            backupState.error = 'Stream error: ' + err.message;
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('Backup warning: File missing during archiving.', err);
            } else {
                backupState.isRunning = false;
                backupState.error = 'Archiver warning: ' + err.message;
                throw err;
            }
        });

        archive.on('error', (err) => {
            backupState.isRunning = false;
            backupState.error = 'Archiver error: ' + err.message;
        });

        archive.on('entry', () => {
            processedFiles++;
            if (totalFiles > 0) {
                let currentProgress = Math.round((processedFiles / totalFiles) * 100);
                // Cap at 99% until the write stream explicit 'close' event fires
                if (currentProgress > 99) currentProgress = 99;
                backupState.progress = currentProgress;
            }
        });

        archive.pipe(output);

        // Iteratively append each calculated file
        for (const file of filesToProcess) {
            archive.file(file.fullPath, { name: file.relPath });
        }

        archive.finalize();
        return true;

    } catch (err) {
        backupState.isRunning = false;
        backupState.error = 'Fatal backup error: ' + err.message;
        return true;
    }
}

function getBackupState() {
    // Return a clean, stable JSON object for the frontend polling interval
    return {
        isRunning: !!backupState.isRunning,
        progress: isNaN(backupState.progress) ? 0 : Math.max(0, Math.min(100, Math.round(backupState.progress))),
        error: backupState.error ? String(backupState.error) : null
    };
}

module.exports = {
    createBackup,
    getBackupState
};