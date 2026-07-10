// simulate-mixed-doubles.js
// V0 for the new direction: hardcoded to Wimbledon 2026 quarterfinalists.
// User "drafts" one male + one female QF player as their mixed doubles team.
// The remaining 7 men + 7 women are randomly paired into 7 more teams.
// An 8-team bracket is simulated based on each team's average rank
// (lower rank number = stronger), with dampening so the best team
// doesn't win overwhelmingly often.
//
// Run with: node simulate-mixed-doubles.js

// Node's built-in file system module - lets us read/write JSON files on disk.
const fs = require("fs");

// Path to the quarterfinalist player pool (read-only data for this run).
const DATA_FILE = "./quarterfinalists.json";
// Path to the file that tracks "have I already played today" (created/updated by this script).
const LOCK_FILE = "./last-play.json";

// ---- HARDCODED USER PICK (V0 - no UI yet, edit these two names to "play") ----
// In a real app this would come from user input (a form/click); for V0 you just
// edit these two strings directly in the code to change who you're drafting.
const USER_PICK = {
  male: "Jannik Sinner",
  female: "Coco Gauff"
};
// -------------------------------------------------------------------------

// Returns today's date as "YYYY-MM-DD", used to compare against the lock file's saved date.
function todayString() {
  // new Date() = current date/time. toISOString() = e.g. "2026-07-10T14:32:01.000Z".
  // slice(0, 10) trims that down to just "2026-07-10".
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Checks whether the user is allowed to simulate today.
// Returns true if they CAN play (no lock yet, or lock is from a previous day).
// Returns false (and prints their existing result) if they've already played today.
function checkDailyLock() {
  // If the lock file doesn't exist yet, nobody has played today (or ever) - allow it.
  if (!fs.existsSync(LOCK_FILE)) return true;

  // Read and parse the saved lock data from disk.
  const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));

  // If the saved date matches today's date, they've already used their daily play.
  if (lock.date === todayString()) {
    console.log(`You've already simulated today (${lock.date}). Your team's result:`);
    console.log(`  Your team: ${lock.userTeam.join(" / ")}`);
    console.log(`  Champion:  ${lock.champion.join(" / ")}`);
    console.log(`  You won:   ${lock.userWon ? "YES" : "no"}`);
    return false; // block a second simulation today
  }

  // Lock file exists but is from an earlier day - a new day means a new play is allowed.
  return true;
}

// Writes today's result to the lock file, so a second run today will be blocked
// and will show this same saved result instead of re-simulating.
function saveDailyLock(userTeam, champion, userWon) {
  fs.writeFileSync(
    LOCK_FILE,
    // JSON.stringify(..., null, 2) formats the JSON with 2-space indentation,
    // just for readability if you open the file yourself.
    JSON.stringify({ date: todayString(), userTeam, champion, userWon }, null, 2)
  );
}

