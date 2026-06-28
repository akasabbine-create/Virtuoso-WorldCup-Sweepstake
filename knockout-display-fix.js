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
      .knockout-eliminated-card {
        border: 1px solid rgba(95, 169, 255, 0.24);
        border-radius: 18px;
        background: rgba(3, 18, 30, 0.36);
        padding: 16px;
      }

      .knockout-player-card {
        box-shadow: inset 4px 0 0 rgba(255, 209, 102, 0.82);
      }

      .knockout-player-topline,
      .knockout-eliminated-topline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .knockout-player-topline strong,
      .knockout-eliminated-topline strong {
        color: #fff;
        font-size: 1.08rem;
      }

      .knockout-player-topline span {
        color: #ffd166;
        font-weight: 900;
      }

      .knockout-qualified-team-list,
      .knockout-eliminated-team-list {
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

      .knockout-eliminated-card {
        margin-top: 14px;
        border-color: rgba(255, 255, 255, 0.12);
        background: rgba(3, 18, 30, 0.22);
      }

      .knockout-eliminated-card h3 {
        margin: 0 0 10px;
      }

      .knockout-eliminated-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: space-between;
        padding: 9px 0;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .knockout-eliminated-row:first-child {
        border-top: 0;
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
        .knockout-eliminated-topline {
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
          ${outHtml}
        </div>
      </div>
    `;
  };
}());
