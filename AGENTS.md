# pixel-desktop: agent guide

Rohan Ahire's portfolio, rohanahire.com: a pixel-art desktop OS in the browser, with a separate phone version. Vanilla ES modules and canvas, no build step and no dependencies. The site is plain files served by Caddy.

## Map

- `index.html`: the desktop site. `phone.html`: the phone site.
- `js/main.js`: start-up. `js/boot.js`: boot, restart and shutdown. `js/core.js`: shared helpers.
- `js/apps/`: one module per app. `js/fs.js`: the file tree and desktop icons. `js/data.js`: projects.
- `js/film/`: the boot film and the reel. Scenes are separate from `player.js`, and all of it loads lazily.
- `css/os.css`: styles.
- `scripts/`: the syntax check, film tests and `deploy-vps.sh`.

## Rules

- Commit straight to `main` and push to `origin` (a bare repo on the VPS). No pull requests. There is no GitHub repo for this code, so the gates run on the VPS and the kit's GitHub workflows and push guard are left out on purpose. `factory update` puts them back: remove them again, and keep rule 1 below as written here.
- Films never play on phones, autoplay only for the boot, skip on any key or click, and show a still for reduced motion.
- Nothing is deployed unless Rohan asks. `scripts/deploy-vps.sh` is the only way to deploy.

<!-- factory:start -->
<!-- Managed by the factory kit from factory.json. Edit factory.json, then run `factory update`. -->

## Factory rules

### Commands

| What | Command |
|---|---|
| Prove it in a browser | `node .factory/verify.mjs --start --shots <routes>` (after the build) |
| **All gates** | `node .factory/gates.mjs` (add `--shots <routes>` for UI changes) |

### Hard rules

1. **Never run a deploy unless asked.** Commit to `main` and push to `origin`.
2. No secrets in code, logs, PRs or screenshots.

### Definition of done

A change is done only when all of these hold. Show the evidence, don't just say it:

- `node .factory/gates.mjs` passes.
- For UI changes: you ran it with `--shots <changed routes>` and looked at the mobile and desktop screenshots.
- The diff is the smallest one that solves the problem. No drive-by refactors, no new dependencies without a stated reason.
- One concern per commit. If the work is bigger, split it.
- See `docs/factory/README.md` for how the factory works.
<!-- factory:end -->
