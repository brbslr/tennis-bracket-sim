// simulate-mixed-doubles.js
// Interactive CLI: pick any tournament from quarterfinalists.json, then draft
// one male + one female QF player as your fantasy mixed doubles team.
// The remaining 7 men + 7 women are randomly paired into 7 more teams.
// An 8-team bracket is simulated based on each team's average career
// service-points-won% (higher = stronger), with a probability cap so the
// best team doesn't win overwhelmingly often.
//
// Unlimited simulations - just run the script again to pick a new
// tournament/team.
//
// Run with: node simulate-mixed-doubles.js

// Node's built-in file system module - lets us read quarterfinalists.json
// from disk. "fs" is the conventional short name for this module.
const fs = require("fs");
// Node's built-in module for reading typed input from the terminal, one
// line at a time, which is what powers every prompt in this script.
const readline = require("readline");

// The relative path to the dataset file. "./" means "in this same folder".
const DATA_FILE = "./quarterfinalists.json";

// If a player has no computable career service-points-won% at all (neither
// real nor estimated - shouldn't normally happen after generate-dataset.js's
// estimation pass, but guarded here anyway), this flat placeholder value is
// used instead so the match math never breaks.
const DEFAULT_SVC_PTS_PCT = 55;

// A single readline "interface" (an open connection between this script and
// your terminal's keyboard input) that every question in this script shares.
// Creating a fresh one per question can break with certain input methods,
// so we make exactly one and reuse it everywhere.
const rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });

// readline's built-in .question() method uses an old-style callback
// (a function you pass in that gets called later). This wraps that in a
// Promise instead, so the rest of the script can write the much more
// readable "const answer = await ask(...)" instead of nesting callbacks.
function ask(question) {
  // "return new Promise(...)" hands back a Promise that will eventually
  // contain the user's answer, once they actually type something and hit Enter.
  return new Promise((resolve) => {
    // Print the prompt text, then wait; when the user answers, this inner
    // function runs with their typed text as "answer".
    rlInterface.question(question, (answer) => {
      // .trim() removes accidental leading/trailing spaces from what they typed,
      // then "resolve" fills in the Promise with that cleaned-up value.
      resolve(answer.trim());
    });
  });
}

