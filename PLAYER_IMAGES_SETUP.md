# Player Images Integration Setup

This document describes the player image integration system for the IPL Auction Simulator.

## Overview

The system automatically fetches player images from the GitHub repository [BhargavA29/guess-the-player](https://github.com/BhargavA29/guess-the-player) and integrates them with your Excel player data.

## What Was Created

### Scripts Directory (`scripts/`)
- `fetch-github-players.js` - Fetches player data from GitHub repository
- `match-players.js` - Matches Excel players with GitHub player images
- `download-images.js` - Downloads matched images to local directory
- `setup-player-images.js` - Master script that runs all steps

### Updated Files
- `src/data/parseExcel.js` - Updated to include image field in player objects
- `src/utils/getPlayerImage.js` - New utility function for getting player images
- `src/data/playerImages.json` - Generated mapping of player names to image paths

### New Directory
- `public/players/` - Contains downloaded player images (226 images)
- `public/players/player-placeholder.png` - Default placeholder for missing images

## Usage

### Initial Setup (Already Done)
Run the setup script to fetch and integrate player images:
```bash
node scripts/setup-player-images.js
```

### In Your React Components

Import the utility function:
```javascript
import { getPlayerImage } from './utils/getPlayerImage';
```

Get player image:
```javascript
const imageUrl = getPlayerImage("Virat Kohli");
// Returns: "/players/virat-kohli.png" or "/players/player-placeholder.png"
```

### Direct Access from Player Data

Since `parseExcel.js` now includes the `image` field, you can directly access it:
```javascript
const { players } = await parseAuctionWorkbook();
const firstPlayer = players[0];
console.log(firstPlayer.image); // "/players/player-name.png"
```

## Statistics

- **Total Players in Excel**: 620
- **Players with Images Downloaded**: 226
- **Players Using Placeholder**: 394
- **Image Source**: IPL official headshots from iplt20.com

## How It Works

1. **Fetch GitHub Data**: Downloads player data from the guess-the-player repository
2. **Match Players**: Uses intelligent name matching (case-insensitive, handles initials, common variations)
3. **Download Images**: Downloads matched images to `public/players/` with clean filenames
4. **Generate Mapping**: Creates `playerImages.json` for quick lookup
5. **Integration**: Updates `parseExcel.js` to automatically include image paths

## Updating Images

To update player images in the future:
```bash
node scripts/setup-player-images.js
```

This will:
- Fetch the latest player data from GitHub
- Re-match players with your Excel file
- Download any new images
- Update the mapping file

## Custom Image Matching

If you want to manually add images for players that couldn't be matched:

1. Add your image to `public/players/` with the format: `player-name.png`
2. Update `src/data/playerImages.json` to include the mapping:
```json
{
  "Player Name": "/players/player-name.png"
}
```

## Troubleshooting

### Images Not Showing
- Ensure `public/players/` directory exists
- Check that `playerImages.json` exists in `src/data/`
- Verify the image paths in the JSON file

### Placeholder Images
- Some players may not have images in the GitHub repository
- These will automatically use the placeholder image
- You can manually add images for these players if needed

### Re-running Setup
- The setup script skips already downloaded images
- To force re-download, delete images from `public/players/` first
- Then run the setup script again

## File Structure

```
CricAuction/
├── public/
│   ├── players/
│   │   ├── virat-kohli.png
│   │   ├── rohit-sharma.png
│   │   ├── player-placeholder.png
│   │   └── ... (226 images)
│   └── IPL_2025_Auction_GameData.xlsx
├── src/
│   ├── data/
│   │   ├── parseExcel.js (updated)
│   │   └── playerImages.json (generated)
│   └── utils/
│       └── getPlayerImage.js (new)
└── scripts/
    ├── fetch-github-players.js
    ├── match-players.js
    ├── download-images.js
    └── setup-player-images.js
```

## Notes

- The system handles name variations automatically (e.g., "MS Dhoni" matches "ms-dhoni")
- Images are downloaded from official IPL sources (iplt20.com)
- The placeholder image is used for players without available images
- The system is non-destructive - it won't break your existing project structure
