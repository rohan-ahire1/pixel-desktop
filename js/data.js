// Real content: projects, bio, links. Everything else in the OS is chrome around this.
export const PROJECTS = [
  { id: "recoup", name: "Recoup", kind: "Collections SaaS", sum: "Gets small unpaid invoices paid.", icon: "recoup",
    year: "2026", status: "Live demo", stack: "Next.js 15, TypeScript, SQLite, Stripe, Twilio, Claude API", live: "https://recoup.rohanahire.com",
    blurb: "Collections software for small unpaid invoices. The reminder engine is a pure function of case, history and clock, and it stops on payment, reply, promise or dispute. Customers pay through Stripe Checkout, in full or on a plan. SMS runs on Twilio with signed webhooks, and Claude reads the replies. It runs as a demo with sample data and has no real customers yet." },
  { id: "pointer", name: "Pointer", kind: "Interview course", sum: "Coding-interview patterns you can watch and run.", icon: "pointer",
    year: "2026", status: "Live", stack: "Next.js 16, React 19, TypeScript, Remotion, Vitest", live: "https://pointer.rohanahire.com",
    blurb: "A free course on the 15 patterns behind most coding-interview problems. Each lesson has a one-minute animated explainer made in Remotion and a visualizer that steps through the real algorithm, line by line. It has ⌘K search, saves progress on your device and works on a phone." },
  { id: "scoutline", name: "Scoutline", kind: "Lead research engine", sum: "Finds and scores sales leads.", icon: "scoutline",
    year: "2026", status: "Private", stack: "Node.js, Express, React, SQLite, OpenAI, headless Chrome",
    blurb: "A research engine that discovers local businesses, crawls their sites for verified emails, and scores each lead with a rule engine plus an LLM review of a screenshot of the site. A web service and a worker share a job queue with retries and timeouts, and discovery runs every night on its own. It's a private tool, so there's no public link." },
  { id: "multibagger", name: "Multibagger", kind: "Stock research platform", sum: "Backtests NSE strategies, then paper-trades the survivors.", icon: "chart",
    year: "2026", status: "Active", stack: "Python, DuckDB, Parquet, systemd",
    blurb: "A research platform for Indian stocks, built on versioned NSE data. Strategies go through walk-forward and holdout tests, and the ones that pass run as daily paper-trading books on real prices." },
  { id: "flaggo", name: "Flaggo", kind: "Geography game", sum: "Learn every country, one round at a time.", icon: "globe",
    year: "2025–26", status: "Active", stack: "Vite, React, TypeScript, Supabase", live: "https://flaggo.rohanahire.com",
    blurb: "A geography game with flag, capital, map, arcade and daily-challenge modes. Spaced repetition picks what you see next, so the countries you miss keep coming back until they stick. Works offline." },
  { id: "coachmate", name: "Coachmate", kind: "Chess coach", sum: "Finds the mistakes you keep making.", icon: "chess",
    year: "2026", status: "Shipped", stack: "Next.js, Stockfish, chess.js, OpenRouter", live: "https://coachmate.rohanahire.com",
    blurb: "Type a Chess.com username and get a plain-English report on the mistakes you repeat. Then drill those exact positions, or play a bot tuned to your level. Stockfish runs in the browser, so your games stay on your device." },
];

export const ABOUT = "I'm a full-stack engineer at Pattern with three years of shipping SaaS in TypeScript, React, Node and Python. I've built billing and payments for 48+ brands and a commission system for 67,000+ ambassadors. Outside work I take my own products from the first commit to production.";
export const NOW = ["Building livestream analytics at Pattern", "Adding lessons to Pointer", "Running Multibagger paper books", "Open to remote roles, US / EU"];
export const LINKS = { github: "https://github.com/rohan-ahire1", linkedin: "https://linkedin.com/in/rohan-ahire1" };

const HOW_TO = document.body.classList.contains("phone") ? `HOW TO USE THIS SITE
  Tap an app on the home screen to open it. Home in
  the dock takes you back, and your apps stay open.
  Play has a terminal, a paint app, Minesweeper,
  real Doom, a music player and a calculator.` : `HOW TO USE THIS DESKTOP
  Double-click an icon to open it. Drag windows by the
  title bar, or drag one to a screen edge to snap it.
  Right-click almost anything for more options.
  Start > Programs has a terminal, a paint app,
  Minesweeper and a music player. A pixel me lives
  on the taskbar, and sends you mail now and then.`;

export const README = `ROHAN AHIRE
Full-stack engineer · Mumbai · Open to remote (US/EU)
================================

${ABOUT}

NOW
${NOW.map((n) => "  - " + n).join("\n")}

AT PATTERN
  Billing and payments for 48+ brands
  Commissions for 67,000+ ambassadors across 50+ brands
  Creator system for 1,200+ TikTok creators
  AI error triage and MCP tools for the team
  Query time cut from ~60s to 0.5s
  5th of 60+ teams, Innovation Cup 2026

PROJECTS
${PROJECTS.map((p) => `  ${p.name.padEnd(13)}${p.kind} (${p.year}, ${p.status.toLowerCase()})`).join("\n")}

CONTACT
  Email     ahirerohan3.14@gmail.com
  GitHub    github.com/rohan-ahire1
  LinkedIn  linkedin.com/in/rohan-ahire1

${HOW_TO}
`;
