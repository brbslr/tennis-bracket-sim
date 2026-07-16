# Fantasy GS Mix Tennis Sim

Fantasy Grand Slam (GS) mixed-doubles tennis simulation and prediction game, drafting from the men's and women's singles quarterfinalists (QF) of the corresponding GS tournament, built on real historical GS data.

## Current status: user pick with terminal version

The user drafts one male + one female QF as their fantasy mixed doubles team by following the terminal prompt; the remaining 14 players are randomly paired into 7 more teams; 

an 8-team bracket is simulated based on team strength. The user can simulate as many times as they want.

### Files (current version)

- `quarterfinalists.json` data of the QF with stats to help determine team strength

- `simulate-mixed-doubles.js` — the simulation engine:

  - Run with node simulate-mixed-doubles.js and follow the prompts

  - Every run is a fresh, independent simulation — just run the script again
    for a new result. The terminal will show you the main stat used for the simulation. 
    
    Picking the eventual champion is intentionally difficult as it would be in real life too, so experiment with different team combinations.

### Tournament selection

- The user can pick **any Grand Slam tournament they want** to
  simulate, from the last four decades:
  
- Australian Open
  
- French Open
  
- Wimbledon
  
- US Open 
  
- Tournaments range from **1990 Australian Open through 2026 Wimbledon**. 

### How the team-drafting works

- The user picks one male and one female player who reached the **quarterfinals**
  of their chosen tournament, forming their fantasy mixed doubles team

- The remaining quarterfinalists are randomly paired into the rest of the
  bracket.

### Scoring and balance

To determine a winner, the simulation calculates each team's strength using the square of the team's average career serve points won percentage.

Squaring the value helps produce realistic separation between teams while keeping match probabilities within a 15%–85% range, ensuring that no matchup is ever a near-certain win or loss.

The probability of a team winning is calculated as:

Team Strength ÷ (Team Strength + Opponent Strength)

Then a random number is generated between 0 and 1 if that number is below the result your team wins else opponent wins.

Example

Suppose you choose Novak Djokovic (67.3%) and Coco Gauff (62.0%).

Their average serve points won percentage is:

64.65%

They play against Félix Auger-Aliassime and Karolína Muchová, whose average is:

61.7%

The win probability is calculated as:

(0.6465²) / (0.6465² + 0.617²) = 0.51

If the random number generated between 0 and 1 is lower than 0.51 Djokovic and Gauff win.

If higher muchova and FAA win.

## Previous versions
0. Wimbledon 2026-only simulation with hardcoded player selections.
1. Terminal simulation supporting every Grand Slam tournament from the 1990 Australian Open through 2026 Wimbledon, with tournament selection.
2. Updated the team strength formula to use each player's career serve points won percentage instead of ATP/WTA ranking.

## Possible next versions

- Develop a mobile-friendly web application that is accessible to everyone.
- update when a new tournament quarterfinals start.
- add quality of life updates like simulation history, detailed simulation with scores ...
- balancing updates if demanded.

