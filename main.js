
const { app, BrowserWindow, ipcMain, shell } = require('electron/main')
const path = require('node:path')
const fs = require('fs');
const monitor = require('./events/Process.js');
const { killServerProcess } = require('./events/Process.js');

const { openServer } = require('./twitch/functions.js');
const WebSocket = require('ws');
const { sendLog, loadFile, saveFile } = require('./common.js');
const TwitchClass = require('./twitch/class.js');
const treeKill = require('tree-kill');
const clientId = 'qarqfcwzn8owibki0nb0hdc0thwfxb';
const clientSecret = 'l39js4ios95bjxstrvsans0cb50wi5';
const namePath = path.join(__dirname, 'datas', 'appName.json');
const cookiePath = path.join(__dirname, 'datas', 'cookie.json');
const settingsPath = path.join(__dirname, 'datas', 'settings.json');
let win;
let listWindow;
let ws;
let ws2;
let username;
let twitch;
let currentStreamingState = { status: false, category: '', categoryId: '' };
let settings;
let appNames = [];
let dataTimer1 = null;
let dataTimer2 = null;
let lastData = null;
let allowToUpdate;
let appRunning;
let dataListener = null;
function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'Tracking App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  win = mainWindow;
  mainWindow.loadFile('index.html')
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on('did-finish-load', async () => {
    sendLog(win, 'APP', 'OK', 'Main window finished loading');
    //load settings
    try {
      await loadFile(settingsPath).then((data) => {
        settings = data;
      });

      await loadFile(namePath).then((data) => {
        appNames = data;
      });
    } catch (error) {
      console.error(error);
    }

    doStuff();
  });
  mainWindow.on('close', (e) => {
    if (monitor.serverProcess) {
      e.preventDefault();
      treeKill(monitor.serverProcess.pid, 'SIGKILL', function () {
        console.log('Server process killed');
        monitor.serverProcess = null;
        mainWindow.close();
      });
    }
  });
}


async function doStuff() {
  const data = await TwitchClass.getTwitchToken();
  let twitchData;
  if (data === null) {
    sendLog(win, 'APP', 'ACTION_REQUIRED_LOGIN', 'No Twitch token found, please login first');
    return;
  } else if (data.status === "EXPIRED") {
    const newToken = await TwitchClass.refreshAccessToken(twitchData, clientId, clientSecret);
    if (newToken.status === "EXPIRED") {
      sendLog(win, 'APP', 'ACTION_REQUIRED_LOGIN', 'Twitch token is expired, please login again');
      return;
    }
    twitchData = newToken ? newToken : data.data;
  }
  const accessToken = twitchData.tokens.accessToken;
  twitch = new TwitchClass(accessToken, clientId, clientSecret);
  const broadcasterId = await twitch.getBroadcasterId();

  username = data.data.username;

  const streamingInfo = await twitch.getStreamInfo(broadcasterId);

  if (streamingInfo === null) {
    currentStreamingState.status = false;
    currentStreamingState.category = '';
    currentStreamingState.categoryId = '';
    sendLog(win, 'WEB', 'INFO', `${username} is not streaming right now`);
  } else {
    currentStreamingState.status = true;
    currentStreamingState.category = streamingInfo.category;
    currentStreamingState.categoryId = streamingInfo.categoryId;

    sendLog(win, 'WEB', 'INFO', `${username} is streaming right now`);
    updateStreamCategory(broadcasterId);
  }
  openWebSocketChat(accessToken, username);
  openWebSocketEvent(accessToken, broadcasterId);
}



