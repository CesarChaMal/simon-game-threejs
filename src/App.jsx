import { useEffect, useState } from "react";
import Board3D, { PADS } from "./Board3D.jsx";

const randomPad = () => PADS[Math.floor(Math.random() * PADS.length)].id;
const STORAGE_KEY = "simon-game-threejs-best";

function readBestScore() {
  try {
    return {
      score: Number(window.localStorage.getItem(STORAGE_KEY)) || 0,
      unavailable: false,
    };
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
    return { score: 0, unavailable: true };
  }
}

export default function App() {
  const [storage, setStorage] = useState(readBestScore);
  const [sequence, setSequence] = useState([]);
  const [expectedIndex, setExpectedIndex] = useState(0);
  const [activePad, setActivePad] = useState(null);
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(storage.score);

  useEffect(() => {
    if (phase !== "showing" || sequence.length === 0) return undefined;

    let cancelled = false;
    const timers = [];
    const firstDelay = 520;
    const stepDuration = 720;

    sequence.forEach((pad, index) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setActivePad(pad);
          timers.push(window.setTimeout(() => setActivePad(null), 330));
        }, firstDelay + index * stepDuration),
      );
    });

    timers.push(
      window.setTimeout(() => {
        if (!cancelled) {
          setActivePad(null);
          setExpectedIndex(0);
          setPhase("input");
        }
      }, firstDelay + sequence.length * stepDuration),
    );

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [phase, sequence]);

  function startGame() {
    setSequence([randomPad()]);
    setExpectedIndex(0);
    setActivePad(null);
    setScore(0);
    setPhase("showing");
  }

  function handlePadClick(padId) {
    if (phase !== "input") return;
    setActivePad(padId);
    window.setTimeout(() => setActivePad(null), 150);

    if (sequence[expectedIndex] !== padId) {
      setPhase("lost");
      return;
    }

    const nextIndex = expectedIndex + 1;
    if (nextIndex === sequence.length) {
      const nextScore = score + 1;
      setScore(nextScore);
      if (nextScore > bestScore) {
        setBestScore(nextScore);
        try {
          window.localStorage.setItem(STORAGE_KEY, String(nextScore));
        } catch (error) {
          if (!(error instanceof DOMException)) throw error;
          setStorage((current) => ({ ...current, unavailable: true }));
        }
      }
      setSequence((current) => [...current, randomPad()]);
      setPhase("showing");
    } else {
      setExpectedIndex(nextIndex);
    }
  }

  function handlePadButtonClick(padId) {
    handlePadClick(padId);
  }

  const statusText = {
    ready: "Press start when you're ready.",
    showing: "Watch the sequence…",
    input: "Your turn — repeat the sequence.",
    lost: "Not quite. Start again and beat your best.",
  }[phase];

  return (
    <main className="page">
      <section className="game-shell" aria-labelledby="game-title">
        <header className="game-header">
          <div className="brand-icon" aria-hidden="true">S</div>
          <div>
            <p className="eyebrow">A MEMORY GAME IN THREE DIMENSIONS</p>
            <h1 id="game-title">Simon 3D</h1>
          </div>
        </header>

        <section className="game-card" aria-label="Simon memory game">
          <div className="score-row">
            <div className="score">
              <span className="score-label">SCORE</span>
              <strong>{score}</strong>
            </div>
            <p
              className={`game-status game-status--${phase}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" />
              {statusText}
            </p>
            <div className="score score--progress">
              <span className="score-label">BEST</span>
              <strong>{bestScore}</strong>
            </div>
          </div>

          <Board3D
            activePad={activePad}
            acceptingInput={phase === "input"}
            onPadClick={handlePadClick}
          />

          <div className="pad-controls" aria-label="Color pads">
            {PADS.map((pad, index) => (
              <button
                className={`pad-control pad-control--${pad.id}`}
                key={pad.id}
                type="button"
                disabled={phase !== "input"}
                onClick={() => handlePadButtonClick(pad.id)}
                aria-label={`${pad.name} pad, key ${index + 1}`}
              >
                <span className="pad-control-dot" />
                {pad.name}
                <kbd>{index + 1}</kbd>
              </button>
            ))}
          </div>

          <button className="start-button" type="button" onClick={startGame}>
            <span aria-hidden="true">{phase === "showing" || phase === "input" ? "↻" : "▶"}</span>
            {phase === "ready" ? "Start game" : "Restart game"}
          </button>
          <p className="instruction">
            Watch the lights, then repeat their pattern using the 3D pads or
            buttons. Each round adds one new color.
          </p>
          {storage.unavailable && (
            <p className="storage-warning" role="status">
              Browser storage is unavailable, so your best score will not be saved.
            </p>
          )}
        </section>

        <footer className="game-footer">
          <span className="footer-line" />
          <p>Built with React &amp; Three.js</p>
          <span className="footer-line" />
        </footer>
      </section>
    </main>
  );
}
