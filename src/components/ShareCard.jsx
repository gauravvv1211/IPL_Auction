import { formatCr } from "../utils/helpers.js";

function ShareCard({ gameState, scores, onPlayAgain }) {
  const retainedNames = gameState.retainedPlayers.map(({ player }) => player.name).join(", ") || "None";
  const boughtPlayers = gameState.myXI.slice(0, 11);
  const rtmNames = gameState.rtmUsedOn.map((player) => player.name).join(", ") || "None";

  const cardText = [
    `MY ${gameState.selectedTeam.shortName} MEGA AUCTION XI`,
    `Score: ${scores.overall}/100 - ${scores.verdict}`,
    `Retained: ${retainedNames}`,
    ...boughtPlayers.map((player) => `${player.name} - ${formatCr(player.pricePaid)}`),
    `RTMs used: ${rtmNames}`,
    `Budget remaining: ${formatCr(gameState.purse)}`,
    `Strategy: ${gameState.strategy}`,
    "Can you beat my team?",
  ].join("\n");

  const copyCard = async () => {
    await navigator.clipboard.writeText(cardText);
  };

  return (
    <section className="share-wrap">
      <article className="share-card">
        <p>My {gameState.selectedTeam.shortName} Mega Auction XI</p>
        <h2>{scores.overall}/100</h2>
        <strong>{scores.verdict}</strong>
        <div>
          <span>Retained</span>
          <em>{retainedNames}</em>
        </div>
        <div>
          <span>Bought</span>
          <em>{boughtPlayers.map((player) => player.name).join(", ")}</em>
        </div>
        <div>
          <span>RTMs used</span>
          <em>{rtmNames}</em>
        </div>
        <div>
          <span>Budget remaining</span>
          <em>{formatCr(gameState.purse)}</em>
        </div>
        <footer>Can you beat my team?</footer>
      </article>

      <div className="share-actions">
        <button onClick={copyCard} type="button">
          Copy Card Text
        </button>
        <button onClick={onPlayAgain} type="button">
          Play Again
        </button>
      </div>
    </section>
  );
}

export default ShareCard;
