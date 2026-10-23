# Wordloop

A free word game collection with five-letter detective cases and a daily four-letter word ladder.

## Features
- **Word Detective:** unlimited cases, a shared Daily word, hints, Hard mode, statistics and emoji results
- **Co-op multiplayer:** private rooms for two to four players, sharing one board and six guesses
- **Poople:** an in-app daily word ladder. Change one letter per move to reach POOP, with local progress, stats, an offline word list, and more practice ladders from the **Next word** button after a solve
- Light, dark and auto themes, a colorblind-friendly palette, sound effects and keyboard/touch input
- Installable as a PWA; solo modes work offline after the first visit

Multiplayer rooms need an internet connection and use PeerJS Cloud for signaling before browsers connect directly. The host should keep the page open until the match ends.

## Files
- `index.html` — the game interface, styles and application logic
- `poople-words.js` — four-letter subset used by Poople; see `THIRD_PARTY_NOTICES.md`
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` — app install and offline support

## Deploy
This is a static site. Commit the files to the repository connected to Vercel to deploy automatically.
