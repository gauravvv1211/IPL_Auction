import { useEffect, useMemo, useRef, useState } from "react";
import { RULES } from "../data/auctionRules.js";
import { teams, teamsById } from "../data/teams.js";
import { shouldAIBid, simulateAIAuctionOutcome } from "../utils/aiBidding.js";
import {
  countOverseas,
  flagForNationality,
  formatCr,
  tierClass,
} from "../utils/helpers.js";
import RTMCard from "./RTMCard.jsx";

const createFeedEntry = (text, teamId = null) => ({
  id: `${Date.now()}-${Math.random()}`,
  text,
  teamId,
});

const eventTypes = ["injury", "war", "intel", "sleeper"];

const rolePoolLabels = {
  keepers: "Keepers",
  batsmen: "Batsmen",
  allrounders: "All-rounders",
  pacers: "Pacers",
  spinners: "Spinners",
};

const titleCasePool = (poolLabel) => {
  const [segment, rolePool] = poolLabel.split(" ");
  return `${segment} ${rolePoolLabels[rolePool] ?? rolePool}`;
};

function playTone(type) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type === "lose" ? "sawtooth" : "sine";
  oscillator.frequency.value = type === "win" ? 720 : type === "lose" ? 180 : 420;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
}

function AuctionHall({ gameState, setGameState }) {
  const [index, setIndex] = useState(0);
  const [showPoolTransition, setShowPoolTransition] = useState(true);
  const [humanBidOnCurrent, setHumanBidOnCurrent] = useState(false);
  const [bidLocked, setBidLocked] = useState(false);
  const [soldNotice, setSoldNotice] = useState(null);
  const [flash, setFlash] = useState("");
  const [hammerCountdown, setHammerCountdown] = useState(null);
  const [rtmSeconds, setRtmSeconds] = useState(RULES.rtmWindowMs / 1000);
  const [eventCount, setEventCount] = useState(0);
  const [budgetAlertShown, setBudgetAlertShown] = useState(false);
  const [skipSummary, setSkipSummary] = useState(null);
  const [pendingPoolAdvance, setPendingPoolAdvance] = useState(null);
  const moveTimerRef = useRef(null);
  const activePlayer = gameState.auctionQueue[index] ?? null;
  const squadRoleCounts = useMemo(
    () =>
      gameState.mySquad.reduce(
        (counts, player) => ({
          ...counts,
          [player.role]: (counts[player.role] ?? 0) + 1,
        }),
        {},
      ),
    [gameState.mySquad],
  );

  const currentPoolPlayers = useMemo(() => {
    if (!activePlayer) return [];
    return gameState.auctionQueue.filter((player) => player.poolKey === activePlayer.poolKey);
  }, [activePlayer, gameState.auctionQueue]);

  const remainingPoolPlayers = useMemo(() => {
    if (!activePlayer) return [];
    return gameState.auctionQueue
      .slice(index)
      .filter((player) => player.poolKey === activePlayer.poolKey);
  }, [activePlayer, gameState.auctionQueue, index]);

  const poolProgress = activePlayer
    ? currentPoolPlayers.findIndex((player) => player.id === activePlayer.id) + 1
    : 0;

  const addFeed = (entry) => {
    setGameState((current) => ({
      ...current,
      activityFeed: [entry, ...current.activityFeed].slice(0, 50),
    }));
  };

  const addHeadline = (text) => {
    setGameState((current) => ({
      ...current,
      saleHeadlines: [text, ...current.saleHeadlines].slice(0, 20),
    }));
  };

  const startPlayer = (player) => {
    if (!player) return;

    setHumanBidOnCurrent(false);
    setSoldNotice(null);
    setGameState((current) => ({
      ...current,
      currentPool: player.poolKey,
      currentPlayer: player,
      currentBid: player.basePrice,
      currentBidder: null,
      bidHistory: [],
    }));
  };

  const moveToNextPlayer = () => {
    const nextIndex = index + 1;

    if (nextIndex >= gameState.auctionQueue.length) {
      setGameState((current) => ({
        ...current,
        currentPlayer: null,
        phase: "unsoldPool",
      }));
      return;
    }

    const nextPlayer = gameState.auctionQueue[nextIndex];
    setIndex(nextIndex);

    if (nextPlayer.poolKey !== gameState.currentPool) {
      setShowPoolTransition(true);
      setGameState((current) => ({
        ...current,
        currentPlayer: null,
        currentPool: nextPlayer.poolKey,
      }));
      return;
    }

    startPlayer(nextPlayer);
  };

  const scheduleAdvance = () => {
    window.clearTimeout(moveTimerRef.current);
    moveTimerRef.current = window.setTimeout(moveToNextPlayer, 1300);
  };

  const finalizeAISale = (teamId, player, amount) => {
    setGameState((current) => ({
      ...current,
      aiSquads: {
        ...current.aiSquads,
        [teamId]: [
          ...(current.aiSquads[teamId] ?? []),
          { ...player, ownedBy: teamId, pricePaid: amount, acquisition: "Auction" },
        ],
      },
      aiBudgets: {
        ...current.aiBudgets,
        [teamId]: Number((current.aiBudgets[teamId] - amount).toFixed(2)),
      },
    }));
  };

  const completeSale = () => {
    const { currentBidder, currentBid, currentPlayer } = gameState;
    if (!currentPlayer) return;

    if (!currentBidder) {
      const headline = `${currentPlayer.name} went unsold`;
      setSoldNotice({ type: "unsold", text: headline });
      setGameState((current) => ({
        ...current,
        unsoldPlayers: [...current.unsoldPlayers, currentPlayer],
      }));
      addFeed(createFeedEntry(headline));
      addHeadline(headline);
      scheduleAdvance();
      return;
    }

    if (currentBidder === "human") {
      const boughtPlayer = {
        ...currentPlayer,
        ownedBy: "human",
        pricePaid: currentBid,
        acquisition: "Auction",
      };
      const headline = `YOU bought ${currentPlayer.name} for ${formatCr(currentBid)}`;

      setSoldNotice({ type: "human", text: `Sold to you - ${formatCr(currentBid)}` });
      setFlash("flash-win");
      playTone("win");
      setGameState((current) => ({
        ...current,
        mySquad: [...current.mySquad, boughtPlayer],
        purse: Number((current.purse - currentBid).toFixed(2)),
        totalSpent: Number((current.totalSpent + currentBid).toFixed(2)),
      }));
      addFeed(createFeedEntry(headline, "human"));
      addHeadline(headline);
      scheduleAdvance();
      return;
    }

    if (humanBidOnCurrent && gameState.rtmCardsRemaining > 0) {
      setGameState((current) => ({
        ...current,
        rtmEvent: {
          player: currentPlayer,
          winningTeam: currentBidder,
          winningBid: currentBid,
        },
      }));
      setRtmSeconds(RULES.rtmWindowMs / 1000);
      return;
    }

    const headline = `${currentBidder} bought ${currentPlayer.name} for ${formatCr(currentBid)}`;
    finalizeAISale(currentBidder, currentPlayer, currentBid);
    setSoldNotice({
      type: "ai",
      text: `Sold to ${currentBidder} - ${formatCr(currentBid)}`,
    });
    setFlash("flash-sold");
    playTone("gavel");
    addFeed(createFeedEntry(headline, currentBidder));
    addHeadline(headline);
    scheduleAdvance();
  };

  const placeHumanBid = (increment) => {
    if (!gameState.currentPlayer || bidLocked) return;

    const newBid = Number((gameState.currentBid + increment).toFixed(2));
    if (newBid > gameState.purse || gameState.mySquad.length >= RULES.maxSquadSize) {
      setFlash("flash-error");
      return;
    }

    setBidLocked(true);
    setHumanBidOnCurrent(true);
    setFlash("flash-win");
    setGameState((current) => ({
      ...current,
      currentBid: newBid,
      currentBidder: "human",
      bidHistory: [...current.bidHistory, { bidder: "human", amount: newBid, timestamp: Date.now() }],
    }));
    addFeed(createFeedEntry(`YOU bid ${formatCr(newBid)}`, "human"));
    window.setTimeout(() => setBidLocked(false), 500);
  };

  const tryAIBid = (teamId) => {
    setGameState((current) => {
      const player = current.currentPlayer;
      const team = teamsById[teamId];

      if (!player || current.currentBidder === teamId || current.phase !== "auction") {
        return current;
      }

      const shouldBid = shouldAIBid({
        team,
        player,
        currentBid: current.currentBid,
        budget: current.aiBudgets[teamId] ?? 0,
        squad: current.aiSquads[teamId] ?? [],
        progress: index / Math.max(current.auctionQueue.length, 1),
      });

      if (!shouldBid) return current;

      const amount = Number((current.currentBid + RULES.aiBidIncrement).toFixed(2));
      const outbidHuman = current.currentBidder === "human";

      if (outbidHuman) {
        setFlash("flash-lose");
        playTone("lose");
      }

      return {
        ...current,
        currentBid: amount,
        currentBidder: teamId,
        bidHistory: [...current.bidHistory, { bidder: teamId, amount, timestamp: Date.now() }],
        activityFeed: [
          createFeedEntry(`${teamId} bid ${formatCr(amount)}`, teamId),
          ...current.activityFeed,
        ].slice(0, 50),
      };
    });
  };

  const useRTM = () => {
    const event = gameState.rtmEvent;
    if (!event || gameState.purse < event.winningBid) return;

    const headline = `YOU used RTM on ${event.player.name} for ${formatCr(event.winningBid)}`;
    setGameState((current) => ({
      ...current,
      rtmCardsRemaining: current.rtmCardsRemaining - 1,
      rtmUsedOn: [...current.rtmUsedOn, event.player],
      rtmEvent: null,
      mySquad: [
        ...current.mySquad,
        {
          ...event.player,
          ownedBy: "human",
          pricePaid: event.winningBid,
          acquisition: "RTM",
        },
      ],
      purse: Number((current.purse - event.winningBid).toFixed(2)),
      totalSpent: Number((current.totalSpent + event.winningBid).toFixed(2)),
    }));
    setSoldNotice({ type: "human", text: `RTM used on ${event.player.name}` });
    addFeed(createFeedEntry(headline, "human"));
    addHeadline(headline);
    scheduleAdvance();
  };

  const declineRTM = () => {
    const event = gameState.rtmEvent;
    if (!event) return;

    const headline = `${event.winningTeam} bought ${event.player.name} for ${formatCr(event.winningBid)}`;
    finalizeAISale(event.winningTeam, event.player, event.winningBid);
    setGameState((current) => ({ ...current, rtmEvent: null }));
    setSoldNotice({
      type: "ai",
      text: `Sold to ${event.winningTeam} - ${formatCr(event.winningBid)}`,
    });
    addFeed(createFeedEntry(headline, event.winningTeam));
    addHeadline(headline);
    scheduleAdvance();
  };

  const skipCurrentPlayerForHuman = () => {
    if (!gameState.currentPlayer || gameState.currentBidder === "human") return;

    const outcome = simulateAIAuctionOutcome({
      player: gameState.currentPlayer,
      currentBid: gameState.currentBid,
      aiBudgets: gameState.aiBudgets,
      aiSquads: gameState.aiSquads,
      excludedTeamId: gameState.selectedTeam.id,
      progress: index / Math.max(gameState.auctionQueue.length, 1),
    });

    if (!outcome) {
      const headline = `${gameState.currentPlayer.name} went unsold`;
      setGameState((current) => ({
        ...current,
        unsoldPlayers: [...current.unsoldPlayers, current.currentPlayer],
      }));
      setSoldNotice({ type: "unsold", text: headline });
      addFeed(createFeedEntry(headline));
      addHeadline(headline);
      scheduleAdvance();
      return;
    }

    const headline = `${outcome.teamId} bought ${gameState.currentPlayer.name} for ${formatCr(outcome.amount)}`;
    finalizeAISale(outcome.teamId, gameState.currentPlayer, outcome.amount);
    setSoldNotice({ type: "ai", text: `Sold to ${outcome.teamId} - ${formatCr(outcome.amount)}` });
    addFeed(createFeedEntry(headline, outcome.teamId));
    addHeadline(headline);
    scheduleAdvance();
  };

  const skipCurrentPool = () => {
    if (!activePlayer) return;

    const skippedPool = activePlayer.poolKey;
    const skippedPlayers = gameState.auctionQueue.slice(index).filter((player) => player.poolKey === skippedPool);
    const nextIndex = index + skippedPlayers.length;
    const aiBudgets = { ...gameState.aiBudgets };
    const aiSquads = Object.fromEntries(
      Object.entries(gameState.aiSquads).map(([teamId, squad]) => [teamId, [...squad]]),
    );
    const results = skippedPlayers.map((player, playerOffset) => {
      const outcome = simulateAIAuctionOutcome({
        player,
        currentBid: player.basePrice,
        aiBudgets,
        aiSquads,
        excludedTeamId: gameState.selectedTeam.id,
        progress: (index + playerOffset) / Math.max(gameState.auctionQueue.length, 1),
      });

      if (!outcome) {
        return { player, teamId: null, amount: null };
      }

      aiBudgets[outcome.teamId] = Number((aiBudgets[outcome.teamId] - outcome.amount).toFixed(2));
      aiSquads[outcome.teamId] = [
        ...aiSquads[outcome.teamId],
        { ...player, ownedBy: outcome.teamId, pricePaid: outcome.amount, acquisition: "Auction" },
      ];

      return { player, teamId: outcome.teamId, amount: outcome.amount };
    });

    const unsoldPlayers = results.filter((result) => !result.teamId).map((result) => result.player);
    const headlines = results.map((result) =>
      result.teamId
        ? `${result.teamId} bought ${result.player.name} for ${formatCr(result.amount)}`
        : `${result.player.name} went unsold`,
    );

    setGameState((current) => ({
      ...current,
      currentPlayer: null,
      skippedPools: [...current.skippedPools, skippedPool],
      aiBudgets,
      aiSquads,
      unsoldPlayers: [...current.unsoldPlayers, ...unsoldPlayers],
      saleHeadlines: [...headlines.reverse(), ...current.saleHeadlines].slice(0, 20),
      activityFeed: [
        ...results
          .slice()
          .reverse()
          .map((result) =>
            createFeedEntry(
              result.teamId
                ? `${result.teamId} bought ${result.player.name} ${formatCr(result.amount)}`
                : `${result.player.name} went unsold`,
              result.teamId,
            ),
          ),
        ...current.activityFeed,
      ].slice(0, 50),
    }));
    setSkipSummary({
      title: titleCasePool(activePlayer.poolLabel),
      results,
    });
    setPendingPoolAdvance({
      nextIndex,
      auctionComplete: nextIndex >= gameState.auctionQueue.length,
    });
  };

  const closeSkipSummary = () => {
    if (!pendingPoolAdvance) return;

    setSkipSummary(null);

    if (pendingPoolAdvance.auctionComplete) {
      setGameState((current) => ({ ...current, phase: "unsoldPool" }));
      return;
    }

    setIndex(pendingPoolAdvance.nextIndex);
    setShowPoolTransition(true);
    setPendingPoolAdvance(null);
  };

  const createRandomEvent = () => {
    if (!gameState.currentPlayer) return;

    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const budgetPlayer = gameState.auctionQueue.find((player) => player.tier === "Budget");
    const leadingTeams = teams.filter((team) => team.id !== gameState.selectedTeam.id);
    const rival = leadingTeams[Math.floor(Math.random() * leadingTeams.length)];

    const nextEvent =
      type === "injury"
        ? {
            type,
            title: "Injury Concern",
            body: `${gameState.currentPlayer.name} has a fitness concern at ${formatCr(gameState.currentBid)}.`,
          }
        : type === "war"
          ? {
              type,
              title: "Bidding War Alert",
              body: `A bidding war is brewing on ${gameState.currentPlayer.name}.`,
            }
          : type === "intel"
            ? {
                type,
                title: "Rival Intel",
                body: `${rival.id} has ${formatCr(gameState.aiBudgets[rival.id] ?? 0)} left and is still shopping.`,
              }
            : {
                type,
                title: "Sleeper Alert",
                body: `${budgetPlayer?.name ?? "A budget player"} looks heavily undervalued.`,
              };

    setGameState((current) => ({ ...current, activeEvent: nextEvent }));
    setEventCount((value) => value + 1);
  };

  useEffect(() => {
    if (!activePlayer || showPoolTransition || gameState.currentPlayer) return;
    startPlayer(activePlayer);
  }, [activePlayer, gameState.currentPlayer, showPoolTransition]);

  useEffect(() => {
    if (!gameState.currentPlayer || showPoolTransition || soldNotice || gameState.rtmEvent || skipSummary) {
      return undefined;
    }

    const aiTimers = teams
      .filter((team) => team.id !== gameState.selectedTeam.id)
      .map((team) =>
        window.setTimeout(() => {
          tryAIBid(team.id);
        }, team.aiPersonality.bidDelay + Math.floor(Math.random() * 250)),
      );

    return () => aiTimers.forEach((timer) => window.clearTimeout(timer));
  }, [
    gameState.currentBid,
    gameState.currentBidder,
    gameState.currentPlayer,
    gameState.rtmEvent,
    showPoolTransition,
    soldNotice,
    skipSummary,
  ]);

  useEffect(() => {
    if (!gameState.currentPlayer || showPoolTransition || soldNotice || gameState.rtmEvent || skipSummary) {
      return undefined;
    }

    const endTime = Date.now() + RULES.hammerDelay;
    const countdownTimer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setHammerCountdown(remaining);
    }, 250);
    const hammerTimer = window.setTimeout(completeSale, RULES.hammerDelay);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(hammerTimer);
    };
  }, [
    gameState.currentBid,
    gameState.currentBidder,
    gameState.currentPlayer,
    gameState.rtmEvent,
    showPoolTransition,
    soldNotice,
    skipSummary,
  ]);

  useEffect(() => {
    if (!gameState.rtmEvent) return undefined;

    const timer = window.setInterval(() => {
      setRtmSeconds((value) => {
        if (value <= 1) {
          declineRTM();
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameState.rtmEvent]);

  useEffect(() => {
    if (!gameState.activeEvent) return undefined;

    const timer = window.setTimeout(() => {
      setGameState((current) => ({ ...current, activeEvent: null }));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [gameState.activeEvent, setGameState]);

  useEffect(() => {
    if (!gameState.currentPlayer || showPoolTransition || gameState.activeEvent || soldNotice || skipSummary) return;

    const progress = index / Math.max(gameState.auctionQueue.length, 1);
    if (eventCount < 6 && progress > (eventCount + 1) / 7) {
      createRandomEvent();
    }
  }, [eventCount, gameState.activeEvent, gameState.currentPlayer, index, showPoolTransition, soldNotice, skipSummary]);

  useEffect(() => {
    if (gameState.purse < 20 && gameState.mySquad.length < 15 && !budgetAlertShown) {
      setBudgetAlertShown(true);
      setGameState((current) => ({
        ...current,
        activeEvent: {
          type: "budget",
          title: "Budget Alert",
          body: `You have ${formatCr(current.purse)} left with ${RULES.minSquadSize - current.mySquad.length} spots still to fill.`,
        },
      }));
    }
  }, [budgetAlertShown, gameState.mySquad.length, gameState.purse, setGameState]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(""), 450);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(
    () => () => {
      window.clearTimeout(moveTimerRef.current);
    },
    [],
  );

  if (!activePlayer) {
    return null;
  }

  return (
    <main
      className={`screen auction-screen ${flash}`}
      style={{
        "--team-primary": gameState.selectedTeam.primaryColor,
        "--team-logo": `url(${gameState.selectedTeam.logo})`,
      }}
    >
      <header className="auction-topbar">
        <div className="auction-brand">
          <span>IPL</span>
          <strong>Auction Simulator</strong>
        </div>
        <div className="team-chip dropdown-host">
          <img alt={`${gameState.selectedTeam.name} logo`} src={gameState.selectedTeam.logo} />
          <div>
            <span>Your Team</span>
            <strong>{gameState.selectedTeam.name}</strong>
          </div>
          <div className="top-dropdown team-dropdown">
            {teams.map((team) => {
              const isHuman = team.id === gameState.selectedTeam.id;
              const budget = isHuman ? gameState.purse : gameState.aiBudgets[team.id] ?? 0;
              const squadSize = isHuman ? gameState.mySquad.length : gameState.aiSquads[team.id]?.length ?? 0;

              return (
                <article key={team.id}>
                  <img alt={`${team.name} logo`} src={team.logo} />
                  <strong>{team.id}</strong>
                  <span>{formatCr(budget)}</span>
                  <em>{squadSize} players</em>
                </article>
              );
            })}
          </div>
        </div>
        <nav className="auction-nav" aria-label="Auction status">
          <span>{formatCr(gameState.purse)}</span>
          <span>Squad {gameState.mySquad.length}/{RULES.maxSquadSize}</span>
          <span>Overseas {countOverseas(gameState.mySquad)}/{RULES.maxOverseasInXI}</span>
        </nav>
        <div className="pool-status">
          {titleCasePool(activePlayer.poolLabel)} ({poolProgress}/{currentPoolPlayers.length})
        </div>
        <div className="top-actions">
          <span>RTM {gameState.rtmCardsRemaining}</span>
          <div className="dropdown-host pool-inspector">
            <button type="button">Pool {remainingPoolPlayers.length}</button>
            <div className="top-dropdown pool-dropdown">
              <strong>{titleCasePool(activePlayer.poolLabel)}</strong>
              {remainingPoolPlayers.map((player) => (
                <span key={player.id}>{player.name}</span>
              ))}
            </div>
          </div>
          <button onClick={skipCurrentPool} type="button">
            Skip Pool
          </button>
        </div>
      </header>

      <section className="team-strip" aria-label="Teams">
        {teams.map((team) => {
          const isHuman = team.id === gameState.selectedTeam.id;
          const budget = isHuman ? gameState.purse : gameState.aiBudgets[team.id] ?? 0;
          const squadSize = isHuman ? gameState.mySquad.length : gameState.aiSquads[team.id]?.length ?? 0;

          return (
            <article className={isHuman ? "active" : ""} key={team.id}>
              <img alt={`${team.name} logo`} src={team.logo} />
              <strong>{team.id}</strong>
              <span>{squadSize} players</span>
              <em>{formatCr(budget)}</em>
            </article>
          );
        })}
      </section>

      <section className="auction-layout">
        <aside className="squad-panel">
          <div className="panel-heading">
            <span>Your Squad</span>
            <strong>{gameState.selectedTeam.name}</strong>
          </div>
          <section className="squad-summary">
            <article>
              <span>Purse</span>
              <strong>{formatCr(gameState.purse)}</strong>
            </article>
            <article>
              <span>Players</span>
              <strong>{gameState.mySquad.length}/{RULES.maxSquadSize}</strong>
            </article>
          </section>
          <div className="needs-strip">
            <span>WK {squadRoleCounts.WK ?? 0}</span>
            <span>BAT {squadRoleCounts.BAT ?? 0}</span>
            <span>AR {squadRoleCounts.AR ?? 0}</span>
            <span>BOWL {squadRoleCounts.BOWL ?? 0}</span>
          </div>
          <div className="mini-list">
            {gameState.mySquad.map((player) => (
              <article key={`${player.id}-${player.acquisition}`}>
                <strong>{player.name}</strong>
                <span>{formatCr(player.pricePaid)}</span>
              </article>
            ))}
          </div>
        </aside>

        <section className="auction-stage">
          {gameState.currentPlayer && (
            <article className="auction-card">
              <div className="player-info">
                <div>
                  <span className={`badge ${tierClass(gameState.currentPlayer.tier)}`}>{gameState.currentPlayer.tier}</span>
                  <span className="badge neutral">{flagForNationality(gameState.currentPlayer.nationality)}</span>
                </div>
                <h1>{gameState.currentPlayer.name}</h1>
                <p>Role: {gameState.currentPlayer.role}</p>
                <p>Nationality: {gameState.currentPlayer.nationality}</p>
                <small>Base Price {formatCr(gameState.currentPlayer.basePrice)}</small>
              </div>
              <div className="player-image-container">
                {gameState.currentPlayer.image && !gameState.currentPlayer.image.includes('player-placeholder') ? (
                  <img 
                    src={gameState.currentPlayer.image} 
                    alt={gameState.currentPlayer.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                    }}
                  />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
            </article>
          )}

          <div className="bid-box">
            <span>Current Bid</span>
            <strong>{formatCr(gameState.currentBid)}</strong>
            <p>
              {gameState.currentBidder
                ? gameState.currentBidder === "human"
                  ? "You are leading"
                  : `${gameState.currentBidder} leading`
                : "Opening bid"}
            </p>
          </div>

          {gameState.currentBidder === "human" && <p className="winning-copy">You are winning this bid</p>}
          {hammerCountdown !== null && <p className="hammer-copy">Sold in... {hammerCountdown}</p>}

          {gameState.currentPlayer?.nationality === "Overseas" &&
            countOverseas(gameState.mySquad) >= RULES.maxOverseasInXI && (
              <p className="inline-warning">Overseas limit reached - bench risk</p>
            )}

          {gameState.mySquad.length >= RULES.maxSquadSize && (
            <p className="inline-warning">Squad full - cannot buy more</p>
          )}

          {gameState.purse <= 0 ? (
            <p className="inline-warning">No budget remaining - watching only</p>
          ) : (
            <div className="bid-actions">
              {RULES.bidIncrements.map((increment) => (
                <button disabled={bidLocked} key={increment} onClick={() => placeHumanBid(increment)} type="button">
                  +{increment.toFixed(2)}
                </button>
              ))}
              <button
                disabled={gameState.currentBidder === "human"}
                onClick={skipCurrentPlayerForHuman}
                type="button"
              >
                Pass / Skip Player
              </button>
            </div>
          )}

          {soldNotice && <div className={`sold-banner ${soldNotice.type}`}>{soldNotice.text}</div>}
        </section>

        <aside className="feed-panel">
          <div className="panel-heading">
            <span>Auction In Progress</span>
            <strong>Live Feed</strong>
          </div>
          <div className="feed-list">
            {gameState.activityFeed.map((entry) => (
              <article key={entry.id}>{entry.text}</article>
            ))}
          </div>
        </aside>
      </section>

      <footer className="headline-ticker">
        <div>
          {(gameState.saleHeadlines.length
            ? gameState.saleHeadlines
            : ["Auction headlines will appear here once players are sold or go unsold."]
          ).map((headline, headlineIndex) => (
            <span key={`${headline}-${headlineIndex}`}>{headline}</span>
          ))}
        </div>
      </footer>

      {showPoolTransition && (
        <div className="overlay pool-overlay">
          <div>
            <p>Next Up</p>
            <h2>{titleCasePool(activePlayer.poolLabel)}</h2>
            <span>{currentPoolPlayers.length} players coming to the block</span>
            <div>
              <button
                onClick={() => {
                  setShowPoolTransition(false);
                  startPlayer(activePlayer);
                }}
                type="button"
              >
                Enter Pool
              </button>
              <button onClick={skipCurrentPool} type="button">
                Skip Pool
              </button>
            </div>
            <small>Skipping means AI teams will finish this entire pool without you.</small>
          </div>
        </div>
      )}

      {skipSummary && (
        <div className="overlay summary-overlay">
          <div>
            <p>Pool Skipped</p>
            <h2>{skipSummary.title}</h2>
            <section>
              {skipSummary.results.map((result) => (
                <article key={result.player.id}>
                  <strong>{result.player.name}</strong>
                  <span>
                    {result.teamId ? `${result.teamId} - ${formatCr(result.amount)}` : "Unsold"}
                  </span>
                </article>
              ))}
            </section>
            <button onClick={closeSkipSummary} type="button">
              Continue
            </button>
          </div>
        </div>
      )}

      {gameState.rtmEvent && (
        <div className="overlay rtm-overlay">
          <div>
            <RTMCard />
            <h2>RTM Available</h2>
            <p>
              {gameState.rtmEvent.player.name} sold to {gameState.rtmEvent.winningTeam} for{" "}
              {formatCr(gameState.rtmEvent.winningBid)}
            </p>
            <div className="countdown-bar">
              <span style={{ width: `${(rtmSeconds / (RULES.rtmWindowMs / 1000)) * 100}%` }} />
            </div>
            <div>
              <button onClick={useRTM} type="button">
                Use RTM Card
              </button>
              <button onClick={declineRTM} type="button">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState.activeEvent && (
        <div
          className="overlay event-overlay"
          onClick={() => setGameState((current) => ({ ...current, activeEvent: null }))}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <p>{gameState.activeEvent.title}</p>
            <h2>{gameState.activeEvent.body}</h2>
            {gameState.activeEvent.type === "injury" && gameState.currentBidder === "human" && (
              <div>
                <button onClick={() => setGameState((current) => ({ ...current, activeEvent: null }))} type="button">
                  Continue
                </button>
                <button
                  onClick={() => {
                    setGameState((current) => ({
                      ...current,
                      currentBidder: null,
                      currentBid: current.currentPlayer.basePrice,
                      activeEvent: null,
                    }));
                  }}
                  type="button"
                >
                  Withdraw Bid
                </button>
              </div>
            )}
            {gameState.activeEvent.type === "war" && (
              <div>
                <button
                  onClick={() => {
                    placeHumanBid(RULES.aiBidIncrement);
                    setGameState((current) => ({ ...current, activeEvent: null }));
                  }}
                  type="button"
                >
                  Join Bid
                </button>
                <button onClick={() => setGameState((current) => ({ ...current, activeEvent: null }))} type="button">
                  Watch
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default AuctionHall;
