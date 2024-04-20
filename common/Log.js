

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

module.exports = {sendLog};