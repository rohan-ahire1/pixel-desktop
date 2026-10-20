// Real content: projects, bio, links. Everything else in the OS is chrome around this.
export const PROJECTS = [
  { id: "flaggo", name: "Flaggo", kind: "Geography game", sum: "Learn every country, one round at a time.", icon: "globe",
    year: "2025–26", status: "Active", stack: "Vite, React, TypeScript, Supabase", live: "https://flaggo.rohanahire.com",
    blurb: "A geography game with flag, capital, map, arcade and daily-challenge modes. Spaced repetition picks what you see next, so the countries you miss keep coming back until they stick. Works offline." },
  { id: "coachmate", name: "Coachmate", kind: "Chess coach", sum: "Finds the mistakes you keep making.", icon: "chess",
    year: "2026", status: "Shipped", stack: "Next.js, Stockfish, chess.js, OpenRouter", live: "https://coachmate.rohanahire.com",
    blurb: "Type a Chess.com username and get a plain-English report on the mistakes you repeat. Then drill those exact positions, or play a bot tuned to your level. Stockfish runs in the browser, so your games stay on your device." },
  { id: "multibagger", name: "Multibagger", kind: "Stock research platform", sum: "Backtests NSE strategies, then paper-trades the survivors.", icon: "chart",
    year: "2026", status: "Active", stack: "Python, DuckDB, Parquet, systemd",
    blurb: "A research platform for Indian stocks. It backtests strategies on versioned NSE price data, with walk-forward and holdout tests to throw out anything that only worked by luck. The few that survive run every evening as paper-trading books on a server, so I can watch them on real prices before any real money goes in." },
];

export const ABOUT = "I'm an engineer who takes ideas from the first commit to something people can use. Right now that means a research platform for Indian stocks, a geography game with daily challenges, and a chess coach that reads your games. Small tools, done properly.";
export const NOW = ["Shipping Flaggo daily challenges", "Paper-trading Multibagger's momentum books", "Coachmate bot difficulty modes", "Exploring WASM engines"];
export const LINKS = { github: "https://github.com/rohan-ahire1", linkedin: "https://linkedin.com/in/rohanahire" };

export const README = `ROHAN AHIRE
Builder · India · Remote
================================

${ABOUT}

NOW
${NOW.map((n) => "  - " + n).join("\n")}

WORK
${PROJECTS.map((p) => `  ${p.name.padEnd(13)}${p.kind} (${p.year}, ${p.status.toLowerCase()})`).join("\n")}

CONTACT
  Email     rohanahire1607@gmail.com
  GitHub    github.com/rohan-ahire1
  LinkedIn  linkedin.com/in/rohanahire

HOW TO USE THIS DESKTOP
  Double-click an icon to open it. Drag windows by the
  title bar, or drag one to a screen edge to snap it.
  Right-click almost anything for more options.
  Start > Programs has a terminal, a paint app,
  Minesweeper and a music player. A pixel me lives
  on the taskbar, and sends you mail now and then.
`;