async function updateStreamCategory(broadcasterId) {
  dataListener = async (data) => {
    const dataString = data.toString().toLowerCase();
    allowToUpdate = false;
    console.log('Data:', dataString);
    if (dataTimer1) {
      clearTimeout(dataTimer1);
    }

    if (dataTimer2) {
      clearTimeout(dataTimer2);
    }
    dataTimer1 = setTimeout(async () => {
      appNames.some((app) => {
        if (dataString.includes(app.name) && currentStreamingState.categoryId !== app.categoryId) {
          appRunning = app;
          allowToUpdate = "FOCUSED";
          return true;
        } else {
          allowToUpdate = "NOT FOCUSED";
        }
      });

      if (dataString !== lastData && allowToUpdate === "FOCUSED") {
        console.log('allowToUpdate:', allowToUpdate);
        dataTimer2 = setTimeout(async () => {
          const update = await twitch.updateStreamCategory(broadcasterId, appRunning.categoryId);
          if (update) {
            lastData = dataString;
            console.log('Category updated to:', appRunning.category);
          } else {
            console.log('Category not updated');
          }
        }, settings.process.windowFocus_time * 1000 * 60); ///after secs will update category if the window is focused
      } else if (dataString !== lastData && allowToUpdate === "NOT FOCUSED") {
        if (currentStreamingState.categoryId == 0 || currentStreamingState.categoryId == 509658) {
          return;
        }
        dataTimer2 = setTimeout(async () => {
          let update;
          switch (settings.process.idleCategory) {
            case "chatting":
              update = await twitch.updateStreamCategory(broadcasterId, 509658);
              break;
            case "none":
              update = await twitch.updateStreamCategory(broadcasterId, 0);
              break;
            default:
              break;
          }
          if (update) {
            lastData = dataString;
            console.log('Category updated to chatting');
          } else {
            console.log('Category not updated');
          }
        }, settings.process.windowNoFocus_time * 1000 * 60); ///after secs will update category if the window is focused
      }
    }, 10000); ///after 10 sec will continue executing the code
  }
  monitor.serverProcess.stdout.on('data', dataListener);
  sendLog(win, 'APP', 'INFO', 'Listening for app names in the window title because the stream is live');
}

