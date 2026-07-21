// app.js
// Browser port of simulate-mixed-doubles.js. Same game logic (team building,
// strength formula, probability cap), swapped from readline prompts to a
// mobile-friendly tap UI, and from fs.readFileSync to fetch().

const DATA_FILE = "./quarterfinalists.json";
const DEFAULT_SVC_PTS_PCT = 55; // tour-average placeholder if a player has no stat at all
const MIN_PROB = 0.15;
const MAX_PROB = 0.85;

let allTournaments = [];
let selectedTournament = null;
let selectedMale = null;
let selectedFemale = null;

// ---- DOM refs ----
const tournamentSearch = document.getElementById("tournament-search");
const tournamentResults = document.getElementById("tournament-results");
const tournamentSelected = document.getElementById("tournament-selected");
const stepDraft = document.getElementById("step-draft");
const menList = document.getElementById("men-list");
const womenList = document.getElementById("women-list");
const stepSimulate = document.getElementById("step-simulate");
const yourTeamLine = document.getElementById("your-team-line");
const simulateBtn = document.getElementById("simulate-btn");
const stepResults = document.getElementById("step-results");
const bracketEl = document.getElementById("bracket");
const championBanner = document.getElementById("champion-banner");
const resetBtn = document.getElementById("reset-btn");

// ---- Load data ----
fetch(DATA_FILE)
  .then((r) => r.json())
  .then((data) => {
    allTournaments = data.tournaments;
    renderTournamentResults(allTournaments.slice(0, 25));
  })
  .catch(() => {
    tournamentResults.innerHTML = `<p style="padding:12px;color:#8a2e2e;">Couldn't load quarterfinalists.json — make sure it's sitting next to index.html.</p>`;
  });

// ---- Tournament search ----
tournamentSearch.addEventListener("input", () => {
  const needle = tournamentSearch.value.trim().toLowerCase();
  const matches = needle
    ? allTournaments.filter(
        (t) => t.tournament.toLowerCase().includes(needle) || t.key.toLowerCase().includes(needle)
      )
    : allTournaments.slice(0, 25);
  renderTournamentResults(matches.slice(0, 40));
});

function renderTournamentResults(list) {
  tournamentResults.innerHTML = "";
  if (list.length === 0) {
    tournamentResults.innerHTML = `<p style="padding:12px;color:var(--ink-soft);font-size:14px;">No matches. Try a year or a Slam name.</p>`;
    return;
  }
  list.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "result-item";
    btn.textContent = t.tournament;
    btn.addEventListener("click", () => selectTournament(t));
    tournamentResults.appendChild(btn);
  });
}

function selectTournament(t) {
  selectedTournament = t;
  selectedMale = null;
  selectedFemale = null;

  tournamentSearch.value = "";
  tournamentResults.innerHTML = "";
  tournamentSelected.hidden = false;
  tournamentSelected.textContent = t.tournament;
  tournamentSelected.onclick = () => {
    selectedTournament = null;
    tournamentSelected.hidden = true;
    stepDraft.hidden = true;
    stepSimulate.hidden = true;
    stepResults.hidden = true;
    renderTournamentResults(allTournaments.slice(0, 25));
  };

  renderPlayerList(menList, t.men, "male");
  renderPlayerList(womenList, t.women, "female");
  stepDraft.hidden = false;
  stepSimulate.hidden = true;
  stepResults.hidden = true;
}

function statLabel(p) {
  if (typeof p.svcPtsWonPct !== "number" || isNaN(p.svcPtsWonPct)) return "no data";
  const pct = `${p.svcPtsWonPct}%`;
  return p.svcPtsWonPctEstimated ? `${pct}<span class="est-badge">est.</span>` : pct;
}

function renderPlayerList(container, players, gender) {
  container.innerHTML = "";
  players.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "player-option";
    btn.innerHTML = `<span>${p.name}</span><span class="player-stat">${statLabel(p)}</span>`;
    btn.addEventListener("click", () => {
      if (gender === "male") selectedMale = p;
      else selectedFemale = p;
      [...container.children].forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      maybeShowSimulateStep();
    });
    container.appendChild(btn);
  });
}

function maybeShowSimulateStep() {
  if (!selectedMale || !selectedFemale) return;
  yourTeamLine.textContent = `${selectedMale.name} / ${selectedFemale.name}`;
  stepSimulate.hidden = false;
  stepResults.hidden = true;
}

