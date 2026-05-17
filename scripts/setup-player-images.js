import fetchGitHubPlayers from './fetch-github-players.js';
import matchPlayers from './match-players.js';
import downloadPlayerImages from './download-images.js';

async function setupPlayerImages() {
  console.log('=== IPL Player Image Setup ===\n');
  
  try {
    // Step 1: Fetch GitHub players
    console.log('Step 1: Fetching GitHub players...');
    await fetchGitHubPlayers();
    console.log('');
    
    // Step 2: Match players
    console.log('Step 2: Matching Excel players with GitHub data...');
    await matchPlayers();
    console.log('');
    
    // Step 3: Download images
    console.log('Step 3: Downloading player images...');
    await downloadPlayerImages();
    console.log('');
    
    console.log('=== Setup Complete ===');
    console.log('Player images have been successfully integrated!');
    console.log('Check src/data/playerImages.json for the image mapping.');
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

setupPlayerImages();
