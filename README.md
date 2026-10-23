# Wordloop

A free five-letter word guessing game. Play unlimited rounds, or take on the daily challenge.

## Features
- **Unlimited** mode (a fresh word every round) and a shared **Daily** word with its own streak
- **Co-op multiplayer** invite rooms for two to four players: choose the room size, then share one board and six guesses to find the same word together
- Hint (one letter per round) and **Hard mode**
- Light, dark and auto themes, plus a colorblind-friendly palette
- Stats with guess distribution, saved on-device only
- Emoji share card that keeps the answer secret
- Optional sound effects, confetti, keyboard + touch support
- Installable as an app (PWA) and works offline after the first visit

Multiplayer rooms need an internet connection and use PeerJS Cloud for signaling before the browsers connect directly. The host can choose a room size of two, three, or four players; the host must keep the game page open until the case ends. Solo modes still work offline.

## Files
- `index.html` — the whole game (HTML, CSS, JS, word lists)
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` — app install + offline support

## Deploy
It's a static site. Commit these files to the repo connected to Vercel and it deploys automatically.
