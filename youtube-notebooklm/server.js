const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Proxy YouTube Data API v3 to keep the API key server-side (optional)
// If YOUTUBE_API_KEY env var is set, clients can call /api/playlist without exposing the key
app.get('/api/playlist', async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // No server-side key — tell the client to use its own key directly
    return res.status(404).json({ error: 'No server API key configured' });
  }

  const { playlistId, pageToken } = req.query;
  if (!playlistId) return res.status(400).json({ error: 'playlistId required' });

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error?.message || resp.statusText);
    res.json(data);
  } catch (err) {
    console.error('YouTube API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`\n✅ YouTube → NotebookLM lancé !\n`);
  console.log(`   Local   : http://localhost:${PORT}`);
  if (localIp) console.log(`   Mobile  : http://${localIp}:${PORT}  (même réseau WiFi)\n`);
  if (!process.env.YOUTUBE_API_KEY) {
    console.log('   💡 Optionnel: définis YOUTUBE_API_KEY pour cacher la clé côté serveur');
    console.log('      YOUTUBE_API_KEY=ta_clé node server.js\n');
  }
});

function getLocalIp() {
  try {
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address;
      }
    }
  } catch { return null; }
}
