import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXCEL_FILE = path.join(process.cwd(), 'public', 'IPL_2025_Auction_GameData.xlsx');
const GITHUB_PLAYERS_FILE = path.join(process.cwd(), 'github-players.json');
const OUTPUT_FILE = path.join(process.cwd(), 'player-image-mapping.json');

// Normalize player name for matching
function normalizePlayerName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Generate variations of player name for matching
function generateNameVariations(name) {
  const variations = new Set();
  const normalized = normalizePlayerName(name);
  
  // Add original normalized
  variations.add(normalized);
  
  // Add without spaces
  variations.add(normalized.replace(/\s+/g, '-'));
  variations.add(normalized.replace(/\s+/g, ''));
  
  // Handle initials (e.g., "AB de Villiers" -> "ab de villiers", "ab-de-villiers")
  const parts = normalized.split(' ');
  if (parts.length > 2) {
    // Try first initial + last name
    variations.add(`${parts[0][0]} ${parts.slice(1).join(' ')}`);
    variations.add(`${parts[0][0]}-${parts.slice(1).join('-')}`);
  }
  
  // Handle common name variations
  const commonReplacements = {
    'de villiers': 'devilliers',
    'van der dussen': 'vanderdussen',
    'ben stokes': 'stokes',
    'jofra archer': 'archer',
    'kagiso rabada': 'rabada',
    'david warner': 'warner',
    'steve smith': 'smith',
    'kane williamson': 'williamson',
    'joe root': 'root',
    'jos buttler': 'buttler',
    'glenn maxwell': 'maxwell',
    'hardik pandya': 'pandya',
    'ravindra jadeja': 'jadeja',
    'jasprit bumrah': 'bumrah',
    'virat kohli': 'kohli',
    'rohit sharma': 'sharma',
    'ms dhoni': 'dhoni',
    'suresh raina': 'raina',
    'gautam gambhir': 'gambhir',
    'yuvraj singh': 'singh',
    'harbhajan singh': 'singh',
    'zaheer khan': 'khan',
    'ishant sharma': 'sharma',
    'mohammed shami': 'shami',
    'umesh yadav': 'yadav',
    'bhuvneshwar kumar': 'kumar',
    'r ashwin': 'ashwin',
    'rashid khan': 'khan',
    'mujeeb ur rahman': 'mujeeb',
    'rashid khan': 'rashid',
  };
  
  Object.entries(commonReplacements).forEach(([key, value]) => {
    if (normalized.includes(key)) {
      variations.add(normalized.replace(key, value));
    }
  });
  
  return Array.from(variations);
}

// Find best match for a player name in GitHub data
function findBestMatch(playerName, githubPlayers) {
  const variations = generateNameVariations(playerName);
  
  for (const variation of variations) {
    // Direct match
    if (githubPlayers[variation]) {
      return { name: variation, url: githubPlayers[variation], matchType: 'direct' };
    }
    
    // Partial match (check if variation is contained in any key)
    for (const githubName of Object.keys(githubPlayers)) {
      const normalizedGithub = normalizePlayerName(githubName);
      if (normalizedGithub.includes(variation) || variation.includes(normalizedGithub)) {
        return { name: githubName, url: githubPlayers[githubName], matchType: 'partial' };
      }
    }
  }
  
  return null;
}

async function matchPlayers() {
  try {
    console.log('Reading Excel file...');
    const fileBuffer = fs.readFileSync(EXCEL_FILE);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('all players')
    );
    
    if (!sheetName) {
      throw new Error('Sheet "All Players" not found in Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
    console.log(`Found ${rows.length} players in Excel file`);
    
    console.log('Reading GitHub players data...');
    const githubPlayersData = fs.readFileSync(GITHUB_PLAYERS_FILE, 'utf-8');
    const githubPlayers = JSON.parse(githubPlayersData);
    
    console.log(`Found ${Object.keys(githubPlayers).length} players in GitHub data`);
    
    // Match players
    const playerImageMapping = {};
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    rows.forEach(row => {
      const playerName = String(row['Player Name'] || '').trim();
      if (!playerName) return;
      
      const match = findBestMatch(playerName, githubPlayers);
      
      if (match) {
        playerImageMapping[playerName] = {
          url: match.url,
          githubName: match.name,
          matchType: match.matchType
        };
        matchedCount++;
        console.log(`✓ Matched: ${playerName} -> ${match.name} (${match.matchType})`);
      } else {
        playerImageMapping[playerName] = {
          url: null,
          githubName: null,
          matchType: 'none'
        };
        unmatchedCount++;
        console.log(`✗ No match: ${playerName}`);
      }
    });
    
    console.log(`\nMatching complete:`);
    console.log(`  Matched: ${matchedCount}`);
    console.log(`  Unmatched: ${unmatchedCount}`);
    console.log(`  Total: ${rows.length}`);
    
    // Save mapping
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(playerImageMapping, null, 2));
    console.log(`\nSaved player image mapping to ${OUTPUT_FILE}`);
    
    return playerImageMapping;
  } catch (error) {
    console.error('Error matching players:', error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  matchPlayers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default matchPlayers;
