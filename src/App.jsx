import { useEffect, useState } from "react";
import AuctionHall from "./components/AuctionHall.jsx";
import FinalXIPicker from "./components/FinalXIPicker.jsx";
import FranchiseSelect from "./components/FranchiseSelect.jsx";
import HomeScreen from "./components/HomeScreen.jsx";
import RetentionScreen from "./components/RetentionScreen.jsx";
import Scorecard from "./components/Scorecard.jsx";
import StrategySelect from "./components/StrategySelect.jsx";
import UnsoldPool from "./components/UnsoldPool.jsx";
import { RULES } from "./data/auctionRules.js";
import { parseAuctionWorkbook, loadPlayerImages } from "./data/parseExcel.js";
import { prepareAuction } from "./utils/aiBidding.js";
import { calculateScores } from "./utils/scoring.js";

const createInitialState = (players = [], teamRosters = {}) => ({
  phase: players.length ? "home" : "loading",
  players,
  teamRosters,
  error: null,
  managerName: "",
  selectedTeam: null,
  retainedPlayers: [],
  rtmCardsRemaining: RULES.rtmCards,
  strategy: null,
  purse: RULES.startingPurse,
  mySquad: [],
  myXI: [],
  auctionQueue: [],
  currentPool: null,
  currentPlayer: null,
  currentBid: 0,
  currentBidder: null,
  bidHistory: [],
  activityFeed: [],
  saleHeadlines: [],
  unsoldPlayers: [],
  skippedPools: [],
  aiSquads: {},
  aiBudgets: {},
  aiRetentions: {},
  rtmEvent: null,
  rtmUsedOn: [],
  activeEvent: null,
  scores: null,
  auctionStartTime: null,
  totalSpent: 0,
});

function AuctionSetup({ onComplete }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      onComplete();
      return undefined;
    }

    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <main className="screen center-screen">
      <div className="setup-countdown">
        <p className="eyebrow">Auction Hall</p>
        <h1>Auction starts in</h1>
        <strong>{count || "Go"}</strong>
      </div>
    </main>
  );
}

function App() {
  const [gameState, setGameState] = useState(createInitialState());

  useEffect(() => {
    let isMounted = true;

    loadPlayerImages()
      .then(() => {
        return parseAuctionWorkbook();
      })
      .then(({ players, teamRosters }) => {
        if (!isMounted) return;

        console.log(`Loaded ${players.length} players from workbook.`);
        setGameState(createInitialState(players, teamRosters));
      })
      .catch((error) => {
        if (!isMounted) return;

        setGameState((current) => ({
          ...current,
          error: error.message,
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (gameState.phase !== "scorecard" || gameState.scores || !gameState.selectedTeam) return;

    setGameState((current) => ({
      ...current,
      scores: calculateScores({
        mySquad: current.mySquad,
        myXI: current.myXI,
        strategy: current.strategy,
        retentions: current.retainedPlayers,
        purseRemaining: current.purse,
        selectedTeam: current.selectedTeam,
        aiSquads: current.aiSquads,
        aiRetentions: current.aiRetentions,
      }),
    }));
  }, [gameState.phase, gameState.scores, gameState.selectedTeam]);

  const resetGame = () => {
    setGameState((current) => createInitialState(current.players, current.teamRosters));
  };

  const startGame = (managerName) => {
    setGameState((current) => ({
      ...current,
      managerName,
      phase: "franchise",
    }));
  };

  const confirmStrategy = (strategy) => {
    const prepared = prepareAuction({
      players: gameState.players,
      selectedTeamId: gameState.selectedTeam.id,
      humanRetentions: gameState.retainedPlayers,
    });

    setGameState((current) => ({
      ...current,
      strategy,
      phase: "auctionSetup",
      auctionQueue: prepared.auctionQueue,
      aiSquads: prepared.aiSquads,
      aiBudgets: prepared.aiBudgets,
      aiRetentions: prepared.aiRetentions,
      auctionStartTime: Date.now(),
    }));
  };

  const renderScreen = () => {
    if (gameState.error) {
      return (
        <main className="screen center-screen">
          <section className="message-panel">
            <p className="eyebrow danger">Workbook Error</p>
            <h1>IPL Mega Auction Simulator</h1>
            <p>{gameState.error}</p>
          </section>
        </main>
      );
    }

    if (gameState.phase === "loading") {
      return (
        <main className="screen center-screen">
          <section className="message-panel">
            <div className="spinner" />
            <h1>IPL Mega Auction Simulator</h1>
            <p>Loading auction data...</p>
          </section>
        </main>
      );
    }

    switch (gameState.phase) {
      case "home":
        return <HomeScreen onStart={startGame} />;
      case "franchise":
        return (
          <FranchiseSelect
            gameState={gameState}
            managerName={gameState.managerName}
            setGameState={setGameState}
          />
        );
      case "retention":
        return <RetentionScreen gameState={gameState} setGameState={setGameState} />;
      case "strategy":
        return <StrategySelect onConfirm={confirmStrategy} />;
      case "auctionSetup":
        return (
          <AuctionSetup
            onComplete={() => setGameState((current) => ({ ...current, phase: "auction" }))}
          />
        );
      case "auction":
        return <AuctionHall gameState={gameState} setGameState={setGameState} />;
      case "unsoldPool":
        return <UnsoldPool gameState={gameState} setGameState={setGameState} />;
      case "finalXI":
        return <FinalXIPicker gameState={gameState} setGameState={setGameState} />;
      case "scorecard":
        return <Scorecard gameState={gameState} onPlayAgain={resetGame} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      {renderScreen()}
      <footer className="creator-footer">Crafted by Gaurav Vengurlekar.</footer>
    </div>
  );
}

export default App;
