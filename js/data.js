// Real content: projects, bio, links. Everything else in the OS is chrome around this.
export const PROJECTS = [
  { id: "flaggo", name: "Flaggo", kind: "Geography game", sum: "Learn every country, one round at a time.", icon: "globe",
    year: "2025–26", status: "Active", stack: "Vite, React, TypeScript, Supabase", live: "https://flaggo.rohanahire.com",
    blurb: "A geography game with flag, capital, map, arcade and daily-challenge modes. Spaced repetition picks what you see next, so the countries you miss keep coming back until they stick. Works offline." },
  { id: "coachmate", name: "Coachmate", kind: "Chess coach", sum: "Finds the mistakes you keep making.", icon: "chess",
    year: "2026", status: "Shipped", stack: "Next.js, Stockfish, chess.js, OpenRouter", live: "https://coachmate.rohanahire.com",
    blurb: "Type a Chess.com username and get a plain-English report on the mistakes you repeat. Then drill those exact positions, or play a bot tuned to your level. Stockfish runs in the browser, so your games stay on your device." },
  { id: "multibagger", name: "Multibagger", kind: "Trading scanner", sum: "A daily scan of every NSE stock.", icon: "chart",
    year: "2026", status: "Active", stack: "Python, Polars, DuckDB, FastAPI, React",
    blurb: "A daily scanner that checks every NSE stock for one setup: the Minervini-style swing entry. It pulls prices each evening, runs the signals in Polars, and pings Telegram only when something is worth a look." },
  { id: "extracta", name: "Extracta", kind: "Document AI", sum: "Documents in, structured data out.", icon: "extracta",
    year: "2025", status: "Demo", stack: "Next.js, Framer Motion, Three.js",
    blurb: "A demo of what document extraction should feel like: drop in an invoice or a resume and watch it turn into editable fields with confidence scores. The AI part is mocked on purpose. This one is about the product experience." },
  { id: "wacleaner", name: "WA Cleaner", kind: "Android app", sum: "Finds duplicate media and deletes it safely.", icon: "wabin",
    year: "2025", status: "Built", stack: "Expo, React Native, Room, Kotlin module",
    blurb: "An Android app that finds duplicate photos and forgotten large files, then deletes them safely, with trash and undo. It uses Android's own storage framework, so it only touches the folders you pick." },
  { id: "clenow", name: "Clenow NSE", kind: "Momentum strategy", sum: "Momentum rules, tested on Indian stocks.", icon: "momentum",
    year: "2025–26", status: "Research", stack: "Python, yfinance, Dhan API, Pandas",
    blurb: "Andreas Clenow's momentum rules, adapted for Indian stocks: rank the Nifty universe by trend strength, size positions by volatility, rebalance monthly. Backtested over ten years and now producing live signals through a broker API." },
];

export const ABOUT = "I'm an engineer who takes ideas from the first commit to something people can use. Right now that means a scanner for Indian stock markets, a geography game with daily challenges, and a chess coach that reads your games. Small tools, done properly.";
export const NOW = ["Shipping Flaggo daily challenges", "Tuning Multibagger signals", "Coachmate bot difficulty modes", "Reading Clenow, Stocks on the Move", "Exploring WASM engines"];
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
