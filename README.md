# Mix Tennis Grand Slam Draw Simulator

Fantasy Grand Slam mixed-doubles tennis simulation and prediction 
game (drafting from the men's and women's singles quarterfinalists of the corresponding grandslam tournament) built on real historical Grand Slam data.

## Current status: V0 — Mixed Doubles Fantasy Simulator (Wimbledon 2026)

The current version is hardcoded to the real Wimbledon 2026 men's and women's singles quarterfinalists.
One male + one female QF player picked as the fantasy mixed
doubles team; the remaining 14 players are randomly paired into 7 more teams;
an 8-team bracket is simulated based on team strength (average rank of the
two players); You can simulate once per day.

## Files (current version)

- `quarterfinalists.json` — the real Wimbledon 2026 QF fields for men's and
  women's singles (8 players each), with rank derived from tournament
  seeding. A couple of unseeded players (Struff, Fery) have estimated ranks,
  flagged `"_estimated": true`.
- `simulate-mixed-doubles.js` — the engine:
  - The user's team is currently hardcoded at the top of the file
    (`USER_PICK`) — edit the two names to "draft" a different team, until a
    real picker UI exists.
  - The remaining 7 men + 7 women are randomly shuffled and paired into 7
    opponent teams.
  - Team strength uses **inverse average rank** (`1 / avgRank`), and win
    probability is a ratio of strengths. This dampens the gap between strong
    and weak teams on purpose, so the best team wins more often but not
    automatically — upsets are meant to happen.
  - A **daily lock** (`last-play.json`) stores today's date and result; a
    second run on the same day just shows the already-locked result instead
    of re-simulating. Delete `last-play.json` to reset for testing.

## Run it

```bash
node simulate-mixed-doubles.js
```

Run it a several times (deleting `last-play.json` between runs) to get a
feel for how often the strongest team actually wins vs. how often an upset
happens — that balance is the main thing worth tuning as this evolves.


### Desired Direction (Long-Term Vision)

The finalized long-term concept: a daily fantasy mixed-doubles prediction
game built entirely on **real historical Grand Slam data**, rather than
live/future tournaments (this avoids needing any attendance-prediction
model or live data feed — everything can be precomputed from historical
records).

### How the daily tournament is selected

- Each day, the user is presented with a random combination of **Grand Slam
  tournament** (Australian Open, French Open, Wimbledon, US Open) and
  **era** (1990s, 2000s, 2010s, 2020-2025).
- **Both the tournament and the era must differ from yesterday's.** E.g. if
  today was Wimbledon 2010s, tomorrow cannot be Wimbledon (any era) or any
  2010s tournament — it must be a different Slam *and* a different decade.
  With 4 Slams × 4 eras = 16 combinations, excluding yesterday's tournament
  and era leaves 9 valid combinations to randomly choose from each day.
- Since all data is historical, this can be fully precomputed — no live
  scraping or attendance modeling needed.

### How the team-drafting works

- The user picks one male and one female player who made the **quarterfinal**
  of that tournament/era's real draw, forming their fantasy mixed doubles
  team — the same mechanic proven in the current V0, just generalized across
  eras/tournaments instead of hardcoded to Wimbledon 2026.
- The remaining quarterfinalists are randomly paired into the rest of the
  bracket.

### Scoring and balance

- Each team's strength is the **average of the two players' rankings at the
  time of that specific tournament** (not an era-wide average) — pulled from
  historical weekly rankings data (e.g. Jeff Sackmann's public datasets).
- The simulation is deliberately balanced so the best-ranked team is
  **more likely, but not guaranteed**, to win — same dampened
  strength-ratio approach as the current V0's `1 / avgRank` model.
- The user can only simulate once per day, and performance is tracked over
  time on a ladder/leaderboard.

### Why this direction works well

- All data is historical and finite, so it can be precomputed once per
  tournament/era rather than needing any live dependency.
- It's a genuinely original concept — not a clone of existing bracket
  prediction platforms.
- The core engine (draft a team, randomly fill the rest, simulate with
  dampened probability) is already proven in V0 — scaling it up is mostly
  about adding more precomputed data (other Slams, other eras) and the
  daily tournament/era rotation logic, not rebuilding the simulator itself.

## Next steps

1. Generalize `quarterfinalists.json` into a dataset covering all 4 Slams ×
   4 eras, with real QF fields and rankings-at-the-time for each.
2. Build the daily tournament/era selector (must differ from yesterday on
   both axes).
3. Replace the hardcoded `USER_PICK` with an actual UI (web page/mobile)
   where the user picks their team.
