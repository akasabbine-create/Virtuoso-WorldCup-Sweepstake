// Knockout display + knocked-out section + knockout potential points fix.
// Loaded after app.js from index.html.

(function () {
  const cacheBust = Date.now();

  function safeText(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalise(value) {
    if (typeof normaliseText === "function") return normaliseText(value);
    return String(value || "").trim().toLowerCase();
  }

  function teamHtml(team) {
    return typeof teamLabelHtml === "function" ? teamLabelHtml(team) : safeText(team);
  }

  function ordinalText(value) {
    return typeof ordinal === "function" ? ordinal(value) : String(value);
  }

  async function loadData(path) {
    const response = await fetch(`${path}?ts=${cacheBust}`);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  }

  function bracketDay(match) {
    if (!match?.date) return null;
    const date = new Date(match.date);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function stageKeyFromMatch(match) {
    if (typeof matchStageKey === "function") {
      const key = matchStageKey(match);
      if (key && key !== "unknown") return key;
    }

    const rawText = [
      match?.stage,
      match?.round,
      match?.season?.slug,
      match?.raw?.season?.slug,
      match?.raw?.name,
      match?.raw?.shortName,
      match?.raw?.competitions?.[0]?.note,
      match?.raw?.competitions?.[0]?.altGameNote,
      match?.raw?.competitions?.[0]?.type?.text,
      match?.raw?.competitions?.[0]?.type?.abbreviation
    ].filter(Boolean).join(" ").toLowerCase();

    if (rawText.includes("round of 32") || rawText.includes("round-of-32")) return "round_of_32";
    if (rawText.includes("round of 16") || rawText.includes("round-of-16")) return "round_of_16";
    if (rawText.includes("quarter")) return "quarter_final";
    if (rawText.includes("semi")) return "semi_final";
    if (rawText.includes("final")) return "final";

    const day = bracketDay(match);
    if (!day) return "";

    if (day >= "2026-06-28" && day <= "2026-07-03") return "round_of_32";
    if (day >= "2026-07-04" && day <= "2026-07-07") return "round_of_16";
    if (day >= "2026-07-09" && day <= "2026-07-12") return "quarter_final";
    if (day >= "2026-07-14" && day <= "2026-07-15") return "semi_final";
    if (day === "2026-07-19") return "final";

    return "";
  }

  function progressionBonusForStage(stage) {
    return {
      round_of_32: 5,
      round_of_16: 5,
      quarter_final: 10,
      semi_final: 10,
      final: 15
    }[stage] || 0;
  }

  function nextRoundLabel(stage) {
    return {
      round_of_32: "Round of 16",
      round_of_16: "Quarter-final",
      quarter_final: "Semi-final",
      semi_final: "Final",
      final: "Tournament winner"
    }[stage] || "Next round";
  }

  function isKnockoutMatch(match) {
    return Boolean(progressionBonusForStage(stageKeyFromMatch(match)));
  }

  function calculatePotentialRows(match) {
    const team1 = match.team1;
    const team2 = match.team2;
    const stage = stageKeyFromMatch(match);
    const progression = progressionBonusForStage(stage);
    const knockout = isKnockoutMatch(match);
    const playerMap = {};

    (match.players || []).forEach(player => {
      if (!playerMap[player.name]) {
        playerMap[player.name] = {
          name: player.name,
          team1Win: 0,
          draw: 0,
          team2Win: 0,
          team1Progression: 0,
          team2Progression: 0
        };
      }

      (player.teams || []).forEach(team => {
        if (normalise(team) === normalise(team1)) {
          playerMap[player.name].team1Win += 3 + progression;
          playerMap[player.name].team1Progression += progression;
          if (!knockout) playerMap[player.name].draw += 1;
        }

        if (normalise(team) === normalise(team2)) {
          playerMap[player.name].team2Win += 3 + progression;
          playerMap[player.name].team2Progression += progression;
          if (!knockout) playerMap[player.name].draw += 1;
        }
      });
    });

    return Object.values(playerMap).sort((a, b) => a.name.localeCompare(b.name));
  }

  function potentialGainForOutcome(match, outcomeKey) {
    const gains = {};
    calculatePotentialRows(match).forEach(row => {
      const value = Number(row[outcomeKey] || 0);
      if (value > 0) gains[row.name] = (gains[row.name] || 0) + value;
    });
    return gains;
  }

  function outcomeDefinitions(match) {
    return [
      { key: "team1Win", label: `${match.team1} win` },
      { key: "draw", label: "Draw" },
      { key: "team2Win", label: `${match.team2} win` }
    ];
  }

  function rankProjectedPlayers(players) {
    return [...players].sort((a, b) => {
      if (Number(b.projectedPoints || 0) !== Number(a.projectedPoints || 0)) {
        return Number(b.projectedPoints || 0) - Number(a.projectedPoints || 0);
      }
      if (Number(b.goalDifference || 0) !== Number(a.goalDifference || 0)) {
        return Number(b.goalDifference || 0) - Number(a.goalDifference || 0);
      }
      if (Number(b.goalsFor || 0) !== Number(a.goalsFor || 0)) {
        return Number(b.goalsFor || 0) - Number(a.goalsFor || 0);
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function calculateMoveCandidatesWithKnockoutBonuses(leaderboard, fixtures) {
    const candidates = [];
    const impactMatches = (fixtures || []).filter(match => !match.completed);

    impactMatches.forEach(match => {
      outcomeDefinitions(match).forEach(outcome => {
        if (outcome.key === "draw" && isKnockoutMatch(match)) return;

        const gains = potentialGainForOutcome(match, outcome.key);
        if (Object.keys(gains).length === 0) return;

        const projected = rankProjectedPlayers((leaderboard || []).map(player => ({
          ...player,
          projectedPoints: Number(player.points || 0) + Number(gains[player.name] || 0)
        })));

        projected.forEach((player, index) => {
          const currentIndex = (leaderboard || []).findIndex(item => item.name === player.name);
          const oldRank = Number(player.rank || currentIndex + 1);
          const newRank = index + 1;
          const places = oldRank - newRank;
          const gainedPoints = Number(gains[player.name] || 0);

          if (places <= 0 || gainedPoints <= 0) return;

          candidates.push({ player: player.name, match, outcome, places, gainedPoints, oldRank, newRank });
        });
      });
    });

    return candidates.sort((a, b) => {
      if (b.places !== a.places) return b.places - a.places;
      if (b.gainedPoints !== a.gainedPoints) return b.gainedPoints - a.gainedPoints;
      if (a.newRank !== b.newRank) return a.newRank - b.newRank;
      return a.player.localeCompare(b.player);
    });
  }

  function uniqueMoveCandidates(candidates, limit = 5) {
    const seen = new Set();
    const output = [];
    (candidates || []).forEach(candidate => {
      if (seen.has(candidate.player)) return;
      seen.add(candidate.player);
      output.push(candidate);
    });
    return output.slice(0, limit);
  }

  function moveText(candidate) {
    const stage = stageKeyFromMatch(candidate.match);
    const progression = progressionBonusForStage(stage);
    const detail = progression
      ? ` This includes +3 for the win and +${progression} for reaching the ${nextRoundLabel(stage)}. Clean sheet bonus would be an extra +2.`
      : "";

    return `If ${safeText(candidate.outcome.label)} in ${teamHtml(candidate.match.team1)} v ${teamHtml(candidate.match.team2)}, ${safeText(candidate.player)} gains +${candidate.gainedPoints} and moves from ${ordinalText(candidate.oldRank)} to ${ordinalText(candidate.newRank)}.${detail}`;
  }

  function renderBiggestPossibleMoveFixed(leaderboard, fixtures) {
    const container = document.querySelector("#biggest-possible-move");
    if (!container) return;

    const best = uniqueMoveCandidates(calculateMoveCandidatesWithKnockoutBonuses(leaderboard, fixtures), 1)[0];
    if (!best) return;

    container.innerHTML = `
      <div class="biggest-move-copy">
        <span class="biggest-move-label">Biggest Possible Move Today</span>
        <strong>${safeText(best.player)} could climb ${best.places} place${best.places === 1 ? "" : "s"}</strong>
        <p>${moveText(best)}</p>
      </div>
      <div class="biggest-move-badge">+${best.gainedPoints}</div>
    `;
  }

  function renderMatchdayStorylinesFixed(leaderboard, fixtures) {
    const container = document.querySelector("#matchday-storylines");
    if (!container) return;

    const candidates = uniqueMoveCandidates(calculateMoveCandidatesWithKnockoutBonuses(leaderboard, fixtures), 5).slice(1, 5);
    if (!candidates.length) return;

    container.innerHTML = `
      <div class="storyline-heading">
        <span>Matchday Storylines</span>
        <small>Other moves to watch</small>
      </div>
      <div class="storyline-list">
        ${candidates.map(candidate => `
          <div class="storyline-item">
            <strong>${safeText(candidate.player)} could jump ${candidate.places} place${candidate.places === 1 ? "" : "s"}</strong>
            <span>${moveText(candidate)}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function teamBonusBadges(row) {
    const stages = (row.stageBonuses || []).map(item => `
      <span class="knockout-bonus-pill">${stageShortLabel(item.stage)} +${item.points}</span>
    `).join("");

    const cleanSheets = (row.cleanSheets || []).map(item => `
      <span class="knockout-bonus-pill clean-sheet-pill">CS +${item.points}</span>
    `).join("");

    return `${stages}${cleanSheets}`;
  }

  function groupedKnockoutCss() {
    if (document.querySelector("#knockout-player-grouped-css")) return;

    const style = document.createElement("style");
    style.id = "knockout-player-grouped-css";
    style.textContent = `
      .knockout-player-summary-grid { display: grid; gap: 14px; }
      .knockout-player-card, .knockout-out-card {
        border: 1px solid rgba(95, 169, 255, 0.24);
        border-radius: 18px;
        background: rgba(3, 18, 30, 0.36);
        padding: 16px;
      }
      .knockout-player-card { box-shadow: inset 4px 0 0 rgba(255, 209, 102, 0.82); }
      .knockout-player-topline, .knockout-out-topline {
        display: flex; justify-content: space-between; gap: 12px;
        align-items: flex-start; margin-bottom: 12px;
      }
      .knockout-player-topline strong, .knockout-out-topline strong { color: #fff; font-size: 1.08rem; }
      .knockout-player-topline span { color: #ffd166; font-weight: 900; }
      .knockout-qualified-team-list, .knockout-out-list { display: grid; gap: 8px; }
      .knockout-qualified-team-row, .knockout-out-row {
        display: grid; grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px; align-items: center; padding: 10px;
        border-radius: 14px; background: rgba(95, 169, 255, 0.08);
      }
      .knockout-out-card { margin-top: 14px; border-color: rgba(255, 255, 255, 0.12); background: rgba(3, 18, 30, 0.22); }
      .knockout-out-row small { color: var(--muted); font-weight: 800; }
      .potential-chip small { display: block; margin-top: 3px; opacity: 0.82; font-size: 0.72rem; font-weight: 800; }
      @media (max-width: 700px) {
        .knockout-qualified-team-row, .knockout-out-row, .knockout-player-topline, .knockout-out-topline {
          grid-template-columns: 1fr; flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function completedStageLabel(team, matches) {
    const completed = (matches || []).filter(match =>
      match.completed &&
      (normalise(match.team1) === normalise(team) || normalise(match.team2) === normalise(team))
    );

    const knockoutLoss = completed.find(match => {
      const stage = stageKeyFromMatch(match);
      const knockout = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"].includes(stage);
      if (!knockout) return false;

      const teamIsOne = normalise(match.team1) === normalise(team);
      const teamIsTwo = normalise(match.team2) === normalise(team);
      const lostAsOne = teamIsOne && Number(match.score1) < Number(match.score2);
      const lostAsTwo = teamIsTwo && Number(match.score2) < Number(match.score1);
      return lostAsOne || lostAsTwo;
    });

    if (knockoutLoss) {
      return {
        round_of_32: "Round of 32",
        round_of_16: "Round of 16",
        quarter_final: "Quarter-final",
        semi_final: "Semi-final",
        final: "Final"
      }[stageKeyFromMatch(knockoutLoss)] || "Knockout";
    }

    return "Group stage";
  }

  function renderKnockoutTrackerFixed(knockoutData, leaderboard, matches) {
    groupedKnockoutCss();

    const container = document.querySelector("#knockout-tracker");
    if (!container) return;

    const tracker = knockoutData?.rows ? knockoutData : (knockoutData?.knockoutTracker || knockoutData || {});
    const rows = tracker.rows || [];
    const activeRows = rows.filter(row => Number(row.total || 0) > 0);
    const qualifiedTeamKeys = new Set(activeRows.map(row => `${normalise(row.owner)}::${normalise(row.team)}`));

    const players = new Map();
    (leaderboard || []).forEach(player => {
      players.set(player.name, {
        name: player.name,
        rank: player.rank,
        points: player.points,
        teams: player.teams || [],
        qualified: [],
        knockedOut: []
      });
    });

    activeRows.forEach(row => {
      if (!players.has(row.owner)) players.set(row.owner, { name: row.owner, teams: [], qualified: [], knockedOut: [] });
      players.get(row.owner).qualified.push(row);
    });

    players.forEach(player => {
      (player.teams || []).forEach(team => {
        const key = `${normalise(player.name)}::${normalise(team)}`;
        if (!qualifiedTeamKeys.has(key)) {
          player.knockedOut.push({ team, stage: completedStageLabel(team, matches) });
        }
      });
    });

    const qualifiedPlayers = [...players.values()]
      .filter(player => player.qualified.length)
      .map(player => ({
        ...player,
        knockoutTotal: player.qualified.reduce((sum, row) => sum + Number(row.total || 0), 0)
      }))
      .sort((a, b) => {
        if (b.knockoutTotal !== a.knockoutTotal) return b.knockoutTotal - a.knockoutTotal;
        if (b.qualified.length !== a.qualified.length) return b.qualified.length - a.qualified.length;
        return a.name.localeCompare(b.name);
      });

    const playersWithKnockedOutTeams = [...players.values()]
      .filter(player => player.knockedOut.length)
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalAwarded = activeRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const cleanSheets = rows.reduce((sum, row) => sum + (row.cleanSheets || []).length, 0);
    const stageOrder = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final", "winner"];

    const stageSummary = stageOrder.map(stage => {
      const count = rows.filter(row => (row.stageBonuses || []).some(item => item.stage === stage)).length;
      const stageMeta = (tracker.stages || []).find(item => item.key === stage);
      return `
        <div class="knockout-stage-chip ${count ? "stage-active" : ""}">
          <span>${stageShortLabel(stage)}</span>
          <strong>${count}</strong>
          <small>${stageMeta?.points ? `+${stageMeta.points}` : ""}</small>
        </div>
      `;
    }).join("");

    const qualifiedHtml = qualifiedPlayers.map(player => `
      <article class="knockout-player-card">
        <div class="knockout-player-topline">
          <strong>${safeText(player.name)}</strong>
          <span>${player.qualified.length} team${player.qualified.length === 1 ? "" : "s"} · +${player.knockoutTotal} bonus pts</span>
        </div>
        <div class="knockout-qualified-team-list">
          ${player.qualified.map(row => `
            <div class="knockout-qualified-team-row">
              <strong>${teamHtml(row.team)}</strong>
              <div class="knockout-bonus-pills">${teamBonusBadges(row)}</div>
            </div>
          `).join("")}
        </div>
      </article>
    `).join("");

    const knockedOutHtml = playersWithKnockedOutTeams.length
      ? `
        <div class="knockout-out-card">
          <div class="knockout-out-topline">
            <strong>Knocked out teams</strong>
            <span>${playersWithKnockedOutTeams.reduce((sum, player) => sum + player.knockedOut.length, 0)} teams</span>
          </div>
          <div class="knockout-out-list">
            ${playersWithKnockedOutTeams.map(player => `
              <div class="knockout-out-row">
                <strong>${safeText(player.name)}</strong>
                <span>
                  ${player.knockedOut.map(item => `${teamHtml(item.team)} <small>${safeText(item.stage)}</small>`).join(" ")}
                </span>
              </div>
            `).join("")}
          </div>
        </div>
      `
      : "";

    container.innerHTML = `
      <div class="knockout-overview-card">
        <div>
          <span class="knockout-eyebrow">Knockout bonus points</span>
          <h3>${totalAwarded} pts awarded</h3>
          <p>${activeRows.length} teams have active knockout bonuses. ${cleanSheets} knockout clean sheets tracked.</p>
        </div>
        <div class="knockout-stage-grid">${stageSummary}</div>
      </div>

      <div class="knockout-main-grid knockout-main-grid-single">
        <div class="knockout-qualified-panel knockout-qualified-panel-wide">
          <div class="knockout-panel-header">
            <h3>Qualified players & teams</h3>
            <span>Grouped by player</span>
          </div>
          <div class="knockout-player-summary-grid">
            ${qualifiedHtml || `<div class="knockout-empty-card"><h3>No qualified players found</h3></div>`}
          </div>
          ${knockedOutHtml}
        </div>
      </div>
    `;
  }

  async function refreshFrontendFixes() {
    try {
      const [leaderboard, fixtures, bonusData, matches] = await Promise.all([
        loadData("data/leaderboard.json"),
        loadData("data/upcoming_fixtures.json"),
        loadData("data/bonus_points.json"),
        loadData("data/matches.json").catch(() => [])
      ]);

      renderBiggestPossibleMoveFixed(leaderboard, fixtures);
      renderMatchdayStorylinesFixed(leaderboard, fixtures);
      renderKnockoutTrackerFixed(bonusData?.knockoutTracker || bonusData, leaderboard, matches);
    } catch (error) {
      console.warn("Knockout display fix could not refresh the page", error);
    }
  }

  setTimeout(refreshFrontendFixes, 600);
  setTimeout(refreshFrontendFixes, 1800);
  window.addEventListener("load", () => setTimeout(refreshFrontendFixes, 300));
}());
