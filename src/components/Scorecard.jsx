import { formatCr, getGrade } from "../utils/helpers.js";
import ShareCard from "./ShareCard.jsx";

const labels = [
  ["batting", "Batting Depth"],
  ["bowling", "Bowling Attack"],
  ["balance", "Squad Balance"],
  ["value", "Value for Money"],
  ["chemistry", "Chemistry Bonus"],
  ["strategy", "Strategy Alignment"],
];

function Scorecard({ gameState, onPlayAgain }) {
  const result = gameState.scores;
  if (!result) return null;

  return (
    <main className="screen page-shell scorecard-screen">
      <header className="hero-header compact">
        <p>Final Verdict</p>
        <h1>{result.overall}/100</h1>
        <span>{result.verdict}</span>
      </header>

      <section className="score-grid">
        {labels.map(([key, label]) => (
          <article key={key}>
            <header>
              <strong>{label}</strong>
              <span>{result.scores[key]}/100</span>
              <em>{getGrade(result.scores[key])}</em>
            </header>
            <div className="score-bar">
              <span style={{ width: `${result.scores[key]}%` }} />
            </div>
          </article>
        ))}
      </section>

      <section className="comparison-table">
        <h2>Rival Team Comparison</h2>
        <div>
          <header>
            <span>Team</span>
            <span>Score</span>
            <span>Verdict</span>
            <span>Biggest Buy</span>
            <span>Players Bought</span>
          </header>
          {result.rivalScores.map((row) => (
            <article className={row.isHuman ? "human-row" : ""} key={row.team.id} tabIndex={0}>
              <span>{row.team.id}</span>
              <span>{row.overall}</span>
              <span>{row.verdict}</span>
              <span>{row.biggestBuy?.name ?? "No buy"}</span>
              <span className="purchase-summary">
                {row.boughtPlayers.length} players
                <aside className="purchase-popover">
                  <strong>{row.team.id} purchases</strong>
                  {row.boughtPlayers.length ? (
                    row.boughtPlayers.map((player) => (
                      <em key={`${row.team.id}-${player.id}`}>
                        {player.name}
                        <small>{formatCr(player.pricePaid)}</small>
                      </em>
                    ))
                  ) : (
                    <em>No auction buys</em>
                  )}
                </aside>
              </span>
            </article>
          ))}
        </div>
      </section>

      <ShareCard gameState={gameState} onPlayAgain={onPlayAgain} scores={result} />
    </main>
  );
}

export default Scorecard;
