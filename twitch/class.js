const axios = require('axios');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const path = require('path');
const filePath = path.join(__dirname, '..', '/datas/tokens.json');
class TwitchClass {
  constructor(accessToken, clientId, clientSecret) {
    this.accessToken = accessToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  static async getTwitchToken() {
    try {
      let data;
      try {
        data = await fs.readFile(filePath, 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.log('File does not exist, creating...');
          await fs.writeFile(filePath, JSON.stringify({}));
          console.log('File is created successfully.');
          data = '{}';
        } else {
          throw err;
        }
      }
      const tokens = JSON.parse(data);
      if (!tokens || Object.keys(tokens).length === 0) {
        console.error('No Twitch token found');
        return null;
      }
      const now = new Date().getTime();
      if (tokens.tokens.expiredAt < now) {
        console.error('Twitch token is expired');
        return { "status": "EXPIRED", "data": tokens };;
      }
      return { "status": "OK", "data": tokens };
    } catch (error) {
      console.error('Error reading Twitch token data:', error.message);
      return null;
    }
  }

  async getBroadcasterId() {
    try {
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId,
      };

      const response = await axios.get('https://api.twitch.tv/helix/users',
        { headers });

      if (response.data.data && response.data.data.length > 0) {
        return response.data.data[0].id;
      } else {
        console.error('No broadcaster ID found');
        return null;
      }
    } catch (error) {
      const status = error.response ? error.response.status : 'N/A';
      if (status === 401) {
        return "EXPIRED"
      }
      console.error('Error fetching broadcaster ID:', error.message);
      throw error;
    }
  }

  static async refreshAccessToken(data, clientId, clientSecret) {
    try {
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.tokens.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const twitchTokenRefreshUrl = 'https://id.twitch.tv/oauth2/token';
      const response = await axios.post(twitchTokenRefreshUrl, refreshParams)
      const tokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiredAt: new Date().getTime() + response.data.expires_in * 1000
      };
      data.tokens = tokens;
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return { status: "OK", tokens: tokens };
    } catch (error) {
      console.error('Error in refreshAccessToken:', error);
      if (error.response.status === 400) {
        return { status: "EXPIRED" };
      }
      console.error('Error in refreshAccessToken:', error);
    }
  }

  async getStreamInfo(broadcasterId) {
    try {
      const response = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': this.clientId,
          'Authorization': `Bearer ${this.accessToken}`
        },
        params: {
          user_id: broadcasterId
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        const stream = response.data.data[0];
        return {
          title: stream.title,
          category: stream.game_name,
          categoryId: stream.game_id
        };
      } else {
        console.error('No active stream found for this broadcaster');
        return null;
      }
    } catch (error) {
      console.error('Error fetching stream info:', error.response.data);
      throw error;
    }
  }
  async getGameId(gameName) {
    const url = `https://api.twitch.tv/helix/games?name=${encodeURIComponent(gameName)}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Client-Id': this.clientId
    };

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0].id;
    } else {
      return null;
    }
  }
  async updateStreamCategory(userId, categoryId) {
    const url = `https://api.twitch.tv/helix/channels?broadcaster_id=${userId}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Client-Id': this.clientId,
      'Content-Type': 'application/json'
    };
    const body = JSON.stringify({
      game_id: categoryId
    });

    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body
    });

    if (response.status === 204) {
      console.log('response:', response.statusText);
      return true;
    }

    const message = `An error has occurred: ${response.message}`;
    console.error(message);
    return false
  }



}

module.exports = TwitchClass;