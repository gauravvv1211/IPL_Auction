import { useState } from "react";
import { teams } from "../data/teams.js";
import { formatCr } from "../utils/helpers.js";

const identityLabels = {
  "batting-heavy": "Batting Powerhouse",
  "pace-first": "Pace First",
  "all-rounder": "All-Round Core",
  youth: "Youth Factory",
};

function FranchiseSelect({ managerName, setGameState }) {
  const [selectedId, setSelectedId] = useState(null);
  const selectedTeam = teams.find((team) => team.id === selectedId);

  const confirmSelection = () => {
    if (!selectedTeam) return;

    setGameState((current) => ({
      ...current,
      selectedTeam,
      phase: "retention",
    }));
  };

  return (
    <main className="screen page-shell">
      <header className="hero-header">
        <p>IPL 2025 Mega Auction Simulator</p>
        <h1>Welcome, {managerName}</h1>
        <span>Select your franchise</span>
      </header>

      <section className="team-grid">
        {teams.map((team) => {
          const isSelected = team.id === selectedId;

          return (
            <button
              className={`team-card ${isSelected ? "selected" : ""}`}
              key={team.id}
              onClick={() => setSelectedId(team.id)}
              style={{
                "--team-primary": team.primaryColor,
                "--team-secondary": team.secondaryColor,
                "--team-logo": `url(${team.logo})`,
              }}
              type="button"
            >
              {isSelected && <span className="selected-badge">Selected</span>}
              <img alt={`${team.name} logo`} className="team-logo" src={team.logo} />
              <strong>{team.name}</strong>
              <span>{team.homeGround}</span>
              <em>{identityLabels[team.identity]}</em>
              <small>{formatCr(team.startingPurse)}</small>
            </button>
          );
        })}
      </section>

      <footer className="sticky-footer">
        <button className="primary-button wide" disabled={!selectedTeam} onClick={confirmSelection} type="button">
          Enter Auction Hall
        </button>
      </footer>
    </main>
  );
}

export default FranchiseSelect;