function stopUpdateStreamCategory() {
  if (dataListener) {
    monitor.serverProcess.stdout.off('data', dataListener);
    dataListener = null;
  }
  killServerProcess();
  sendLog(win, 'APP', 'INFO', 'Stopped listening for app names in the window title because the stream is offline');
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


let newWindow;
ipcMain.on('action', (event, action) => {
  switch (action) {
    case 'LOGIN':
      openServer(win);
      newWindow = new BrowserWindow({
        title: 'Login to Twitch',
        width: 800,
        height: 600
      });

      newWindow.loadURL("http://localhost:3000/auth");

      newWindow.webContents.on('did-finish-load', () => {
        newWindow.webContents.session.cookies.get({ name: 'auth-token' }).then(async (cookies) => {
          if (cookies.length > 0) {
            const loginToken = {
              name: cookies[0].name,
              value: cookies[0].value,
              expires: cookies[0].expirationDate
            };
            await saveFile(cookiePath, loginToken, event);
          } else {
            console.log('No auth-token cookie found');
          }
        }).catch((error) => {
          console.error(error);
        });
      });
      break;
    case 'OPEN_LIST':
      openListWindow();
      break;
    case 'DO_STUFF':
      doStuff();
      break;
    default:
      console.error(`Unknown action: ${action}`);
      break;
  }

});

function openListWindow() {
  listWindow = new BrowserWindow({
    title: 'Manage apps',
    width: 400,
    height: 300,
    webPreferences: {
      preload: path.join(__dirname, './list/list-preload.js')
    }
  })
  listWindow.setMenu(null);
  listWindow.setMenuBarVisibility(false);
  listWindow.loadFile('./list/list.html')
  listWindow.webContents.on('did-finish-load', async () => {
    sendLog(listWindow, 'APP', 'OK', 'List window finished loading');
    listWindow.webContents.send('load-saved-list', { message: "OK", data: appNames });
  });

  listWindow.on('close', () => {
    sendLog(win, 'APP', 'INFO', 'List window closed');
  });
}

function openWebSocketChat(accessToken, username) {
  ws2 = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

  ws2.on('open', () => {
    sendLog(win, 'WEB', 'OK', 'WebSocket CHAT connection opened');
    ws2.send('CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands');
    ws2.send(`PASS oauth:${accessToken}`);
    ws2.send(`NICK #${username}`);
    ws2.send(`JOIN #${username}`);
  });

  ws2.on('message', (data) => {
    const message = data.toString();
    console.log('Received message:', message);

    const badgeMatch = message.match(/badges=([^;]*)/);
    const badges = badgeMatch ? badgeMatch[1] : 'No badges';
    console.log('Badges:', badges);
    // Extract the username and message text
    const match = message.match(/:(\w+)!\w+@\w+.tmi.twitch.tv PRIVMSG #\w+ :(.*)/);
    if (match) {
      const username = match[1];
      const text = match[2];
      console.log('Username:', username);
      console.log('Text:', text);
    }
  });

  ws2.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

ipcMain.on('btn-addName', async (event, name, category) => {
  if (category === '' || category === undefined || category === null) {
    category = name;
  }
  let newName = name.toLowerCase();
  category = category.toLowerCase();
  for (const appName of appNames) {
    if (appName.name === newName) {
      sendLog(listWindow, 'APP', 'FAILED', `Name already exists ${newName}`);
      return;
    }
  }
  const gameId = await twitch.getGameId(category);

  if (gameId === null) {
    sendLog(listWindow, 'APP', 'FAILED', `Category isn't exist ${newName}, please check the game name`);
    return;
  }
  appNames.push({ name: newName, category: category, categoryId: gameId });

  const saved = await saveFile(namePath, appNames, event);
  if (saved) {
    sendLog(listWindow, 'APP', 'CREATED', `Added ${newName}`);
    sendLog(win, 'APP', 'CREATED', `Added ${newName}`)
  }
});

ipcMain.on('btn-deleteName', async (event, value) => {
  appNames = appNames.filter(data => data.name !== value);
  const saved = await saveFile(namePath, appNames, event);
  if (saved) {
    sendLog(win, 'APP', 'DELETED', `Deleted ${value}`);
    sendLog(listWindow, 'APP', 'DELETED', `Deleted ${value}`);
  }
});

ipcMain.on('save-list', async (event, data) => {
  const saved = await saveFile(namePath, data, event);
  if (saved) {
    appNames = data;
  }
});

//open websocket for eventsub 
function openWebSocketEvent(accessToken, broadcasterId) {
  ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30');
  ws.on('open', function open() {
    sendLog(win, 'WEB', 'OK', 'WebSocket EVENTSUB connection opened');
  });
  ws.on('message', async (event) => {
    const data = JSON.parse(event);
    const metadata = data.metadata;
    const payload = data.payload;
    if (metadata.message_type === 'session_welcome') {
      createEventSubSubscription(payload.session.id, accessToken, broadcasterId);
    }
    if (metadata.subscription_type === 'stream.online' && payload.subscription.type === 'stream.online') {
      sendLog(win, 'STREAMING', 'INFO', `${username} went live at ${payload.event.started_at}`);
      currentStreamingState.status = true;
      updateStreamCategory(broadcasterId);
    }
    if (metadata.subscription_type === 'stream.offline' && payload.subscription.type === 'stream.offline') {
      sendLog(win, 'STREAMING', 'INFO', `${username} went offline at ${payload.subscription.created_at}`);
      currentStreamingState.status = false;
      stopUpdateStreamCategory();
    }

    if (metadata.subscription_type === 'channel.update' && payload.subscription.type === 'channel.update') {
      console.log('Stream info got updated, current category:', payload.event.category_name);
      currentStreamingState.category = payload.event.category_name;
      currentStreamingState.categoryId = payload.event.category_id;
      sendLog(win, 'STREAMING', 'INFO', `Stream info got updated, current category: ${payload.event.category_name}`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', (code, reason) => {
    console.log('WebSocket connection closed:', code, reason.toString());
  });

}

function closeWebSocket() {
  if (ws) {
    ws.close();
  }
}

const createEventSubSubscription = async (sessionID, accessToken, broadcasterId) => {
  const types = [
    { name: 'stream.online', version: '1' },
    { name: 'stream.offline', version: '1' },
    { name: 'channel.update', version: '2' }
  ]
  const url = 'https://api.twitch.tv/helix/eventsub/subscriptions';
  const headers = {
    'Authorization': 'Bearer ' + accessToken,
    'Client-Id': clientId,
    'Content-Type': 'application/json'
  };

  for (const type of types) {
    const body = JSON.stringify({
      "type": type.name,
      "version": type.version,
      "condition": {
        "broadcaster_user_id": broadcasterId
      },
      "transport": {
        "method": 'websocket',
        "session_id": sessionID
      }
    });

    const response = await fetch(url, { method: 'POST', headers, body });
    if (response.status === 202) {
      sendLog(win, 'WEB', 'OK', `EventSub subscription created for type: ${type.name}`);
    } else {
      console.log('Error creating EventSub subscription:', response);
      sendLog(win, 'WEB', 'FAILED', `Error creating EventSub subscription for type: ${type.name}`);
    }
  }
};
