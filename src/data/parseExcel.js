import * as XLSX from "xlsx";

const TEAM_IDS = ["MI", "CSK", "RCB", "KKR", "SRH", "DC", "GT", "PBKS", "RR", "LSG"];

// Load player images mapping
let playerImages = {};

// Function to load player images
export async function loadPlayerImages() {
  try {
    const response = await fetch('/playerImages.json');
    if (response.ok) {
      playerImages = await response.json();
      console.log('Player images loaded:', Object.keys(playerImages).length);
    }
  } catch (error) {
    console.warn('Could not load player images:', error);
  }
}

const SPINNER_NAME_HINTS = [
  "chahal",
  "rashid",
  "narine",
  "axar",
  "kuldeep",
  "ravi bishnoi",
  "varun",
  "noor",
  "mujeeb",
  "ashwin",
  "jadeja",
  "tahir",
  "gowtham",
  "santner",
  "hasaranga",
];

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeSheetName = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, "");

const parseMoney = (value, fallback = null) => {
  const normalized = normalizeText(value);

  if (!normalized || normalized === "-") {
    return fallback;
  }

  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : fallback;
};

const deriveRolePool = (role, name) => {
  if (role === "WK") return "keepers";
  if (role === "BAT") return "batsmen";
  if (role === "AR") return "allrounders";

  const normalizedName = normalizeText(name);
  const isSpinner = SPINNER_NAME_HINTS.some((hint) => normalizedName.includes(hint));
  return isSpinner ? "spinners" : "pacers";
};

const derivePlayerSegment = (nationality, tier) => {
  if (nationality === "Overseas") return "Overseas";
  if (nationality === "Indian" && tier === "Budget") return "Uncapped";
  return "Indian";
};

const findSheet = (workbook, requestedName) => {
  const requested = normalizeSheetName(requestedName);
  const exact = workbook.SheetNames.find((sheetName) => normalizeSheetName(sheetName) === requested);

  if (exact) {
    return workbook.Sheets[exact];
  }

  const fuzzy = workbook.SheetNames.find((sheetName) => normalizeSheetName(sheetName).includes(requested));
  return fuzzy ? workbook.Sheets[fuzzy] : null;
};

const readWorkbook = async (source) => {
  if (source instanceof File || source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    return XLSX.read(buffer, { type: "array" });
  }

  if (source instanceof ArrayBuffer) {
    return XLSX.read(source, { type: "array" });
  }

  const response = await fetch(source);

  if (!response.ok) {
    throw new Error(`Could not load workbook from ${source}`);
  }

  const buffer = await response.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
};

const mapPlayer = (row, index) => {
  const role = String(row.Role ?? "").trim();
  const name = String(row["Player Name"] ?? "").trim();
  const team2025 = String(row["Team (2025)"] ?? "").trim();
  const nationality = String(row.Nationality ?? "").trim();
  const tier = String(row.Tier ?? "").trim();
  const rolePool = deriveRolePool(role, name);
  const playerSegment = derivePlayerSegment(nationality, tier);

  return {
    id: index + 1,
    name,
    role,
    nationality,
    tier,
    team2025,
    basePrice: parseMoney(row["Base Price (Cr)"], 2),
    soldPrice: team2025 === "Unsold/TBA" ? null : parseMoney(row["Sold Price (Cr)"], null),
    marketValue: parseMoney(row["Market Value (Cr)"], 0),
    pool: rolePool,
    rolePool,
    playerSegment,
    poolKey: `${playerSegment}-${rolePool}`,
    poolLabel: `${playerSegment} ${rolePool}`,
    currentBidder: null,
    currentBid: null,
    ownedBy: null,
    image: playerImages[name] || "/players/player-placeholder.png",
  };
};

const buildTeamRosters = (rows) =>
  rows.reduce(
    (rosters, row) => {
      const teamId = String(row["Team (2025)"] ?? "").trim();
      const playerName = String(row["Player Name"] ?? "").trim();

      if (TEAM_IDS.includes(teamId) && playerName) {
        rosters[teamId].push(playerName);
      }

      return rosters;
    },
    Object.fromEntries(TEAM_IDS.map((teamId) => [teamId, []])),
  );

export const parseAuctionWorkbook = async (source = "/IPL_2025_Auction_GameData.xlsx") => {
  try {
    const workbook = await readWorkbook(source);
    const allPlayersSheet = findSheet(workbook, "All Players");
    const soldByTeamSheet = findSheet(workbook, "Sold by Team");

    if (!allPlayersSheet || !soldByTeamSheet) {
      throw new Error('Workbook must include "All Players" and "Sold by Team" sheets.');
    }

    const playerRows = XLSX.utils.sheet_to_json(allPlayersSheet, { defval: "" });
    const soldRows = XLSX.utils.sheet_to_json(soldByTeamSheet, { defval: "" });

    return {
      players: playerRows.map(mapPlayer),
      teamRosters: buildTeamRosters(soldRows),
    };
  } catch (error) {
    throw new Error("Could not read Excel file. Please re-upload.", { cause: error });
  }
};

export { TEAM_IDS };