// Returns a new array with the same elements as `array`, but in random order.
// Uses the Fisher-Yates shuffle algorithm (standard, unbiased way to shuffle).
function shuffle(array) {
  const arr = [...array]; // copy the array so we don't mutate the original
  // Walk backward through the array...
  for (let i = arr.length - 1; i > 0; i--) {
    // ...pick a random earlier (or same) index...
    const j = Math.floor(Math.random() * (i + 1));
    // ...and swap the current element with that random one.
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds all 8 mixed-doubles teams: the user's drafted team, plus 7 randomly
// paired teams made from everyone else in the quarterfinalist pool.
function buildTeams(data, userPick) {
  // Every male QF player except the one the user picked.
  const remainingMen = data.men.filter((p) => p.name !== userPick.male);
  // Every female QF player except the one the user picked.
  const remainingWomen = data.women.filter((p) => p.name !== userPick.female);

  // Randomize the order of the remaining players before pairing them up,
  // so who ends up on a team together is different every run.
  const shuffledMen = shuffle(remainingMen);
  const shuffledWomen = shuffle(remainingWomen);

  // Look up the full player objects (with rank) for the user's two picks.
  const userMale = data.men.find((p) => p.name === userPick.male);
  const userFemale = data.women.find((p) => p.name === userPick.female);

  // Start the teams list with the user's own team, flagged with isUserTeam: true
  // so we can later check whether the user won.
  const teams = [
    { players: [userMale, userFemale], isUserTeam: true }
  ];

  // Pair up the shuffled remaining men and women one-to-one into 7 more teams.
  // (shuffledMen and shuffledWomen are both length 7, since one of each was removed above.)
  for (let i = 0; i < shuffledMen.length; i++) {
    teams.push({
      players: [shuffledMen[i], shuffledWomen[i]],
      isUserTeam: false
    });
  }

  // Add two convenience fields to every team before returning:
  // - names: just the two players' names, for easy printing
  // - avgRank: the team's average rank, used to compute win probability later
  return teams.map((t) => ({
    ...t, // keep existing fields (players, isUserTeam)
    names: t.players.map((p) => p.name),
    avgRank: (t.players[0].rank + t.players[1].rank) / 2
  }));
}

// Strength is inverse of average rank - lower rank number = higher strength.
// Using strength ratios (rather than raw rank difference) naturally dampens
// blowout probabilities, so the best team wins more often but not always.
function winProbability(teamA, teamB) {
  // Example: rank 4 -> strength 0.25. Rank 40 -> strength 0.025.
  // A 10x rank gap only becomes a 10x strength gap, not an unbeatable one,
  // once it's turned into a probability below.
  const strengthA = 1 / teamA.avgRank;
  const strengthB = 1 / teamB.avgRank;
  // Converts the two strengths into a probability between 0 and 1 that team A wins.
  return strengthA / (strengthA + strengthB);
}

// Simulates a single match between two teams and returns the winner.
function playMatch(teamA, teamB) {
  const pA = winProbability(teamA, teamB);
  // Math.random() gives a random decimal between 0 and 1.
  // If it lands below team A's win probability, A wins; otherwise B wins.
  const winner = Math.random() < pA ? teamA : teamB;
  console.log(
    `  ${teamA.names.join("/")} (avg rank ${teamA.avgRank}) vs ` +
    `${teamB.names.join("/")} (avg rank ${teamB.avgRank}) -> ${winner.names.join("/")}`
  );
  return winner;
}

// Runs a full single-elimination bracket across all 8 teams until one champion remains.
function simulateBracket(teams) {
  let round = shuffle(teams); // randomize bracket order so matchups differ each run
  let roundNum = 1;

  // Keep simulating rounds until only one team is left standing.
  while (round.length > 1) {
    console.log(`\nRound ${roundNum}:`);
    const nextRound = [];
    // Step through the current round two teams at a time (i, i+1 = one match).
    for (let i = 0; i < round.length; i += 2) {
      nextRound.push(playMatch(round[i], round[i + 1]));
    }
    round = nextRound; // winners become next round's field
    roundNum++;
  }

  // Only one team left - that's the champion.
  return round[0];
}

// ---- Main ----
// Everything below only runs if checkDailyLock() returns true (i.e. user hasn't played today).
if (checkDailyLock()) {
  // Load the quarterfinalist player pool from disk.
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`Simulating: ${data.tournament} - Fantasy Mixed Doubles\n`);
  console.log(`Your team: ${USER_PICK.male} / ${USER_PICK.female}\n`);

  // Build all 8 teams (user's pick + 7 random pairings), then simulate the bracket.
  const teams = buildTeams(data, USER_PICK);
  const champion = simulateBracket(teams);
  // Check whether the winning team happens to be the user's own team.
  const userWon = champion.isUserTeam;

  console.log(`\n=== CHAMPIONS: ${champion.names.join(" / ")} ===`);
  console.log(userWon ? "Your team won! 🏆" : "Your team did not win this time.");

  // Save today's result so a second run today shows this result instead of re-simulating.
  saveDailyLock([USER_PICK.male, USER_PICK.female], champion.names, userWon);
}
