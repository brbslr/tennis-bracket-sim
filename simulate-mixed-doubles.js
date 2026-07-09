// simulate-mixed-doubles.js
// V0 for the new direction: hardcoded to Wimbledon 2026 quarterfinalists.
// User "drafts" one male + one female QF player as their mixed doubles team.
// The remaining 7 men + 7 women are randomly paired into 7 more teams.
// An 8-team bracket is simulated based on each team's average rank
// (lower rank number = stronger), with dampening so the best team
// doesn't win overwhelmingly often.
//
// Run with: node simulate-mixed-doubles.js

const fs = require("fs");

const DATA_FILE = "./quarterfinalists.json";
const LOCK_FILE = "./last-play.json";

// ---- HARDCODED USER PICK (V0 - no UI yet, edit these two names to "play") ----
const USER_PICK = {
  male: "Jannik Sinner",
  female: "Coco Gauff"
};
// -------------------------------------------------------------------------

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function checkDailyLock() {
  if (!fs.existsSync(LOCK_FILE)) return true;
  const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
  if (lock.date === todayString()) {
    console.log(`You've already simulated today (${lock.date}). Your team's result:`);
    console.log(`  Your team: ${lock.userTeam.join(" / ")}`);
    console.log(`  Champion:  ${lock.champion.join(" / ")}`);
    console.log(`  You won:   ${lock.userWon ? "YES" : "no"}`);
    return false;
  }
  return true;
}

function saveDailyLock(userTeam, champion, userWon) {
  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({ date: todayString(), userTeam, champion, userWon }, null, 2)
  );
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildTeams(data, userPick) {
  const remainingMen = data.men.filter((p) => p.name !== userPick.male);
  const remainingWomen = data.women.filter((p) => p.name !== userPick.female);

  const shuffledMen = shuffle(remainingMen);
  const shuffledWomen = shuffle(remainingWomen);

  const userMale = data.men.find((p) => p.name === userPick.male);
  const userFemale = data.women.find((p) => p.name === userPick.female);

  const teams = [
    { players: [userMale, userFemale], isUserTeam: true }
  ];

  for (let i = 0; i < shuffledMen.length; i++) {
    teams.push({
      players: [shuffledMen[i], shuffledWomen[i]],
      isUserTeam: false
    });
  }

  return teams.map((t) => ({
    ...t,
    names: t.players.map((p) => p.name),
    avgRank: (t.players[0].rank + t.players[1].rank) / 2
  }));
}

// Strength is inverse of average rank - lower rank number = higher strength.
// Using strength ratios (rather than raw rank difference) naturally dampens
// blowout probabilities, so the best team wins more often but not always.
function winProbability(teamA, teamB) {
  const strengthA = 1 / teamA.avgRank;
  const strengthB = 1 / teamB.avgRank;
  return strengthA / (strengthA + strengthB);
}

function playMatch(teamA, teamB) {
  const pA = winProbability(teamA, teamB);
  const winner = Math.random() < pA ? teamA : teamB;
  console.log(
    `  ${teamA.names.join("/")} (avg rank ${teamA.avgRank}) vs ` +
    `${teamB.names.join("/")} (avg rank ${teamB.avgRank}) -> ${winner.names.join("/")}`
  );
  return winner;
}

function simulateBracket(teams) {
  let round = shuffle(teams); // random initial bracket order
  let roundNum = 1;

  while (round.length > 1) {
    console.log(`\nRound ${roundNum}:`);
    const nextRound = [];
    for (let i = 0; i < round.length; i += 2) {
      nextRound.push(playMatch(round[i], round[i + 1]));
    }
    round = nextRound;
    roundNum++;
  }

  return round[0];
}

// ---- Main ----
if (checkDailyLock()) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`Simulating: ${data.tournament} - Fantasy Mixed Doubles\n`);
  console.log(`Your team: ${USER_PICK.male} / ${USER_PICK.female}\n`);

  const teams = buildTeams(data, USER_PICK);
  const champion = simulateBracket(teams);
  const userWon = champion.isUserTeam;

  console.log(`\n=== CHAMPIONS: ${champion.names.join(" / ")} ===`);
  console.log(userWon ? "Your team won! 🏆" : "Your team did not win this time.");

  saveDailyLock([USER_PICK.male, USER_PICK.female], champion.names, userWon);
}
