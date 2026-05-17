import { teams } from "../data/teams.js";
import { countOverseas, getVerdict } from "./helpers.js";

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const clamp = (value) => Math.max(0, Math.min(100, value));

const spendFor = (player) => player.pricePaid ?? player.soldPrice ?? player.marketValue ?? player.basePrice ?? 0;

const calculateStrategyAlignment = (squad, strategy) => {
  const totalSpend = squad.reduce((total, player) => total + spendFor(player), 0) || 1;
  const spendByRole = squad.reduce((totals, player) => {
    totals[player.role] = (totals[player.role] ?? 0) + spendFor(player);
    return totals;
  }, {});

  switch (strategy) {
    case "Batting Fortress":
      return clamp((((spendByRole.BAT ?? 0) + (spendByRole.WK ?? 0)) / totalSpend) * 180);
    case "Bowling Arsenal":
      return clamp(((spendByRole.BOWL ?? 0) / totalSpend) * 220);
    case "Balanced Beast": {
      const highestShare = Math.max(...Object.values(spendByRole).map((value) => value / totalSpend), 0);
      return clamp((1 - Math.max(0, highestShare - 0.45)) * 100);
    }
    case "All-rounder Heavy":
      return clamp((squad.filter((player) => player.role === "AR").length / 5) * 100);
    case "Budget Assassin":
      return clamp((squad.filter((player) => spendFor(player) < player.marketValue).length / squad.length) * 140);
    default:
      return 0;
  }
};

const calculateSingleTeamScores = ({ squad, xi, strategy, retentions, selectedTeam }) => {
  const battingValues = xi
    .filter((player) => ["BAT", "WK"].includes(player.role))
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 6)
    .map((player) => player.marketValue);
  let batting = clamp((average(battingValues) / 20) * 100);

  const bowlingGroup = xi.filter((player) => ["BOWL", "AR"].includes(player.role));
  let bowling = clamp((average(bowlingGroup.map((player) => player.marketValue)) / 15) * 100);

  if (bowlingGroup.length < 3) bowling *= 0.7;
  if (strategy === "Batting Fortress") batting = clamp(batting * 1.15);
  if (strategy === "Bowling Arsenal") bowling = clamp(bowling * 1.15);

  const wkCount = xi.filter((player) => player.role === "WK").length;
  const bowlerCount = xi.filter((player) => ["BOWL", "AR"].includes(player.role)).length;
  const battingCount = xi.filter((player) => ["BAT", "WK"].includes(player.role)).length;
  const arCount = xi.filter((player) => player.role === "AR").length;
  const overseasCount = countOverseas(xi);
  let balance =
    (wkCount >= 1 ? 20 : 0) +
    (bowlerCount >= 3 ? 20 : 0) +
    (battingCount >= 5 ? 20 : 0) +
    (arCount >= 2 ? 20 : 0) +
    (overseasCount <= 4 ? 20 : 0);

  if (strategy === "Balanced Beast") balance = clamp(balance * 1.1);
  if (strategy === "All-rounder Heavy" && squad.filter((player) => player.role === "AR").length >= 5) {
    balance = clamp(balance * 1.15);
  }

  const valueRatios = squad.map((player) => player.marketValue / Math.max(spendFor(player), 0.25));
  let value = clamp(average(valueRatios) * 70);
  if (strategy === "Budget Assassin") value = clamp(value * 1.2);

  let chemistry = 50 + Math.min(retentions.length, 3) * 5;
  if (selectedTeam.identity === "batting-heavy" && batting > 70) chemistry += 10;
  if (
    selectedTeam.identity === "pace-first" &&
    xi.filter((player) => player.pool === "pacers").length >= 3
  ) {
    chemistry += 10;
  }
  if (selectedTeam.identity === "all-rounder" && squad.filter((player) => player.role === "AR").length >= 4) {
    chemistry += 10;
  }
  if (selectedTeam.identity === "youth" && squad.filter((player) => player.tier === "Budget").length >= 3) {
    chemistry += 10;
  }
  if (overseasCount === 4) chemistry += 5;
  chemistry = clamp(chemistry);

  const strategyAlignment = calculateStrategyAlignment(squad, strategy);
  const scores = {
    batting: Math.round(batting),
    bowling: Math.round(bowling),
    balance: Math.round(balance),
    value: Math.round(value),
    chemistry: Math.round(chemistry),
    strategy: Math.round(strategyAlignment),
  };

  const overall = Math.round(
    scores.batting * 0.2 +
      scores.bowling * 0.2 +
      scores.balance * 0.2 +
      scores.value * 0.15 +
      scores.chemistry * 0.1 +
      scores.strategy * 0.15,
  );

  return {
    scores,
    overall,
    verdict: getVerdict(overall),
  };
};

const buildAIXI = (squad) =>
  [...squad]
    .sort((left, right) => right.marketValue - left.marketValue)
    .slice(0, 11);

export const calculateScores = ({
  mySquad,
  myXI,
  strategy,
  retentions,
  selectedTeam,
  aiSquads,
  aiRetentions,
}) => {
  const humanResult = calculateSingleTeamScores({
    squad: mySquad,
    xi: myXI,
    strategy,
    retentions,
    selectedTeam,
  });

  const rivalScores = teams.map((team) => {
    if (team.id === selectedTeam.id) {
      return {
        team,
        overall: humanResult.overall,
        verdict: humanResult.verdict,
        biggestBuy: [...mySquad].sort((left, right) => spendFor(right) - spendFor(left))[0],
        boughtPlayers: [...mySquad].sort((left, right) => spendFor(right) - spendFor(left)),
        isHuman: true,
      };
    }

    const squad = aiSquads[team.id] ?? [];
    const boughtPlayers = squad.filter((player) => player.acquisition === "Auction");
    const result = calculateSingleTeamScores({
      squad,
      xi: buildAIXI(squad),
      strategy: "Balanced Beast",
      retentions: aiRetentions[team.id] ?? [],
      selectedTeam: team,
    });

    return {
      team,
      overall: result.overall,
      verdict: result.verdict,
      biggestBuy: [...squad].sort((left, right) => spendFor(right) - spendFor(left))[0],
      boughtPlayers: [...boughtPlayers].sort((left, right) => spendFor(right) - spendFor(left)),
      isHuman: false,
    };
  });

  return {
    ...humanResult,
    rivalScores: rivalScores.sort((left, right) => right.overall - left.overall),
  };
};
