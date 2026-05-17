import { useMemo, useState } from "react";
import { RULES } from "../data/auctionRules.js";
import { flagForNationality, formatCr, roleClass, tierClass } from "../utils/helpers.js";
import RTMCard from "./RTMCard.jsx";

function RetentionScreen({ gameState, setGameState }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const rosterNames = gameState.teamRosters[gameState.selectedTeam.id] ?? [];

  const roster = useMemo(
    () =>
      gameState.players
        .filter((player) => rosterNames.includes(player.name))
        .sort((left, right) => right.marketValue - left.marketValue),
    [gameState.players, rosterNames],
  );

  const retainedPlayers = selectedIds.map((id, index) => ({
    player: roster.find((player) => player.id === id),
    slot: index + 1,
    cost: RULES.retentionCosts[index],
  }));

  const spent = retainedPlayers.reduce((total, retained) => total + retained.cost, 0);
  const remainingPurse = RULES.startingPurse - spent;

  const togglePlayer = (playerId) => {
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      if (current.length >= RULES.maxRetentions) {
        return current;
      }

      return [...current, playerId];
    });
  };

  const confirmRetentions = () => {
    setGameState((current) => ({
      ...current,
      retainedPlayers,
      mySquad: retainedPlayers.map(({ player, cost, slot }) => ({
        ...player,
        ownedBy: "human",
        pricePaid: cost,
        acquisition: `Retention ${slot}`,
      })),
      purse: remainingPurse,
      phase: "strategy",
    }));
  };

  return (
    <main className="screen page-shell retention-screen">
      <header
        className="team-banner"
        style={{
          "--team-primary": gameState.selectedTeam.primaryColor,
          "--team-secondary": gameState.selectedTeam.secondaryColor,
        }}
      >
        <img alt={`${gameState.selectedTeam.name} logo`} src={gameState.selectedTeam.logo} />
        <div>
          <p>{gameState.selectedTeam.name}</p>
          <h1>Retention Room</h1>
        </div>
        <strong>{formatCr(remainingPurse)}</strong>
      </header>

      {remainingPurse < 50 && <p className="inline-warning">Low budget warning - choose wisely</p>}

      <section className="player-grid">
        {roster.map((player) => {
          const selectionIndex = selectedIds.indexOf(player.id);
          const isSelected = selectionIndex >= 0;

          return (
            <button
              className={`player-tile ${isSelected ? "selected" : ""}`}
              key={player.id}
              onClick={() => togglePlayer(player.id)}
              type="button"
            >
              {isSelected && <span className="retention-slot">R{selectionIndex + 1}</span>}
              <strong>{player.name}</strong>
              <div>
                <span className={`badge ${roleClass(player.role)}`}>{player.role}</span>
                <span className={`badge ${tierClass(player.tier)}`}>{player.tier}</span>
                <span className="badge neutral">{flagForNationality(player.nationality)}</span>
              </div>
              <em>{formatCr(player.marketValue)}</em>
              <small>{isSelected ? `Slot ${selectionIndex + 1}: ${formatCr(RULES.retentionCosts[selectionIndex])}` : "Tap to retain"}</small>
            </button>
          );
        })}
      </section>

      <section className="rtm-strip">
        <RTMCard />
        <RTMCard />
      </section>

      <footer className="sticky-footer split-footer">
        <div>
          <span>Retaining</span>
          <strong>{retainedPlayers.map(({ player }) => player.name).join(", ") || "No players selected"}</strong>
        </div>
        <div>
          <span>Purse entering auction</span>
          <strong>{formatCr(remainingPurse)}</strong>
        </div>
        <button className="primary-button" onClick={confirmRetentions} type="button">
          Confirm Retentions
        </button>
      </footer>
    </main>
  );
}

export default RetentionScreen;
