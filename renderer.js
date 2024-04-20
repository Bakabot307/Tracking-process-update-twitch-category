

/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

const listApps = document.getElementById('listApps')
const logs = document.getElementById('logs')
const btnOpenList = document.getElementById('btn-openList')
const btnLogin = document.getElementById('btn-login')




btnOpenList.addEventListener('click', () => {
  actionCallback('OPEN_LIST');
});

btnLogin.addEventListener('click', function() {
  actionCallback('LOGIN');
});

window.electronAPI.onLoadRunningList((value) => {
  console.log('load list:',value)
  if(value === undefined){
    value = {name: 'No apps running'}
  }
  if(listApps !== null){
    listApps.innerHTML = ''
  }
    const li = document.createElement('div')
    li.textContent = value.name
    listApps.appendChild(li)
});

window.electronAPI.onLog((response) => {
  const li = document.createElement('div')
  if(response.type === 'WEB' && response.status === 'TOKEN_OBTAINED'){
    btnLogin.style.display = 'none';
    actionCallback('DO_STUFF');
  }   
  if(response.type === 'APP' && response.status === 'ACTION_REQUIRED_LOGIN'){
    btnLogin.style.display = 'block';
  }
  li.textContent = `${response.type}: ${response.status} - ${response.message}`
  logs.appendChild(li)
});


function actionCallback(action){
window.electronAPI.onAction(action);
}



