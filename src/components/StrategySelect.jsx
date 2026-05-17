import { useState } from "react";

const strategies = [
  {
    id: "Batting Fortress",
    icon: "BF",
    description: "Load up your top 6. Dominate with the bat.",
    bonus: "+15% Batting Depth",
  },
  {
    id: "Bowling Arsenal",
    icon: "BA",
    description: "5 quality bowlers. Strangle every innings.",
    bonus: "+15% Bowling Attack",
  },
  {
    id: "Balanced Beast",
    icon: "BB",
    description: "No weakness anywhere. Pressure every opponent.",
    bonus: "+10% Squad Balance",
  },
  {
    id: "All-rounder Heavy",
    icon: "AR",
    description: "Flexibility is your weapon. 5+ allrounders.",
    bonus: "+15% All-rounder score",
  },
  {
    id: "Budget Assassin",
    icon: "VA",
    description: "Find the gems others ignored. Win on value.",
    bonus: "+20% Value for Money",
  },
];

function StrategySelect({ onConfirm }) {
  const [selected, setSelected] = useState(null);

  return (
    <main className="screen page-shell strategy-screen">
      <header className="hero-header compact">
        <p>Choose One</p>
        <h1>Set Your Auction Strategy</h1>
      </header>

      <section className="strategy-row">
        {strategies.map((strategy) => (
          <button
            className={`strategy-card ${selected === strategy.id ? "selected" : ""}`}
            key={strategy.id}
            onClick={() => setSelected(strategy.id)}
            type="button"
          >
            <span>{strategy.icon}</span>
            <strong>{strategy.id}</strong>
            <p>{strategy.description}</p>
            <small>{strategy.bonus}</small>
          </button>
        ))}
      </section>

      <footer className="sticky-footer">
        <button className="primary-button wide" disabled={!selected} onClick={() => onConfirm(selected)} type="button">
          Set Strategy and Enter Auction
        </button>
      </footer>
    </main>
  );
}

export default StrategySelect;
