import { RULES } from "../data/auctionRules.js";
import { teams } from "../data/teams.js";
import { shuffle } from "./helpers.js";

const essentialRoleMissing = (squad, role) => {
  if (role === "WK") {
    return squad.filter((player) => player.role === "WK").length < 1;
  }

  if (role === "BOWL") {
    return squad.filter((player) => ["BOWL", "AR"].includes(player.role)).length < 4;
  }

  if (role === "BAT") {
    return squad.filter((player) => ["BAT", "WK"].includes(player.role)).length < 5;
  }

  return false;
};

const rolePoolPlan = {
  keepers: { minimum: 2, softMax: 3, hardMax: 3 },
  batsmen: { minimum: 4, softMax: 4, hardMax: 5 },
  allrounders: { minimum: 3, softMax: 4, hardMax: 5 },
  pacers: { minimum: 4, softMax: 5, hardMax: 6 },
  spinners: { minimum: 1, softMax: 2, hardMax: 3 },
};
const reserveBudgetPerSlot = 4;

const getRolePoolCount = (squad, rolePool) =>
  squad.filter((player) => player.rolePool === rolePool).length;

const getFutureRolePoolReserve = (squad, currentRolePool) => {
  const currentIndex = RULES.rolePoolOrder.indexOf(currentRolePool);

  if (currentIndex < 0) {
    return 0;
  }

  return RULES.rolePoolOrder.slice(currentIndex + 1).reduce((reserve, rolePool) => {
    const minimum = rolePoolPlan[rolePool]?.minimum ?? 0;
    return reserve + Math.max(0, minimum - getRolePoolCount(squad, rolePool));
  }, 0);
};

const canBuyFromCurrentPool = ({ player, squad }) => {
  const plan = rolePoolPlan[player.rolePool];

  if (!plan) {
    return true;
  }

  const currentPoolCount = getRolePoolCount(squad, player.rolePool);
  if (currentPoolCount >= plan.hardMax) {
    return false;
  }

  const futureReserve = getFutureRolePoolReserve(squad, player.rolePool);
  const openSlotsAfterPurchase = RULES.maxSquadSize - (squad.length + 1);
  return openSlotsAfterPurchase >= futureReserve;
};

export const shouldAIBid = ({
  team,
  player,
  currentBid,
  budget,
  squad,
  progress,
}) => {
  if (!team || budget < currentBid + RULES.aiBidIncrement || squad.length >= RULES.maxSquadSize) {
    return false;
  }

  if (!canBuyFromCurrentPool({ player, squad })) {
    return false;
  }

  const personality = team.aiPersonality;

  if (
    budget < 10 &&
    !essentialRoleMissing(squad, player.role) &&
    !(player.role === "AR" && squad.filter((member) => member.role === "AR").length < 2)
  ) {
    return false;
  }

  let ceiling = getAIBidCeiling({
    team,
    player,
    budget,
    squad,
    progress,
  });

  return currentBid + RULES.aiBidIncrement <= ceiling;
};