// ---- Game logic (mirrors simulate-mixed-doubles.js) ----

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function effectiveSvcPtsPct(player) {
  return typeof player.svcPtsWonPct === "number" && !isNaN(player.svcPtsWonPct)
    ? player.svcPtsWonPct
    : DEFAULT_SVC_PTS_PCT;
}

function displayName(player) {
  return player.svcPtsWonPctEstimated ? `${player.name}<span class="est-badge">est.</span>` : player.name;
}

function buildTeams(tournament, userMale, userFemale) {
  const remainingMen = tournament.men.filter((p) => p.name !== userMale.name);
  const remainingWomen = tournament.women.filter((p) => p.name !== userFemale.name);
  const shuffledMen = shuffle(remainingMen);
  const shuffledWomen = shuffle(remainingWomen);

  const teams = [{ players: [userMale, userFemale], isUserTeam: true }];
  for (let i = 0; i < shuffledMen.length; i++) {
    teams.push({ players: [shuffledMen[i], shuffledWomen[i]], isUserTeam: false });
  }

  return teams.map((t) => ({
    ...t,
    displayNames: t.players.map(displayName),
    avgSvcPtsPct: (effectiveSvcPtsPct(t.players[0]) + effectiveSvcPtsPct(t.players[1])) / 2
  }));
}

function winProbability(teamA, teamB) {
  const strengthA = Math.pow(teamA.avgSvcPtsPct, 2);
  const strengthB = Math.pow(teamB.avgSvcPtsPct, 2);
  const rawP = strengthA / (strengthA + strengthB);
  return Math.min(MAX_PROB, Math.max(MIN_PROB, rawP));
}

// Simulates the full bracket up front (synchronous, like the CLI version)
// and returns a structured round-by-round result for animated rendering.
function simulateBracket(teams) {
  let round = shuffle(teams);
  const rounds = [];

  while (round.length > 1) {
    const matches = [];
    const nextRound = [];
    for (let i = 0; i < round.length; i += 2) {
      const teamA = round[i];
      const teamB = round[i + 1];
      const pA = winProbability(teamA, teamB);
      const winner = Math.random() < pA ? teamA : teamB;
      matches.push({ teamA, teamB, winner });
      nextRound.push(winner);
    }
    rounds.push(matches);
    round = nextRound;
  }

  return { rounds, champion: round[0] };
}

function roundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinal";
  if (fromEnd === 3) return "Quarterfinal";
  return `Round ${roundIndex + 1}`;
}

// ---- Simulate button ----
simulateBtn.addEventListener("click", () => {
  const teams = buildTeams(selectedTournament, selectedMale, selectedFemale);
  const { rounds, champion } = simulateBracket(teams);
  renderResults(rounds, champion);
});

function renderResults(rounds, champion) {
  bracketEl.innerHTML = "";

  rounds.forEach((matches, roundIdx) => {
    const block = document.createElement("div");
    block.className = "round-block";
    block.style.animationDelay = `${roundIdx * 0.12}s`;

    const title = document.createElement("p");
    title.className = "round-title";
    title.textContent = roundLabel(roundIdx, rounds.length);
    block.appendChild(title);

    matches.forEach((m) => {
      const matchEl = document.createElement("div");
      matchEl.className = "match";

      [m.teamA, m.teamB].forEach((team) => {
        const row = document.createElement("div");
        row.className = "match-row " + (team === m.winner ? "winner" : "loser");
        row.innerHTML = `<span>${team.displayNames.join(" / ")}</span><span class="pct">${team.avgSvcPtsPct.toFixed(1)}%</span>`;
        matchEl.appendChild(row);
      });

      block.appendChild(matchEl);
    });

    bracketEl.appendChild(block);
  });

  const userWon = champion.isUserTeam;
  championBanner.hidden = false;
  championBanner.className = "champion-banner" + (userWon ? " won" : "");
  championBanner.innerHTML = `
    <p class="cb-label">Champions</p>
    <p class="cb-names">${champion.displayNames.join(" / ")}</p>
    <p class="cb-result">${userWon ? "Your team won! 🏆" : "Your team did not win this time."}</p>
  `;

  resetBtn.hidden = false;
  stepResults.hidden = false;
  stepResults.scrollIntoView({ behavior: "smooth", block: "start" });
}

resetBtn.addEventListener("click", () => {
  selectedMale = null;
  selectedFemale = null;
  [...menList.children].forEach((c) => c.classList.remove("selected"));
  [...womenList.children].forEach((c) => c.classList.remove("selected"));
  stepSimulate.hidden = true;
  stepResults.hidden = true;
  stepDraft.scrollIntoView({ behavior: "smooth", block: "start" });
});
