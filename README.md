# Wordloop

A free word game collection with five-letter detective cases and a daily four-letter word ladder.

## Features
- **Word Detective:** unlimited cases, a shared Daily word, hints, Hard mode, statistics and emoji results
- **Co-op multiplayer:** private rooms for two to four players, sharing one board and six guesses
- **Poople:** an in-app daily word ladder. Change one letter per move to reach POOP, with local progress, stats, an offline word list, and more practice ladders from the **Next word** button after a solve
- Light, dark and auto themes, a colorblind-friendly palette, sound effects and keyboard/touch input
- Installable as a PWA; solo modes work offline after the first visit

Multiplayer rooms need an internet connection. Regular browser rooms use PeerJS Cloud. The host should keep the page open until the match ends.

### Discord Activity multiplayer

Discord Activities do not support WebRTC, so they use the Vercel room relay instead of PeerJS. Discord rooms support two players and poll over HTTPS about once per second. This uses Vercel Functions and Runtime Cache; usage can count toward your Vercel plan's included or billable usage. `vercel.json` pins the relay function to one region because Runtime Cache data is region-scoped.

Deploy the repository on Vercel with the `api/room.js` route enabled. In the Discord Developer Portal, set **Activities → URL Mappings** so `/` points to this site's Vercel deployment. The relay uses the same mapping; no separate PeerJS mapping is needed. After deploying, relaunch the Activity and have the second player join with the room code.

The host must keep the Activity open until the case ends. Discord rooms are separate from regular browser rooms.

## Files
- `index.html` — the game interface, styles and application logic
- `peerjs.min.js` — bundled PeerJS 1.5.5 client for regular browser rooms
- `PEERJS_LICENSE.txt` — PeerJS license
- `api/room.js` and `api/room-core.js` — Vercel relay endpoint for Discord Activity rooms
- `vercel.json` — pins the relay to the Runtime Cache region
- `poople-words.js` — four-letter subset used by Poople; see `THIRD_PARTY_NOTICES.md`
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` — app install and offline support

## Deploy
The game files are static, with one Vercel Function for Discord Activity rooms. Commit the files to the repository connected to Vercel to deploy automatically.
