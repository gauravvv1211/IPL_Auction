import axios from 'axios';
import fs from 'fs';
import path from 'path';

const GITHUB_PLAYERS_URL = 'https://raw.githubusercontent.com/BhargavA29/guess-the-player/main/public/data/players.json';
const OUTPUT_FILE = path.join(process.cwd(), 'github-players.json');

async function fetchGitHubPlayers() {
  try {
    console.log('Fetching players from GitHub repository...');
    const response = await axios.get(GITHUB_PLAYERS_URL);
    const players = response.data;
    
    console.log(`Found ${players.length} players in GitHub repository`);
    
    // Extract player names and image URLs
    const playerImageMap = {};
    players.forEach(player => {
      if (player.name && player.image) {
        playerImageMap[player.name] = player.image;
      }
    });
    
    console.log(`Found ${Object.keys(playerImageMap).length} players with images`);
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(playerImageMap, null, 2));
    console.log(`Saved player image map to ${OUTPUT_FILE}`);
    
    return playerImageMap;
  } catch (error) {
    console.error('Error fetching GitHub players:', error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchGitHubPlayers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default fetchGitHubPlayers;
