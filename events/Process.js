const path = require('path');
const { spawn } = require('child_process');
const kill = require('tree-kill');
const psTree = require('ps-tree');

const pathName = path.join(__dirname, 'app/bin');

const serverProcess = spawn('cmd.exe', ['/c', 'app.bat'], {
    detached: false,
    cwd: pathName,
    windowsHide: true,
});

console.log('Server process started:', serverProcess.pid);
serverProcess.on('exit', (code) => {
    console.log(`Child exited with code ${code}`);
    console.log('Server process killed', serverProcess.killed);
});

exports.serverProcess = serverProcess
exports.killServerProcess = function (mainWindow) {
    kill(serverProcess.pid, 'SIGTERM', function (err) {
        if (err) {
            console.error(err);
        }
        console.log('Server process killed');
        serverProcess = null;
    });
};



