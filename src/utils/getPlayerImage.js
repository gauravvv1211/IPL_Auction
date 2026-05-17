import playerImages from '../data/playerImages.json';

/**
 * Get the image URL for a player by name
 * @param {string} playerName - The name of the player
 * @returns {string} - The image path for the player
 */
export function getPlayerImage(playerName) {
  if (!playerName) {
    return '/players/player-placeholder.png';
  }
  
  // Try exact match first
  if (playerImages[playerName]) {
    return playerImages[playerName];
  }
  
  // Try case-insensitive match
  const lowerCaseName = playerName.toLowerCase();
  for (const [name, imagePath] of Object.entries(playerImages)) {
    if (name.toLowerCase() === lowerCaseName) {
      return imagePath;
    }
  }
  
  // Return placeholder if no match found
  return '/players/player-placeholder.png';
}

/**
 * Get all available player images
 * @returns {Object} - Object mapping player names to image paths
 */
export function getAllPlayerImages() {
  return playerImages;
}

/**
 * Check if a player has a custom image
 * @param {string} playerName - The name of the player
 * @returns {boolean} - True if the player has a custom image
 */
export function hasCustomImage(playerName) {
  if (!playerName) {
    return false;
  }
  
  const imagePath = getPlayerImage(playerName);
  return imagePath !== '/players/player-placeholder.png';
}

export default getPlayerImage;
