import { countOverseas, formatCr } from "../utils/helpers.js";

const slotLabels = [
  "Opener",
  "Opener",
  "No.3",
  "No.4",
  "No.5",
  "No.6",
  "WK / Finisher",
  "AR",
  "AR / BOWL",
  "BOWL",
  "BOWL",
];

function FinalXIPicker({ gameState, setGameState }) {
  const selectedIds = new Set(gameState.myXI.map((player) => player.id));
  const availablePlayers = gameState.mySquad.filter((player) => !selectedIds.has(player.id));
  const wkCount = gameState.myXI.filter((player) => player.role === "WK").length;
  const bowlerCount = gameState.myXI.filter((player) => ["BOWL", "AR"].includes(player.role)).length;
  const overseasCount = countOverseas(gameState.myXI);
  const validXI = gameState.myXI.length === 11 && wkCount >= 1 && bowlerCount >= 3 && overseasCount <= 4;

  const addPlayer = (player) => {
    if (gameState.myXI.length >= 11) return;
    setGameState((current) => ({ ...current, myXI: [...current.myXI, player] }));
  };

  const removePlayer = (playerId) => {
    setGameState((current) => ({
      ...current,
      myXI: current.myXI.filter((player) => player.id !== playerId),
    }));
  };

  const confirmXI = () => {
    setGameState((current) => ({ ...current, phase: "scorecard" }));
  };

  return (
    <main className="screen page-shell final-xi-screen">
      <header className="hero-header compact">
        <p>Match Day</p>
        <h1>Pick Your Final XI</h1>
      </header>

      <section className="xi-layout">
        <div>
          <h2>Full Squad</h2>
          <div className="squad-picker-list">
            {availablePlayers.map((player) => (
              <button key={player.id} onClick={() => addPlayer(player)} type="button">
                <strong>{player.name}</strong>
                <span>{formatCr(player.pricePaid)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2>Playing XI</h2>
          <div className="xi-slots">
            {slotLabels.map((label, slotIndex) => {
              const player = gameState.myXI[slotIndex];
              return (
                <button
                  className={player ? "filled" : ""}
                  key={label + slotIndex}
                  onClick={() => player && removePlayer(player.id)}
                  type="button"
                >
                  <span>{slotIndex + 1}. {label}</span>
                  <strong>{player?.name ?? "Empty slot"}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={`balance-strip ${validXI ? "good" : "warn"}`}>
        <span>{gameState.myXI.length === 11 ? "OK" : "Need"} exactly 11 players</span>
        <span>{wkCount >= 1 ? "OK" : "Need"} at least 1 WK</span>
        <span>{bowlerCount >= 3 ? "OK" : "Need"} at least 3 bowlers</span>
        <span>{overseasCount <= 4 ? "OK" : "Limit"} max 4 overseas</span>
      </section>

      <footer className="sticky-footer">
        <button className="primary-button wide" onClick={confirmXI} type="button">
          Confirm Playing XI
        </button>
      </footer>
    </main>
  );
}

export default FinalXIPicker;
