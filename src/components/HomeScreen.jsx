import { useState } from "react";

function HomeScreen({ onStart }) {
  const [name, setName] = useState("");
  const trimmedName = name.trim();

  return (
    <main className="screen home-screen">
      <section className="home-content">
        <p>IPL Auction Simulator</p>
        <h1>Welcome to the IPL Auction Simulator</h1>
        <span>Build your franchise, manage your purse, and outbid the league.</span>

        <label>
          <strong>Enter your name</strong>
          <input
            autoFocus
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            type="text"
            value={name}
          />
        </label>

        <button disabled={!trimmedName} onClick={() => onStart(trimmedName)} type="button">
          Start
        </button>
      </section>
    </main>
  );
}

export default HomeScreen;
