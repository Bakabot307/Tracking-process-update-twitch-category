
const { app, BrowserWindow, ipcMain,shell } = require('electron/main')
const path = require('node:path')
const fs = require('fs');
const  {checkTargetProcesses}  = require('./events/Process.js');
const {openServer} = require('./twitch/functions.js');
const WebSocket = require('ws');
const {sendLog} = require('./common/Log.js');
const TwitchClass = require('./twitch/class.js');
const clientId = 'qarqfcwzn8owibki0nb0hdc0thwfxb';
const clientSecret = 'l39js4ios95bjxstrvsans0cb50wi5';
const jsonFilePath = path.join(__dirname,'datas', 'appName.json');
const jsonFilePath2 = path.join(__dirname,'datas', 'cookie.json');
let win;
let listWindow;
let ws;
let ws2;
let username;
let appRunningInterval;
let twitch;
let currentStreamingState = {status: false, category: '', categoryId: ''};
function createWindow () {
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
      sendLog(win,'APP', 'OK', 'Main window finished loading');
            doStuff();  
            
    });    
  }
  async function doStuff(){    

    let twitchData = await TwitchClass.getTwitchToken();
     if(twitchData===null){
      sendLog(win,'APP', 'ACTION_REQUIRED_LOGIN', 'No Twitch token found, please login first');
      return;
    } else if(twitchData.status === "EXPIRED"){      
    const newToken = await TwitchClass.refreshAccessToken(twitchData.data, clientId, clientSecret);
    if(newToken.status === "EXPIRED"){
      sendLog(win,'APP', 'ACTION_REQUIRED_LOGIN', 'Twitch token is expired, please login again');
      return;    
    }
    twitchData = newToken;          
    } 
    const accessToken = twitchData.data.tokens.accessToken;
    twitch = new TwitchClass(accessToken, clientId, clientSecret);
    const broadcasterId = await twitch.getBroadcasterId(); 
    
    username = twitchData.data.username; 

    const streamingInfo = await twitch.getStreamInfo(broadcasterId);



    if(streamingInfo===null){
      currentStreamingState.status = false;   
      currentStreamingState.category = '';
      currentStreamingState.categoryId = '';     
      sendLog(win,'WEB', 'INFO', `${username} is not streaming right now`);       
    } else {
      currentStreamingState.status = true;
      currentStreamingState.category = streamingInfo.category;
      currentStreamingState.categoryId = streamingInfo.categoryId;
      updateStreamInterval(broadcasterId);
      sendLog(win,'WEB', 'INFO', `${username} is streaming right now`);
    }
    openWebSocketChat(accessToken,username);
    openWebSocketEvent(accessToken,broadcasterId); 
  }
async function updateStreamInterval(broadcasterId){  
  await updateStreamCategory(broadcasterId);

  appRunningInterval = setInterval( async() => {
  await updateStreamCategory(broadcasterId)
}, 50000);
}
let lastRunningApp = null;

