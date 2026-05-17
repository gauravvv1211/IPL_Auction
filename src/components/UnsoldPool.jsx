import { RULES } from "../data/auctionRules.js";
import { flagForNationality, formatCr, roleClass, tierClass } from "../utils/helpers.js";

function UnsoldPool({ gameState, setGameState }) {
  const players = [...gameState.unsoldPlayers].sort((left, right) => right.marketValue - left.marketValue);

  const buyPlayer = (player) => {
    if (
      player.basePrice > gameState.purse ||
      gameState.mySquad.length >= RULES.maxSquadSize ||
      gameState.mySquad.some((member) => member.id === player.id)
    ) {
      return;
    }

    setGameState((current) => ({
      ...current,
      purse: Number((current.purse - player.basePrice).toFixed(2)),
      mySquad: [
        ...current.mySquad,
        { ...player, ownedBy: "human", pricePaid: player.basePrice, acquisition: "Unsold Pool" },
      ],
      unsoldPlayers: current.unsoldPlayers.filter((candidate) => candidate.id !== player.id),
    }));
  };

  const continueToXI = () => {
    if (gameState.mySquad.length < 11) return;
    setGameState((current) => ({ ...current, phase: "finalXI" }));
  };

  return (
    <main className="screen page-shell">
      <header className="hero-header compact">
        <p>Last Chance</p>
        <h1>Unsold Player Pool</h1>
        <span>Buy any unsold player at base price. No bidding.</span>
      </header>

      {gameState.skippedPools.length === RULES.poolOrder.length && (
        <p className="inline-warning">You skipped all pools - limited squad</p>
      )}

      {gameState.mySquad.length < 11 && (
        <p className="inline-warning">Cannot form XI - buy more in the unsold pool.</p>
      )}

      <section className="player-grid">
        {players.map((player) => {
          const disabled =
            player.basePrice > gameState.purse || gameState.mySquad.length >= RULES.maxSquadSize;

          return (
            <article className="player-tile static" key={player.id}>
              <strong>{player.name}</strong>
              <div>
                <span className={`badge ${roleClass(player.role)}`}>{player.role}</span>
                <span className={`badge ${tierClass(player.tier)}`}>{player.tier}</span>
                <span className="badge neutral">{flagForNationality(player.nationality)}</span>
              </div>
              <em>{formatCr(player.marketValue)}</em>
              <button disabled={disabled} onClick={() => buyPlayer(player)} title={disabled ? "Insufficient funds or squad full" : ""} type="button">
                Buy at {formatCr(player.basePrice)}
              </button>
            </article>
          );
        })}
      </section>

      <footer className="sticky-footer">
        <button className="primary-button wide" disabled={gameState.mySquad.length < 11} onClick={continueToXI} type="button">
          Continue to Squad Selection
        </button>
      </footer>
    </main>
  );
}

export default UnsoldPool;