// The Fisher-Yates shuffle algorithm: returns a NEW array with the same
// elements as "array", but rearranged into a uniformly random order.
// Used both to randomly pair up non-drafted players into teams, and to
// randomize which teams face which in the bracket.
function shuffle(array) {
  // Spread "array" into a new array so we copy it rather than editing the
  // original array the caller passed in.
  const arr = [...array];
  // Walk backward from the last index down to index 1 (not 0, since a
  // single remaining element has nothing left to swap with).
  for (let i = arr.length - 1; i > 0; i--) {
    // Pick a random index from 0 up to and including i.
    const j = Math.floor(Math.random() * (i + 1));
    // Swap the elements at positions i and j using array destructuring -
    // this one line does what would otherwise take a temporary variable.
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Return the now-shuffled copy.
  return arr;
}

// Given a player object, returns the service-points-won% value that should
// actually be used in the strength/probability math.
function effectiveSvcPtsPct(player) {
  // Check that the stat exists and is a real, valid number (not undefined,
  // not null, not NaN) before trusting it.
  return typeof player.svcPtsWonPct === "number" && !isNaN(player.svcPtsWonPct)
    ? player.svcPtsWonPct // it's valid - use the player's real/estimated stat
    : DEFAULT_SVC_PTS_PCT; // it's missing/invalid - fall back to the flat default
}

// ---- Tournament picker ----
// Lets the user optionally type a filter (since there are ~146 tournaments -
// too many to usefully print all at once), then pick one by number.
// "async" means this function can use "await" inside it to pause on
// user input without blocking the rest of the program.
async function pickTournament(tournaments) {
  // Start out assuming no filter - the full list of tournaments.
  let filtered = tournaments;

  // Ask the question and PAUSE HERE (that's what "await" does) until the
  // user actually types something and presses Enter.
  const filterInput = await ask(
    `There are ${tournaments.length} tournaments available.\n` +
    `Type part of a name or year to filter (e.g. "wimbledon" or "2015"), or press Enter to see all:\n> `
  );

  // If they typed anything at all (an empty Enter press is falsy, so this
  // block is skipped entirely if they just hit Enter)...
  if (filterInput) {
    // Lowercase their input once, so the comparison below is
    // case-insensitive ("Wimbledon" matches "wimbledon").
    const needle = filterInput.toLowerCase();
    // Keep only the tournaments whose display name OR internal key
    // contains the typed text somewhere in it.
    filtered = tournaments.filter(
      (t) => t.tournament.toLowerCase().includes(needle) || t.key.toLowerCase().includes(needle)
    );
    // If literally nothing matched their filter...
    if (filtered.length === 0) {
      // ...tell them, and fall back to showing everything rather than
      // leaving them stuck looking at an empty list.
      console.log(`No tournaments matched "${filterInput}". Showing all instead.\n`);
      filtered = tournaments;
    }
  }

  // Print a blank line for visual spacing before the list.
  console.log("");
  // Print every candidate tournament with a 1-based number next to it
  // (i is 0-based internally, so we add 1 for a human-friendly "1., 2., ...").
  filtered.forEach((t, i) => console.log(`  ${i + 1}. ${t.tournament}`));

  // Ask which number they want, again pausing until they answer.
  const choice = await ask(`\nPick a tournament (1-${filtered.length}):\n> `);
  // parseInt turns their typed text (e.g. "3") into an actual number (3).
  // Subtract 1 to convert their 1-based choice into a 0-based array index.
  const idx = parseInt(choice, 10) - 1;

  // Check whether that index is actually usable: not "Not a Number" (isNaN),
  // not negative, and not beyond the end of the filtered list.
  if (isNaN(idx) || idx < 0 || idx >= filtered.length) {
    // Tell them it didn't work...
    console.log("Invalid choice, try again.\n");
    // ...and call this same function again from scratch, with the FULL
    // tournament list (not the filtered one), in case their filter text
    // itself was the mistake. "return" here both restarts the picker and
    // passes its eventual result back up to whoever called pickTournament.
    return pickTournament(tournaments);
  }

  // A valid choice was made - hand back the actual tournament object
  // (not just its number) to whoever called this function.
  return filtered[idx];
}

// ---- Player picker ----
// Prints a numbered list of players (each with their stat, or a note about
// where that stat came from) and lets the user pick one by number.
// "players" is the list to choose from; "label" is the heading text shown
// above the list, e.g. "Pick your male player".
async function pickPlayer(players, label) {
  // Print the heading with a blank line before it for spacing.
  console.log(`\n${label}:`);
  // Build and print one line per player.
  players.forEach((p, i) => {
    // Declare a variable we'll fill in below depending on this player's data.
    let statLabel;
    // Case 1: no usable stat at all (shouldn't normally happen once
    // generate-dataset.js's estimation step has run, but guarded anyway).
    if (typeof p.svcPtsWonPct !== "number" || isNaN(p.svcPtsWonPct)) {
      statLabel = "no data (uses tour-average default)";
    } else if (p.svcPtsWonPctEstimated) {
      // Case 2: this value came from the rank-based ESTIMATION model, not
      // from real match history - marked with a ~ and said explicitly.
      statLabel = `~${p.svcPtsWonPct}% career service points won (estimated from rank)`;
    } else {
      // Case 3: a real, computed-from-actual-matches career stat.
      statLabel = `${p.svcPtsWonPct}% career service points won`;
    }
    // Print this player's line: number, name, and whichever label applies.
    console.log(`  ${i + 1}. ${p.name} (${statLabel})`);
  });

  // Ask which player number they want.
  const choice = await ask(`Pick one (1-${players.length}):\n> `);
  // Convert their 1-based typed choice into a 0-based array index.
  const idx = parseInt(choice, 10) - 1;

  // Same invalid-input guard pattern as pickTournament above: if the index
  // isn't usable, say so and ask again instead of crashing or guessing.
  if (isNaN(idx) || idx < 0 || idx >= players.length) {
    console.log("Invalid choice, try again.");
    return pickPlayer(players, label);
  }

  // Valid choice - return the actual player object they picked.
  return players[idx];
}

// Formats a single player's name for display in the bracket output,
// appending a ~ if their stat is an estimate rather than real data - the
// same marker convention used in the picker above, kept consistent here.
function displayName(player) {
  return player.svcPtsWonPctEstimated ? `${player.name}~` : player.name;
}

// Builds all 8 mixed-doubles teams for the bracket: the user's own drafted
// team, plus 7 more teams made by randomly pairing up everyone else in the
// tournament's quarterfinalist pool (7 remaining men + 7 remaining women).
function buildTeams(tournament, userMale, userFemale) {
  // .filter() keeps every player EXCEPT the one matching the condition -
  // here, every male QF player except the one the user drafted.
  const remainingMen = tournament.men.filter((p) => p.name !== userMale.name);
  // Same idea for the women's side.
  const remainingWomen = tournament.women.filter((p) => p.name !== userFemale.name);

  // Shuffle both remaining pools independently, so which man ends up
  // paired with which woman is different on every run of the script.
  const shuffledMen = shuffle(remainingMen);
  const shuffledWomen = shuffle(remainingWomen);

  // Start the teams array with the user's own team as its first entry.
  // "isUserTeam: true" tags it so we can recognize it later, after the
  // bracket has been simulated, to check whether the user actually won.
  const teams = [{ players: [userMale, userFemale], isUserTeam: true }];

  // Walk through the shuffled remaining players by matching position:
  // shuffledMen[0] gets paired with shuffledWomen[0], and so on. Both
  // arrays are exactly length 7 at this point (8 total minus the 1 drafted
  // from each side), so this pairs everyone up with nobody left over.
  for (let i = 0; i < shuffledMen.length; i++) {
    // Add one more team to the array for this man/woman pairing.
    teams.push({
      players: [shuffledMen[i], shuffledWomen[i]],
      isUserTeam: false // every one of these 7 teams is NOT the user's
    });
  }

  // .map() here doesn't change how many teams there are - it returns a new
  // array where every team object has two extra fields added on top of what
  // it already had (players, isUserTeam):
  return teams.map((t) => ({
    ...t, // "spread" - keep every field the team object already had
    // names: a display-ready name for each player (with ~ if estimated),
    // joined later with " / " wherever it's printed.
    names: t.players.map((p) => displayName(p)),
    // avgSvcPtsPct: this team's overall strength number, used to decide
    // match outcomes below - the simple average of both players'
    // effective service-points-won% values.
    avgSvcPtsPct: (effectiveSvcPtsPct(t.players[0]) + effectiveSvcPtsPct(t.players[1])) / 2
  }));
}

// Without a cap, a team with a big strength advantage could end up winning
// almost every single match (see the worked example at the bottom of this
// file for exactly how). MIN_PROB and MAX_PROB clamp every match's odds
// into this range, so the strongest team tops out at an 85% chance per
// match, and the weakest team always keeps at least a 15% chance.
const MIN_PROB = 0.15;
const MAX_PROB = 0.85;

// THE CORE OF MATCH-DECIDING LOGIC: computes the probability (a number
// between 0 and 1) that teamA beats teamB in one match. See the detailed
// walkthrough below this file for a full worked numeric example of this
// entire function.
function winProbability(teamA, teamB) {
  // Real service-points-won% values cluster tightly in a narrow band
  // (roughly 45-65% in practice), so using them directly as "strength"
  // would barely tell strong and weak teams apart. Squaring each team's
  // percentage stretches that gap out - a small percentage-point edge
  // becomes a proportionally bigger strength edge - so the maths below
  // actually favors the better team meaningfully, without needing the
  // MIN_PROB/MAX_PROB cap to do 100% of that work by itself.
  const strengthA = Math.pow(teamA.avgSvcPtsPct, 2);
  const strengthB = Math.pow(teamB.avgSvcPtsPct, 2);
  // Team A's probability of winning is its OWN strength as a fraction of
  // the COMBINED strength of both teams. If both teams were equally
  // strong, this fraction would be exactly 0.5 (a 50/50 coin flip).
  const rawP = strengthA / (strengthA + strengthB);
  // Force that raw probability to sit within [MIN_PROB, MAX_PROB], no
  // matter how lopsided the two teams' strengths actually are.
  return Math.min(MAX_PROB, Math.max(MIN_PROB, rawP));
}

// Simulates exactly one match between two teams, prints what happened, and
// returns whichever team won.
function playMatch(teamA, teamB) {
  // Get team A's win probability for this specific matchup (a number
  // between MIN_PROB and MAX_PROB, e.g. 0.62).
  const pA = winProbability(teamA, teamB);
  // Math.random() produces a random decimal somewhere in [0, 1) - every
  // value in that range is equally likely. If that random number happens
  // to land BELOW team A's win probability, team A wins; otherwise team B
  // wins. See the worked example below this file for exactly why this
  // correctly reproduces the odds computed above.
  const winner = Math.random() < pA ? teamA : teamB;
  // Log the matchup and its result to the terminal so the user can watch
  // the bracket unfold round by round.
  console.log(
    `  ${teamA.names.join("/")} (avg ${teamA.avgSvcPtsPct.toFixed(1)}% svc pts won) vs ` +
    `${teamB.names.join("/")} (avg ${teamB.avgSvcPtsPct.toFixed(1)}% svc pts won) -> ${winner.names.join("/")}`
  );
  // Hand back the winning team object to whoever called this function.
  return winner;
}

// Runs a complete single-elimination bracket across all 8 teams (3 rounds:
// quarterfinal-of-8, then semifinal-of-4, then the final-of-2) until only
// one champion team remains.
function simulateBracket(teams) {
  // Randomize the bracket's starting order, so who plays whom in round 1
  // is different every time this function runs.
  let round = shuffle(teams);
  // Tracks which round we're on, purely for the "Round 1", "Round 2" labels
  // printed to the terminal.
  let roundNum = 1;

  // Keep going as long as there's more than one team left standing.
  while (round.length > 1) {
    console.log(`\nRound ${roundNum}:`);
    // Will collect this round's winners, who become next round's field.
    const nextRound = [];
    // Step through the current round two teams at a time: (0,1), (2,3),
    // (4,5), (6,7) - each pair is exactly one match.
    for (let i = 0; i < round.length; i += 2) {
      // Play that match and remember who won.
      nextRound.push(playMatch(round[i], round[i + 1]));
    }
    // Next iteration of the while loop operates on this round's winners.
    round = nextRound;
    // Move the round counter forward for the next "Round N:" label.
    roundNum++;
  }

  // The loop above only stops once exactly one team remains in "round" -
  // that team is the tournament champion.
  return round[0];
}

// ---- Main ----
// Ties everything above together into the actual sequence of steps that
// runs when you execute this script.
async function main() {
  // Read the entire dataset file from disk as text, then parse that text
  // from JSON into a real JavaScript object/array structure we can use.
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  // Let the user search/filter and choose which tournament to play,
  // pausing here until they've made a valid choice.
  const tournament = await pickTournament(data.tournaments);
  console.log(`\nSelected: ${tournament.tournament}`);

  // Let the user draft their fantasy team: one male quarterfinalist...
  const userMale = await pickPlayer(tournament.men, "Pick your male player");
  // ...and one female quarterfinalist, from that same tournament's field.
  const userFemale = await pickPlayer(tournament.women, "Pick your female player");

  // Print a short summary before the simulation output starts, including a
  // one-line legend explaining the ~ marker used for estimated stats.
  console.log(`\nSimulating: ${tournament.tournament} - Fantasy Mixed Doubles`);
  console.log(`Your team: ${userMale.name} / ${userFemale.name}`);
  console.log(`(~ next to a name below means their stat is estimated from rank, not real career data)\n`);

  // Build all 8 teams: the user's drafted pair, plus 7 randomly paired
  // teams from everyone else in the tournament's QF field.
  const teams = buildTeams(tournament, userMale, userFemale);
  // Run the full bracket simulation down to a single champion team.
  const champion = simulateBracket(teams);
  // Check whether that champion team happens to be the user's own team
  // (recall every team object carries an isUserTeam: true/false flag).
  const userWon = champion.isUserTeam;

  // Print the final result.
  console.log(`\n=== CHAMPIONS: ${champion.names.join(" / ")} ===`);
  console.log(userWon ? "Your team won! \ud83c\udfc6" : "Your team did not win this time.");
  // Close the readline interface now that we're done asking questions.
  // Without this line, Node keeps the process alive waiting for more
  // terminal input that will never come, and the script never exits.
  rlInterface.close();
}

// Actually kick off the whole program by calling main(). Nothing above this
// line runs anything by itself - it only DEFINES functions. This is the one
// line that starts the script executing.
main();

// ============================================================================
// HOW A MATCH WINNER IS DECIDED - detailed walkthrough with a worked example
// ============================================================================
//
// Every match boils down to two steps: (1) turn each team's stat into a
// single win probability, and (2) use one random number to decide the
// outcome according to that probability. Here's both steps with real
// numbers plugged in.
//
// Say Team A is Novak Djokovic (72.0% career service points won) paired
// with Coco Gauff (58.0%), and Team B is two much weaker players averaging
// out to 50.0% combined.
//
// STEP 1 - team strength (average of both players):
//   Team A avgSvcPtsPct = (72.0 + 58.0) / 2 = 65.0
//   Team B avgSvcPtsPct = 50.0
//
// STEP 2 - square each team's average to widen the gap between them
// (winProbability's strengthA / strengthB):
//   strengthA = 65.0^2 = 4225
//   strengthB = 50.0^2 = 2500
//
// STEP 3 - Team A's raw win probability is its strength as a share of the
// combined strength of both teams:
//   rawP = 4225 / (4225 + 2500) = 4225 / 6725 ≈ 0.628  (about 62.8%)
//
// STEP 4 - clamp into [MIN_PROB, MAX_PROB] = [0.15, 0.85]. 0.628 is already
// inside that range, so it's used as-is: pA = 0.628.
//
// STEP 5 - the actual coin flip. Math.random() produces a decimal
// somewhere in [0, 1), with every value equally likely - so the CHANCE that
// it lands below 0.628 is exactly 62.8%, and the chance it lands at or
// above 0.628 is exactly 37.2%. That's what makes "Math.random() < pA"
// correctly reproduce a 62.8%-for-A / 37.2%-for-B outcome:
//
//   if Math.random() returns, say, 0.41  -> 0.41 < 0.628 is TRUE  -> Team A wins
//   if Math.random() returns, say, 0.77  -> 0.77 < 0.628 is FALSE -> Team B wins
//
// So Team A is clearly favored (a bit under 2-in-3 odds) but Team B still
// wins a bit more than 1 time in 3 - this is why upsets genuinely happen
// in this simulation rather than the stronger team always winning, and why
// the same two teams can produce a different result every time you run
// the script again.