async function updateStreamCategory(broadcasterId){ 
  let updated=false;
  await checkTargetProcesses( async(runningApp) => {  
    if(lastRunningApp && runningApp === undefined || currentStreamingState.status === false){
      lastRunningApp = runningApp;
      win.webContents.send('load-running-list', runningApp);
      if(currentStreamingState.status){
        updated = await twitch.updateStreamCategory(broadcasterId, "");
      }
      return;
    }

    if (runningApp === undefined) {
      return;
    }

    if (lastRunningApp && runningApp.name === lastRunningApp.name) {
      return;
    }

    lastRunningApp = runningApp;
    win.webContents.send('load-running-list', runningApp);

    if(runningApp.categoryId === currentStreamingState.categoryId){
      console.log('Already streaming with the same category');
      return;
    } else {
      currentStreamingState.categoryId = runningApp.categoryId;
      currentStreamingState.category = runningApp.category;
      currentStreamingState.status = true;
      win.webContents.send('load-running-list', runningApp);       
    }
  
if(currentStreamingState.status){
       updated = await twitch.updateStreamCategory(broadcasterId, runningApp.categoryId);
      if(updated){
        console.log('Stream category updated');
      } else {
        console.log('Stream category not updated');
      }
    }    
    })  
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })  
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
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
        newWindow.webContents.session.cookies.get({ name: 'auth-token' }).then((cookies) => {
          if (cookies.length > 0) {
            const loginToken = {
              name: cookies[0].name,
              value: cookies[0].value,
              expires: cookies[0].expirationDate
            };
            fs.writeFile(jsonFilePath2, JSON.stringify(loginToken, null, 2), (err) => {
              if(err){
                console.error(`Error writing file to disk: ${err.message}`);
              }
            });
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
function openListWindow(){
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
   sendLog(listWindow,'APP', 'OK', 'List window finished loading');
  fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading file from disk: ${err.message}`);
    } else {
      const appNames = JSON.parse(data);
      listWindow.webContents.send('load-saved-list',{message: "OK", data:appNames} );
    }
  });
  });

  listWindow.on('close', () => {    
    sendLog(win,'APP', 'INFO', 'List window closed');
  });
}


function openWebSocketChat(accessToken,username){
  ws2 = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

  ws2.on('open', () =>{
    sendLog(win,'WEB','OK', 'WebSocket CHAT connection opened' );
    ws2.send('CAP REQ :twitch.tv/membership twitch.tv/tags twitch.tv/commands');
    ws2.send(`PASS oauth:${accessToken}`);
    ws2.send(`NICK #${username}`);
    ws2.send(`JOIN #${username}`);  
  });
  
  ws2.on('message',  (data) =>{
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

ipcMain.on('btn-addName', (event, name, category) => {
  if(category === '' || category === undefined || category === null){
    category = name;
  }
  fs.readFile(jsonFilePath, 'utf8',async (err, data) => {
    if (err) {
      sendLog(win,'APP', 'FAILED', `Error reading file from disk when adding name ${name}: ${err.message}`)
    } else {
      const appNames = JSON.parse(data);
      let newName = name.toLowerCase();
      category = category.toLowerCase();
      for (const appName of appNames) {
        if (appName.name === newName) {     
          sendLog(listWindow,'APP', 'FAILED', `Name already exists ${newName}`);     
          return;
        }
      }
      const gameId = await twitch.getGameId(category);

      if(gameId === null){
        sendLog(listWindow,'APP', 'FAILED', `Category isn't exist ${newName}, please check the game name`);
        return;
      }
      appNames.push({name: newName, category: category, categoryId: gameId});
      saveListData(appNames,`added ${newName}`,event, "OK");
      sendLog(listWindow,'APP', 'CREATED', `Added ${newName}`);
      sendLog(win,'APP', 'CREATED', `Added ${newName}`)
    }
  });
});

ipcMain.on('btn-deleteName', (event, value) => {
  fs.readFile(jsonFilePath, 'utf8', (err, data) => {
    if (err) {
      sendLog(win,'APP', 'FAILED', `Error reading file from disk when deleting name ${value}: ${err.message}`)
    } else {
      let appNames = JSON.parse(data);
      appNames = appNames.filter(appName => appName.name !== value);   
      saveListData(appNames,`Deleted ${value}`,event,"OK");
      sendLog(win,'APP', 'DELETED', `Deleted ${value}`);
    }    
  });
});

ipcMain.on('save-list', (event,data) => {  
  saveListData(data,'saved',event);
});

function saveListData(list, message, event, status) {
  fs.writeFile(jsonFilePath, JSON.stringify(list, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file to disk: ${err.message}`);
    } else {
      event.sender.send('load-saved-list',{status: status ,message: message, data: list});
    }
  });
}

//open websocket for eventsub 
function openWebSocketEvent(accessToken,broadcasterId) {
  ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30');
  ws.on('open', function open() {
    sendLog(win,'WEB','OK', 'WebSocket EVENTSUB connection opened' );
  });
  ws.on('message', async(event) => {
    const data = JSON.parse(event);
    const metadata = data.metadata;
    const payload = data.payload;
    if (metadata.message_type === 'session_welcome') {     
      createEventSubSubscription(payload.session.id, accessToken, broadcasterId);
    } 

    if(metadata.subscription_type==='stream.online' && payload.subscription.type === 'stream.online'){
      sendLog(win,'STREAMING', 'INFO', `${username} went live at ${payload.event.started_at}`);
      currentStreamingState.status = true;    
    }

    if(metadata.subscription_type==='stream.offline' && payload.subscription.type === 'stream.offline'){
      sendLog(win,'STREAMING', 'INFO', `${username} went offline at ${payload.subscription.created_at}`);
      currentStreamingState.status = false;    
    }
 
    if(metadata.subscription_type==='channel.update' && payload.subscription.type === 'channel.update'){
      console.log('Stream info got updated, current category:', payload.event.category_name);
      sendLog(win,'STREAMING', 'INFO', `Stream info got updated, current category: ${payload.event.category_name}`); 
    }
  });

  ws.on('error', (err) =>{
    console.error('WebSocket error:', err);
  });

  ws.on('close', (code, reason) =>{
    console.log('WebSocket connection closed:', code, reason.toString());
  });

}


 function closeWebSocket() {
  if (ws) {
    ws.close();
  }
}

const createEventSubSubscription = async (sessionID,accessToken,broadcasterId) => {
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
    if(response.status === 202){
      sendLog(win,'WEB', 'OK', `EventSub subscription created for type: ${type.name}` );
    } else {
      console.log('Error creating EventSub subscription:', response);
      sendLog(win,'WEB', 'FAILED', `Error creating EventSub subscription for type: ${type.name}` );
    }   
  }
};
