import axios from 'axios';
import fs from 'fs';
import path from 'path';

const MAPPING_FILE = path.join(process.cwd(), 'player-image-mapping.json');
const PLAYERS_DIR = path.join(process.cwd(), 'public', 'players');
const DEFAULT_IMAGE_URL = 'https://raw.githubusercontent.com/BhargavA29/guess-the-player/main/public/images/player-silhouette.svg';

// Create players directory if it doesn't exist
if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
  console.log(`Created directory: ${PLAYERS_DIR}`);
}

// Convert player name to filename
function playerNameToFilename(playerName) {
  return playerName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    + '.png';
}

// Download image with retry logic
async function downloadImage(url, filepath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000
      });
      
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`  Attempt ${attempt} failed for ${url}:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function downloadPlayerImages() {
  try {
    console.log('Reading player image mapping...');
    const mappingData = fs.readFileSync(MAPPING_FILE, 'utf-8');
    const mapping = JSON.parse(mappingData);
    
    console.log(`Found ${Object.keys(mapping).length} players in mapping`);
    
    let downloadedCount = 0;
    let failedCount = 0;
    let defaultUsedCount = 0;
    
    // Download default placeholder image
    const defaultImagePath = path.join(PLAYERS_DIR, 'player-placeholder.png');
    try {
      console.log('Downloading default placeholder image...');
      await downloadImage(DEFAULT_IMAGE_URL, defaultImagePath);
      console.log('✓ Downloaded default placeholder image');
    } catch (error) {
      console.error('✗ Failed to download default placeholder:', error.message);
    }
    
    // Download player images
    for (const [playerName, imageData] of Object.entries(mapping)) {
      const filename = playerNameToFilename(playerName);
      const filepath = path.join(PLAYERS_DIR, filename);
      
      // Skip if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`⊘ Skipping existing: ${playerName}`);
        downloadedCount++;
        continue;
      }
      
      if (imageData.url) {
        try {
          console.log(`Downloading: ${playerName} -> ${filename}`);
          await downloadImage(imageData.url, filepath);
          console.log(`✓ Downloaded: ${playerName}`);
          downloadedCount++;
        } catch (error) {
          console.error(`✗ Failed to download ${playerName}:`, error.message);
          failedCount++;
        }
      } else {
        console.log(`○ No image URL for: ${playerName} (will use placeholder)`);
        defaultUsedCount++;
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\nDownload complete:`);
    console.log(`  Downloaded: ${downloadedCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log(`  Will use placeholder: ${defaultUsedCount}`);
    console.log(`  Total: ${Object.keys(mapping).length}`);
    
    // Create index file for quick lookup
    const imageIndex = {};
    for (const [playerName, imageData] of Object.entries(mapping)) {
      const filename = playerNameToFilename(playerName);
      const filepath = path.join(PLAYERS_DIR, filename);
      
      if (fs.existsSync(filepath)) {
        imageIndex[playerName] = `/players/${filename}`;
      } else {
        imageIndex[playerName] = '/players/player-placeholder.png';
      }
    }
    
    const indexFile = path.join(process.cwd(), 'src', 'data', 'playerImages.json');
    fs.writeFileSync(indexFile, JSON.stringify(imageIndex, null, 2));
    console.log(`\nCreated image index at ${indexFile}`);
    
  } catch (error) {
    console.error('Error downloading images:', error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadPlayerImages()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default downloadPlayerImages;
