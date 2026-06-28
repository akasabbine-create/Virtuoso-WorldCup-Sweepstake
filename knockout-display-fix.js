// Knockout display + potential progression fixes.
// Loaded after app.js so these functions override the original renderer/helpers
// before the async init() reaches rendering.

(function () {
  function safeText(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
  }

  function normalise(value) {
    return typeof normaliseText === "function"
      ? normaliseText(value)
      : String(value || "").trim().toLowerCase();
  }

  function stagePointsForNextRound(stage) {
    const map = {
      round_of_32: 5,
      round_of_16: 5,
      quarter_final: 10,
      semi_final: 10,
      final: 15
    };
    return map[stage] || 0;
  }

  function nextRoundLabel(stage) {
    const map = {
      round_of_32: "R16",
      round_of_16: "QF",
      quarter_final: "SF",
      semi_final: "Final",
      final: "Winner"
    };
    return map[stage] || "Progress";
  }

  function stageDisplayLabel(stage) {
    const map = {
      group: "Group stage",
      round_of_32: "Round of 32",
      round_of_16: "Round of 16",
      quarter_final: "Quarter-final",
      semi_final: "Semi-final",
      final: "Final",
      third_place: "Third place"
    };
    return map[stage] || "Knockout";
  }

  function isKnockoutPotentialMatch(match) {
    const stage = typeof matchStageKey === "function" ? matchStageKey(match) : "";
    return ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"].includes(stage);
  }

  function progressionBonusForMatch(match) {
    if (!isKnockoutPotentialMatch(match)) return 0;
    const stage = typeof matchStageKey === "function" ? matchStageKey(match) : "";
    return stagePointsForNextRound(stage);
  }

  window.calculatePotentialPoints = function calculatePotentialPoints(match) {
    const team1 = match.team1;
    const team2 = match.team2;
    const playerMap = {};
    const progressionBonus = progressionBonusForMatch(match);

    (match.players || []).forEach(player => {
      if (!playerMap[player.name]) {
        playerMap[player.name] = {
          name: player.name,
          teams: [],
          team1Win: 0,
          draw: 0,
          team2Win: 0,
          team1Progression: 0,
          team2Progression: 0
        };
      }

      (player.teams || []).forEach(team => {
        playerMap[player.name].teams.push(team);

        if (normalise(team) === normalise(team1)) {
          playerMap[player.name].team1Win += 3 + progressionBonus;
          playerMap[player.name].draw += isKnockoutPotentialMatch(match) ? 0 : 1;
          playerMap[player.name].team1Progression += progressionBonus;
        }

        if (normalise(team) === normalise(team2)) {
          playerMap[player.name].team2Win += 3 + progressionBonus;
          playerMap[player.name].draw += isKnockoutPotentialMatch(match) ? 0 : 1;
          playerMap[player.name].team2Progression += progressionBonus;
        }
      });
    });

    return Object.values(playerMap).sort((a, b) => a.name.localeCompare(b.name));
  };

  window.potentialChips = function potentialChips(row, match) {
    const chips = [];
    const progressionBonus = progressionBonusForMatch(match);
    const stage = typeof matchStageKey === "function" ? matchStageKey(match) : "";

    if (row.team1Win > 0) {
      const extra = progressionBonus && row.team1Progression
        ? ` <small>includes ${nextRoundLabel(stage)} +${row.team1Progression}</small>`
        : "";
      chips.push(`<span class="potential-chip potential-chip-win">${teamLabelHtml(match.team1)} +${row.team1Win}${extra}</span>`);
    }

    if (row.draw > 0 && !isKnockoutPotentialMatch(match)) {
      chips.push(`<span class="potential-chip potential-chip-draw">Draw +${row.draw}</span>`);
    }

    if (row.team2Win > 0) {
      const extra = progressionBonus && row.team2Progression
        ? ` <small>includes ${nextRoundLabel(stage)} +${row.team2Progression}</small>`
        : "";
      chips.push(`<span class="potential-chip potential-chip-win">${teamLabelHtml(match.team2)} +${row.team2Win}${extra}</span>`);
    }

    return chips.join("");
  };

  window.moveCandidateText = function moveCandidateText(candidate) {
    const progressionBonus = progressionBonusForMatch(candidate.match);
    const stage = typeof matchStageKey === "function" ? matchStageKey(candidate.match) : "";
    const extra = progressionBonus
      ? ` This includes the knockout progression bonus (${nextRoundLabel(stage)} +${progressionBonus}).`
      : "";

    return `If ${safeText(candidate.outcome.label)} in ${teamLabelHtml(candidate.match.team1)} v ${teamLabelHtml(candidate.match.team2)}, ${safeText(candidate.player)} gains +${candidate.gainedPoints} and moves from ${ordinal(candidate.oldRank)} to ${ordinal(candidate.newRank)}.${extra}`;
  };

  function playerTeamList(player) {
    return (player.teams || []).map(team => teamLabelHtml(team)).join(" ");
  }

  function teamBonusBadges(row) {
    const stageBadges = (row.stageBonuses || []).map(item => `
      <span class="knockout-bonus-pill">${stageShortLabel(item.stage)} +${item.points}</span>
    `).join("");

    const cleanSheetBadges = (row.cleanSheets || []).map(item => `
      <span class="knockout-bonus-pill clean-sheet-pill">CS +${item.points}</span>
    `).join("");

    return `${stageBadges}${cleanSheetBadges}`;
  }

  function groupedKnockoutCss() {
    if (document.querySelector("#knockout-player-grouped-css")) return;

    const style = document.createElement("style");
    style.id = "knockout-player-grouped-css";
    style.textContent = `
      .knockout-player-summary-grid {
        display: grid;
        gap: 14px;
      }

      .knockout-player-card,
      .knockout-eliminated-card,
      .knockout-out-card {
        border: 1px solid rgba(95, 169, 255, 0.24);
        border-radius: 18px;
        background: rgba(3, 18, 30, 0.36);
        padding: 16px;
      }

      .knockout-player-card {
        box-shadow: inset 4px 0 0 rgba(255, 209, 102, 0.82);
      }

      .knockout-out-card {
        box-shadow: inset 4px 0 0 rgba(255, 107, 107, 0.72);
      }

      .knockout-player-topline,
      .knockout-eliminated-topline,
      .knockout-out-topline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .knockout-player-topline strong,
      .knockout-eliminated-topline strong,
      .knockout-out-topline strong,
      .knockout-eliminated-topline h3,
      .knockout-out-topline h3 {
        color: #fff;
        font-size: 1.08rem;
        margin: 0;
      }

      .knockout-player-topline span {
        color: #ffd166;
        font-weight: 900;
      }

      .knockout-out-topline span,
      .knockout-eliminated-topline span {
        color: var(--muted);
        font-weight: 800;
      }

      .knockout-qualified-team-list,
      .knockout-eliminated-team-list,
      .knockout-out-player-list {
        display: grid;
        gap: 8px;
      }

      .knockout-qualified-team-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 10px;
        border-radius: 14px;
        background: rgba(95, 169, 255, 0.08);
      }

      .knockout-qualified-team-row .knockout-bonus-pills {
        justify-content: flex-end;
      }

      .knockout-out-card,
      .knockout-eliminated-card {
        margin-top: 14px;
      }

      .knockout-eliminated-card {
        border-color: rgba(255, 255, 255, 0.12);
        background: rgba(3, 18, 30, 0.22);
      }

      .knockout-out-card {
        border-color: rgba(255, 107, 107, 0.22);
        background: rgba(35, 13, 21, 0.22);
      }

      .knockout-eliminated-row,
      .knockout-out-row {
        display: grid;
        grid-template-columns: 110px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
        padding: 9px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .knockout-eliminated-row:first-child,
      .knockout-out-row:first-child {
        border-top: 0;
      }

      .knockout-out-team-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .knockout-out-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 9px;
        border-radius: 999px;
        border: 1px solid rgba(255, 107, 107, 0.22);
        background: rgba(255, 107, 107, 0.08);
      }

      .knockout-out-chip small {
        color: #ffb4b4;
        font-size: 0.72rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .potential-chip small {
        display: block;
        margin-top: 3px;
        opacity: 0.82;
        font-size: 0.72rem;
        font-weight: 800;
      }

      @media (max-width: 700px) {
        .knockout-qualified-team-row,
        .knockout-player-topline,
        .knockout-eliminated-topline,
        .knockout-out-topline,
        .knockout-eliminated-row,
        .knockout-out-row {
          grid-template-columns: 1fr;
          flex-direction: column;
        }

        .knockout-qualified-team-row .knockout-bonus-pills {
          justify-content: flex-start;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function knockoutWinner(match) {
    if (Number(match.score1) > Number(match.score2)) return match.team1;
    if (Number(match.score2) > Number(match.score1)) return match.team2;
    if (match.winner1) return match.team1;
    if (match.winner2) return match.team2;
    return null;
  }

  function knockoutLoser(match) {
    const winner = knockoutWinner(match);
    if (!winner) return null;
    if (normalise(winner) === normalise(match.team1)) return match.team2;
    if (normalise(winner) === normalise(match.team2)) return match.team1;
    return null;
  }

  function buildKnockedOutTeams(rows, matches, leaderboard) {
    const teamsByName = new Map();

    (leaderboard || []).forEach(player => {
      (player.teams || []).forEach(team => {
        teamsByName.set(normalise(team), {
          owner: player.name,
          team,
          stage: "group",
          stageLabel: "Group stage"
        });
      });
    });

    // Any team with a knockout stage bonus did get out of the group, so remove
    // the default group-stage exit unless a completed knockout loss puts it back.
    (rows || []).forEach(row => {
      if ((row.stageBonuses || []).length > 0) {
        teamsByName.delete(normalise(row.team));
      }
    });

    (matches || []).forEach(match => {
      const stage = typeof matchStageKey === "function" ? matchStageKey(match) : "";
      const isKnockout = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"].includes(stage);
      const isComplete = match.completed || (match.score1 !== null && match.score1 !== undefined && match.score2 !== null && match.score2 !== undefined);

      if (!isKnockout || !isComplete) return;

      const loser = knockoutLoser(match);
      if (!loser) return;

      const owner = (leaderboard || []).find(player => (player.teams || []).some(team => normalise(team) === normalise(loser)))?.name;
      if (!owner) return;

      teamsByName.set(normalise(loser), {
        owner,
        team: loser,
        stage,
        stageLabel: stageDisplayLabel(stage)
      });
    });

    return [...teamsByName.values()].sort((a, b) => {
      if (a.owner !== b.owner) return String(a.owner || "").localeCompare(String(b.owner || ""));
      return String(a.team || "").localeCompare(String(b.team || ""));
    });
  }

  async function renderKnockedOutSection(rows, leaderboard) {
    const target = document.querySelector("#knockout-out-dynamic");
    if (!target) return;

    let matches = [];
    try {
      matches = await loadJson("data/matches.json");
    } catch (error) {
      console.warn("Could not load match data for knocked out section", error);
    }

    const knockedOutTeams = buildKnockedOutTeams(rows, matches, leaderboard);
    const byPlayer = new Map();

    knockedOutTeams.forEach(item => {
      if (!byPlayer.has(item.owner)) {
        byPlayer.set(item.owner, []);
      }
      byPlayer.get(item.owner).push(item);
    });

    const players = [...byPlayer.entries()].sort((a, b) => String(a[0] || "").localeCompare(String(b[0] || "")));

    if (!players.length) {
      target.innerHTML = "";
      return;
    }

    target.innerHTML = `
      <div class="knockout-out-card">
        <div class="knockout-out-topline">
          <h3>Knocked out teams</h3>
          <span>${knockedOutTeams.length} team${knockedOutTeams.length === 1 ? "" : "s"}</span>
        </div>
        <div class="knockout-out-player-list">
          ${players.map(([owner, teams]) => `
            <div class="knockout-out-row">
              <strong>${safeText(owner)}</strong>
              <span class="knockout-out-team-list">
                ${teams.map(item => `
                  <span class="knockout-out-chip">
                    ${teamLabelHtml(item.team)}
                    <small>${safeText(item.stageLabel)}</small>
                  </span>
                `).join("")}
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  window.renderKnockoutTracker = function renderKnockoutTracker(knockoutData, leaderboard) {
    groupedKnockoutCss();

    const container = document.querySelector("#knockout-tracker");
    if (!container) return;

    const tracker = knockoutData?.rows
      ? knockoutData
      : (knockoutData?.knockoutTracker || knockoutData || {});

    const rows = tracker.rows || [];
    const activeRows = rows
      .filter(row => Number(row.total || 0) > 0)
      .sort((a, b) => String(a.team || "").localeCompare(String(b.team || "")));

    if (!rows.length) {
      container.innerHTML = `
        <div class="knockout-empty-card">
          <h3>No knockout data available</h3>
          <p>The tracker will populate once the generated knockout data is available.</p>
        </div>
      `;
      return;
    }

    const playersByName = new Map();
    (leaderboard || []).forEach(player => {
      playersByName.set(player.name, {
        name: player.name,
        rank: player.rank,
        points: player.points,
        teams: player.teams || [],
        qualified: [],
        total: 0
      });
    });

    activeRows.forEach(row => {
      if (!playersByName.has(row.owner)) {
        playersByName.set(row.owner, {
          name: row.owner,
          teams: [],
          qualified: [],
          total: 0
        });
      }

      const player = playersByName.get(row.owner);
      player.qualified.push(row);
      player.total += Number(row.total || 0);
    });

    const qualifiedPlayers = [...playersByName.values()]
      .filter(player => player.qualified.length > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.qualified.length !== a.qualified.length) return b.qualified.length - a.qualified.length;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    const playersOut = [...playersByName.values()]
      .filter(player => player.qualified.length === 0)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const totalAwarded = activeRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const teamsQualified = activeRows.length;
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
          <span>${player.qualified.length} team${player.qualified.length === 1 ? "" : "s"} · +${player.total} bonus pts</span>
        </div>
        <div class="knockout-qualified-team-list">
          ${player.qualified.map(row => `
            <div class="knockout-qualified-team-row">
              <strong>${teamLabelHtml(row.team)}</strong>
              <div class="knockout-bonus-pills">
                ${teamBonusBadges(row)}
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    `).join("");

    const outHtml = playersOut.length
      ? `
        <div class="knockout-eliminated-card">
          <div class="knockout-eliminated-topline">
            <h3>Players out</h3>
            <span>${playersOut.length} player${playersOut.length === 1 ? "" : "s"}</span>
          </div>
          <div class="knockout-eliminated-team-list">
            ${playersOut.map(player => `
              <div class="knockout-eliminated-row">
                <strong>${safeText(player.name)}</strong>
                <span>${playerTeamList(player)}</span>
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
          <p>${teamsQualified} teams have active knockout bonuses. ${cleanSheets} knockout clean sheets tracked.</p>
        </div>
        <div class="knockout-stage-grid">
          ${stageSummary}
        </div>
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
          <div id="knockout-out-dynamic"></div>
          ${outHtml}
        </div>
      </div>
    `;

    renderKnockedOutSection(rows, leaderboard);
  };
}());
