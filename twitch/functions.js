const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const app = express();
const port = 3000;
const path = require('path');

const { sendLog } = require(path.join(__dirname, '../common.js'));
const jsonFilePath = path.join(__dirname, '../datas/tokens.json');

const clientId = 'qarqfcwzn8owibki0nb0hdc0thwfxb';
const clientSecret = 'l39js4ios95bjxstrvsans0cb50wi5';
const redirectUri = 'http://localhost:3000';

function openServer(mainWindow) {
  app.get('/auth', (req, res) => {
    res.redirect(`https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=channel:manage:broadcast+chat:read+chat:edit`);
  });

  app.get('/', async (req, res) => {
    try {
      const code = req.query.code;
      const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        },
      });
      const accessToken = tokenResponse.data.access_token;
      const refreshToken = tokenResponse.data.refresh_token;
      const expirationTime = new Date().getTime() + tokenResponse.data.expires_in * 1000;
      const username = await getUsername(accessToken, clientId);
      const tokens = {
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiredAt: expirationTime
      };
      fs.writeFile(jsonFilePath, JSON.stringify({ username: username, tokens: tokens }, null, 2));
      res.send('Tokens obtained successfully! you can close this window now.');
      sendLog(mainWindow, 'WEB', 'TOKEN_OBTAINED', 'Tokens obtained successfully');
      closeServer(mainWindow);
    } catch (error) {
      sendLog(mainWindow, 'WEB', 'ERROR', 'An error occurred');
      res.status(500).send('An error occurred');
      closeServer(mainWindow);
    }
  });

  const server = app.listen(port, () => {
    sendLog(mainWindow, 'WEB', 'OK', `Server is running on port ${port}`);
  });

  const closeServer = (mainWindow) => {
    server.close();
    sendLog(mainWindow, 'WEB', 'INFO', `Server closed`);
  }
}

async function getUsername(accessToken, clientId) {
  const url = `https://api.twitch.tv/helix/users`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Client-Id': clientId
  };

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (data.data && data.data.length > 0) {
    return data.data[0].login;
  } else {
    throw new Error(`User not found`);
  }
}


module.exports = { openServer };






