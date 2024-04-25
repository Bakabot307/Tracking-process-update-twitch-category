const fs = require('fs').promises;

function sendLog(win, type, status, message) {
    if (win.webContents) {
        win.webContents.send('log', {
            type: type,
            status: status,
            message: message
        });
    } else {
        console.log('No open windows to send log message');
    }
}

async function loadFile(path) {
    try {
        let data = await fs.readFile(path, 'utf8');
        data = JSON.parse(data);
        return data;
    } catch (err) {
        console.error(`Error reading file from disk: ${err.message}`);
        return null;
    }
}

async function saveFile(path, data, event) {
    try {
        await fs.writeFile(path, JSON.stringify(data), 'utf8');
        event.sender.send('load-saved-list', { status: "OK", message: "Saved data!", data: data });
        return true;
    } catch (err) {
        console.error(`Error writing file to disk: ${err.message}`);
        return false;
    }
}

module.exports = { sendLog, loadFile, saveFile };