export const getAIBidCeiling = ({
  team,
  player,
  budget,
  squad,
  progress,
}) => {
  if (!team || budget < player.basePrice || squad.length >= RULES.maxSquadSize) {
    return 0;
  }

  if (!canBuyFromCurrentPool({ player, squad })) {
    return 0;
  }

  const currentPoolPlan = rolePoolPlan[player.rolePool];
  const currentPoolCount = getRolePoolCount(squad, player.rolePool);
  const futureReserveSlots = getFutureRolePoolReserve(squad, player.rolePool);
  const futureBudgetReserve = futureReserveSlots * reserveBudgetPerSlot;
  const currentPoolReserveSlots = Math.max(
    0,
    (currentPoolPlan?.minimum ?? 0) - (currentPoolCount + 1),
  );
  const currentPoolBudgetReserve = currentPoolReserveSlots * reserveBudgetPerSlot;
  const spendableBudget = budget - futureBudgetReserve - currentPoolBudgetReserve;

  if ((futureReserveSlots > 0 || currentPoolReserveSlots > 0) && spendableBudget < player.basePrice) {
    return 0;
  }

  const personality = team.aiPersonality;

  if (
    budget < 10 &&
    !essentialRoleMissing(squad, player.role) &&
    !(player.role === "AR" && squad.filter((member) => member.role === "AR").length < 2)
  ) {
    return 0;
  }

  let ceiling = Math.max(player.marketValue, player.basePrice) * personality.maxMultiplier;

  if (personality.preferredRoles.includes(player.role)) {
    ceiling *= 1.1;
  } else if (personality.preferredRoles.length) {
    ceiling *= 0.8;
  }

  if (personality.preferredPool && personality.preferredPool === player.rolePool) {
    ceiling *= 1.1;
  }

  if (personality.preferredNationality !== "any" && personality.preferredNationality === player.nationality) {
    ceiling *= 1.08;
  }

  if (personality.preferredTier && personality.preferredTier === player.tier) {
    ceiling *= 1.12;
  }

  if (personality.preferExperience && ["Icon", "Star"].includes(player.tier)) {
    ceiling *= 1.1;
  }

  if (essentialRoleMissing(squad, "WK") && player.role === "WK") {
    ceiling *= 1.3;
  }

  if (essentialRoleMissing(squad, "BOWL") && player.role === "BOWL") {
    ceiling *= 1.2;
  }

  if (essentialRoleMissing(squad, "BAT") && player.role === "BAT") {
    ceiling *= 1.2;
  }

  const poolPlan = rolePoolPlan[player.rolePool];
  const rolePoolCount = currentPoolCount;
  if (poolPlan && rolePoolCount < poolPlan.minimum) {
    ceiling *= 1.35;
  }

  if (poolPlan && rolePoolCount >= poolPlan.softMax) {
    ceiling *= progress > 0.75 ? 0.88 : 0.68;
  }

  if (team.id === "PBKS" && progress < 0.4) {
    ceiling *= 1.2;
  }

  if (personality.recklessEarly && progress < 0.35 && ["Icon", "Star"].includes(player.tier)) {
    ceiling *= 1.12;
  }

  if (personality.budgetCautious && progress < 0.45) {
    ceiling *= 0.95;
  }

  return Math.min(
    ceiling,
    futureReserveSlots > 0 || currentPoolReserveSlots > 0 ? spendableBudget : budget,
  );
};

const roundToIncrement = (amount) =>
  Number((Math.ceil(amount / RULES.aiBidIncrement) * RULES.aiBidIncrement).toFixed(2));

export const simulateAIAuctionOutcome = ({
  player,
  currentBid = player.basePrice,
  aiBudgets,
  aiSquads,
  excludedTeamId,
  progress,
}) => {
  const bidders = teams
    .filter((team) => team.id !== excludedTeamId)
    .map((team) => ({
      team,
      ceiling: getAIBidCeiling({
        team,
        player,
        budget: aiBudgets[team.id] ?? 0,
        squad: aiSquads[team.id] ?? [],
        progress,
      }),
    }))
    .filter(({ ceiling }) => ceiling >= currentBid);

  if (!bidders.length) return null;

  bidders.sort((left, right) => right.ceiling - left.ceiling);
  const winner = bidders[0];
  const runnerUp = bidders[1];
  const amount = roundToIncrement(
    Math.min(winner.ceiling, Math.max(currentBid, (runnerUp?.ceiling ?? player.basePrice) + RULES.aiBidIncrement)),
  );

  return {
    teamId: winner.team.id,
    amount: Math.min(amount, winner.ceiling),
  };
};

export const prepareAuction = ({ players, selectedTeamId, humanRetentions }) => {
  const humanRetentionIds = new Set(humanRetentions.map(({ player }) => player.id));
  const aiRetentions = {};
  const aiSquads = {};
  const aiBudgets = {};
  const retainedIds = new Set(humanRetentionIds);

  teams
    .filter((team) => team.id !== selectedTeamId)
    .forEach((team) => {
      const teamRetentions = players
        .filter((player) => player.team2025 === team.id)
        .sort((left, right) => right.marketValue - left.marketValue)
        .slice(0, 2)
        .map((player, index) => ({
          ...player,
          ownedBy: team.id,
          pricePaid: RULES.retentionCosts[index],
          acquisition: `Retention ${index + 1}`,
        }));

      aiRetentions[team.id] = teamRetentions;
      aiSquads[team.id] = teamRetentions;
      aiBudgets[team.id] = RULES.startingPurse - RULES.retentionCosts[0] - RULES.retentionCosts[1];
      teamRetentions.forEach((player) => retainedIds.add(player.id));
    });

  const auctionQueue = RULES.poolOrder.flatMap((poolKey) =>
    shuffle(players.filter((player) => player.poolKey === poolKey && !retainedIds.has(player.id))),
  );

  return {
    aiRetentions,
    aiSquads,
    aiBudgets,
    auctionQueue,
  };
};
