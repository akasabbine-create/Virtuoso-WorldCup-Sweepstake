(function () {
  const STAGE_DURATIONS = [22000, 15000, 18000, 20000];
  const params = new URLSearchParams(window.location.search);
  const autoScrollEnabled = params.get("autoscroll") === "true";

  let stageTimer = null;
  let scrollFrame = null;

  function rootElement() {
    let root = document.querySelector("#tv-dashboard-root");

    if (!root) {
      root = document.createElement("main");
      root.id = "tv-dashboard-root";
      document.body.appendChild(root);
    }

    root.className = "tv-dashboard";
    return root;
  }

  function showError(message) {
    const root = rootElement();
    root.classList.add("tv-dashboard-error");
    root.innerHTML = `
      <section class="tv-loading-panel" aria-live="polite">
        <span>World Cup Sweepstake</span>
        <strong>${escapeHtml(message)}</strong>
      </section>
    `;
  }

  function requiredHelpersAvailable() {
    return [
      "loadJson",
      "addGoalDifferenceToLeaderboard",
      "rankLeaderboardByTieBreakers",
      "findCurrentBadgeHolders",
      "findWoodenSpoonTeam",
      "teamHighlightClasses",
      "teamNameHtml",
      "teamLabelHtml",
      "badgeHtml",
      "medal",
      "formatGoalDifference",
      "formatDateTime",
      "formatTimeOnly",
      "fixtureStatusLabel",
      "fixtureStatusClass",
      "calculateMoveCandidates",
      "uniqueMoveCandidates",
      "calculateProjectedPayouts",
      "playerOwnsTeam",
      "flattenPlayerTeams",
      "sortWoodenSpoonTeams",
      "escapeHtml"
    ].every(name => typeof window[name] === "function");
  }

  async function loadOptionalJson(path, fallback) {
    try {
      return await loadJson(path);
    } catch (error) {
      console.warn(`TV dashboard could not load ${path}`, error);
      return fallback;
    }
  }

  async function initTvDashboard() {
    document.body.classList.add("tv-dashboard-mode");

    if (!requiredHelpersAvailable()) {
      showError("TV dashboard helpers are unavailable.");
      return;
    }

    const [
      leaderboardData,
      playerDetails,
      bonusData,
      latestResults,
      upcomingFixtures,
      matchesData,
      status
    ] = await Promise.all([
      loadOptionalJson("data/leaderboard.json", []),
      loadOptionalJson("data/player_details.json", []),
      loadOptionalJson("data/bonus_points.json", null),
      loadOptionalJson("data/latest_results.json", []),
      loadOptionalJson("data/upcoming_fixtures.json", []),
      loadOptionalJson("data/matches.json", []),
      loadOptionalJson("data/status.json", null)
    ]);

    const leaderboard = rankLeaderboardByTieBreakers(
      addGoalDifferenceToLeaderboard(leaderboardData, playerDetails)
    );
    const badgeData = findCurrentBadgeHolders(leaderboard, playerDetails, bonusData);

    renderTvDashboard({
      leaderboard,
      playerDetails,
      bonusData,
      latestResults,
      upcomingFixtures,
      matchesData,
      status,
      spoonTeam: badgeData.spoonTeam,
      badgesByPlayer: badgeData.badgesByPlayer,
      mostGoalsTeams: badgeData.mostGoalsTeams || []
    });

    setupPresentationLoop();
  }

  function renderTvDashboard(state) {
    const root = rootElement();
    const leader = state.leaderboard[0];

    root.innerHTML = `
      <header class="tv-topbar">
        <div>
          <span class="tv-eyebrow">Live Office Display</span>
          <h1>World Cup Sweepstake</h1>
        </div>
        <div class="tv-topbar-stats" aria-label="Dashboard summary">
          ${summaryStat("Leader", leader ? `${leader.name} · ${leader.points} pts` : "No data")}
          ${summaryStat("Matches", tournamentProgressText(state.status))}
          ${summaryStat("Mode", autoScrollEnabled ? "Autoscroll on" : "Presentation loop")}
        </div>
      </header>

      <section class="tv-stage-shell" aria-live="polite">
        ${leaderboardStage(state)}
        ${movementProgressStage(state)}
        ${matchesStage(state)}
        ${prizesBadgesStage(state)}
      </section>

      <nav class="tv-stage-indicator" aria-label="Presentation stage">
        ${["Leaderboard", "Movers", "Matches", "Prizes"].map((label, index) => `
          <span class="${index === 0 ? "is-active" : ""}" data-tv-stage-dot="${index}">
            ${label}
          </span>
        `).join("")}
      </nav>

      <footer class="tv-footer-ticker">
        <span><strong>Last Updated</strong> ${formatTvUpdated(state.status)}</span>
        <span><strong>Source</strong> ${escapeHtml(state.status?.source || "ESPN public scoreboard")}</span>
        <span><strong>Fetch Count</strong> ${escapeHtml(state.status?.matchesFetchedFromEspn ?? "?")}</span>
      </footer>
    `;
  }

  function summaryStat(label, value) {
    return `
      <div class="tv-summary-stat">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function leaderboardStage(state) {
    return `
      <article class="tv-stage is-active" data-tv-stage="0">
        <div class="tv-stage-grid tv-stage-grid-leaderboard">
          <section class="tv-panel tv-panel-primary tv-drift tv-autoscroll-area">
            <div class="tv-section-heading">
              <span>Stage 1</span>
              <h2>Leaderboard</h2>
            </div>
            <table class="tv-leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Move</th>
                  <th>Player</th>
                  <th>Teams</th>
                  <th>Played</th>
                  <th>GD</th>
                  <th>Match</th>
                  <th>Bonus</th>
                  <th>Total</th>
                  <th>Badges</th>
                </tr>
              </thead>
              <tbody>
                ${renderLeaderboardRows(state)}
              </tbody>
            </table>
          </section>

          <aside class="tv-side-stack">
            ${currentLeaderPanel(state)}
            ${woodenSpoonPanel(state)}
          </aside>
        </div>
      </article>
    `;
  }

  function movementProgressStage(state) {
    return `
      <article class="tv-stage" data-tv-stage="1">
        <div class="tv-stage-grid tv-two-column">
          <section class="tv-panel tv-drift">
            <div class="tv-section-heading">
              <span>Stage 2</span>
              <h2>Biggest Movers</h2>
            </div>
            <div class="tv-mover-list">
              ${renderBiggestMovers(state.leaderboard)}
            </div>
          </section>

          <section class="tv-panel tv-drift tv-drift-alt">
            <div class="tv-section-heading">
              <span>Stage 2</span>
              <h2>Tournament Progress</h2>
            </div>
            ${renderTournamentProgress(state.status, state.latestResults)}
          </section>
        </div>
      </article>
    `;
  }

  function matchesStage(state) {
    return `
      <article class="tv-stage" data-tv-stage="2">
        <section class="tv-panel tv-panel-full tv-drift tv-autoscroll-area">
          <div class="tv-section-heading">
            <span>Stage 3</span>
            <h2>Next Matches</h2>
          </div>
          <div class="tv-match-grid tv-knockout-match-grid">
            ${renderUpcomingMatches(knockoutTvFixtures(state), state.leaderboard)}
          </div>
        </section>
      </article>
    `;
  }

  function prizesBadgesStage(state) {
    return `
      <article class="tv-stage" data-tv-stage="3">
        <div class="tv-stage-grid tv-two-column">
          <section class="tv-panel tv-drift tv-autoscroll-area">
            <div class="tv-section-heading">
              <span>Stage 4</span>
              <h2>Prize Pool</h2>
            </div>
            ${renderPrizePool(state)}
          </section>

          <section class="tv-panel tv-drift tv-drift-alt tv-autoscroll-area">
            <div class="tv-section-heading">
              <span>Stage 4</span>
              <h2>Badge Races</h2>
            </div>
            ${renderBadgeRaces(state)}
          </section>
        </div>
      </article>
    `;
  }

  function renderLeaderboardRows(state) {
    if (!state.leaderboard.length) {
      return `<tr><td colspan="6">No leaderboard data found.</td></tr>`;
    }

    return state.leaderboard.map(player => {
      const teams = (player.teams || []).map(team => {
        const classes = teamHighlightClasses(team, player.name, state.spoonTeam, state.mostGoalsTeams);
        return teamNameHtml(team, classes);
      }).join("");
      const rankClass = player.rank === 1 ? "tv-rank-leader" : player.rank <= 3 ? "tv-rank-podium" : "";

      return `
        <tr class="${rankClass}">
          <td class="tv-rank-cell">${medal(player.rank)} ${player.rank}</td>
          <td class="tv-move-cell">${Number(player.movement || 0) === 0 ? "—" : `${Number(player.movement) > 0 ? "▲" : "▼"} ${Math.abs(Number(player.movement))}`}</td>
          <td class="tv-player-cell">${escapeHtml(player.name)}</td>
          <td class="tv-team-cell">${teams}</td>
          <td>${escapeHtml(player.gamesPlayed ?? 0)}</td>
          <td class="tv-gd-cell">${formatGoalDifference(player.goalDifference ?? 0)}</td>
          <td>${escapeHtml(player.matchPoints ?? player.points ?? 0)}</td>
          <td class="tv-bonus-cell">${escapeHtml(player.bonusPoints ?? 0)}</td>
          <td class="tv-points-cell">${escapeHtml(player.points ?? 0)}</td>
          <td class="tv-badge-cell">${badgeHtml(state.badgesByPlayer[player.name])}</td>
        </tr>
      `;
    }).join("");
  }

  function currentLeaderPanel(state) {
    const leader = state.leaderboard[0];

    if (!leader) {
      return infoPanel("Current Leader", "No data", "Leaderboard data has not loaded yet.");
    }

    const teams = (leader.teams || []).map(team => teamLabelHtml(team)).join("");

    return `
      <section class="tv-panel tv-mini-panel tv-current-leader tv-drift-alt">
        <div class="tv-section-heading">
          <span>Current Leader</span>
          <h2>${escapeHtml(leader.name)}</h2>
        </div>
        <div class="tv-leader-score">${escapeHtml(leader.points ?? 0)} pts</div>
        <div class="tv-team-row">${teams}</div>
        <p>GD ${formatGoalDifference(leader.goalDifference ?? 0)} · ${escapeHtml(leader.gamesPlayed ?? 0)} games played</p>
      </section>
    `;
  }

  function woodenSpoonPanel(state) {
    const teams = state.playerDetails.length
      ? sortWoodenSpoonTeams(flattenPlayerTeams(state.playerDetails)).slice(0, 5)
      : [];

    if (!teams.length) {
      return infoPanel("Wooden Spoon Race", "No data", "Wooden spoon data has not loaded yet.");
    }

    return `
      <section class="tv-panel tv-mini-panel tv-drift-alt">
        <div class="tv-section-heading">
          <span>Wooden Spoon Race</span>
          <h2>Bottom Five</h2>
        </div>
        <ol class="tv-spoon-list">
          ${teams.map((team, index) => `
            <li class="${index === 0 ? "is-current" : ""}">
              <span>${teamLabelHtml(team.team, index === 0 ? ["wooden-spoon-country"] : [])}</span>
              <strong>${escapeHtml(team.playerName)}</strong>
              <em>${escapeHtml(team.points)} pts · GD ${formatGoalDifference(team.goalDifference)}</em>
            </li>
          `).join("")}
        </ol>
      </section>
    `;
  }

  function infoPanel(label, title, text) {
    return `
      <section class="tv-panel tv-mini-panel">
        <div class="tv-section-heading">
          <span>${escapeHtml(label)}</span>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <p>${escapeHtml(text)}</p>
      </section>
    `;
  }

  function renderBiggestMovers(leaderboard) {
    const movers = [...(leaderboard || [])]
      .filter(player => Number(player.movement || 0) !== 0)
      .sort((a, b) => Math.abs(Number(b.movement || 0)) - Math.abs(Number(a.movement || 0)))
      .slice(0, 8);

    if (!movers.length) {
      return `
        <div class="tv-empty-state">
          <strong>No ranking movement yet</strong>
          <span>The table is holding steady after the latest update.</span>
        </div>
      `;
    }

    return movers.map(player => {
      const movement = Number(player.movement || 0);
      const direction = movement > 0 ? "up" : "down";
      const symbol = movement > 0 ? "▲" : "▼";

      return `
        <div class="tv-mover-row ${direction}">
          <span>${escapeHtml(player.name)}</span>
          <strong>${symbol} ${Math.abs(movement)}</strong>
          <em>Rank ${escapeHtml(player.rank)} · ${escapeHtml(player.points ?? 0)} pts</em>
        </div>
      `;
    }).join("");
  }

  function renderTournamentProgress(status, latestResults) {
    const completed = Number(status?.completedMatches ?? 0);
    const total = Number(status?.totalTournamentMatches ?? 104);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const recent = (latestResults || []).slice(0, 3);

    return `
      <div class="tv-progress-hero">
        <strong>${percent}%</strong>
        <span>${completed} of ${total} matches complete</span>
      </div>
      <div class="tv-progress-bar" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
      <div class="tv-result-strip">
        ${recent.length ? recent.map(match => `
          <div>
            <strong>${teamLabelHtml(match.team1)} ${escapeHtml(match.score1)}-${escapeHtml(match.score2)} ${teamLabelHtml(match.team2)}</strong>
            <span>${formatDateTime(match.date)}</span>
          </div>
        `).join("") : `<div><strong>No recent results yet</strong><span>Results will appear after completed matches.</span></div>`}
      </div>
    `;
  }


  function tvMatchStageKey(match) {
    const slug = match?.raw?.season?.slug || match?.stage || "";
    const map = {
      "round-of-32": "round_of_32",
      "round-of-16": "round_of_16",
      quarterfinals: "quarter_final",
      semifinals: "semi_final",
      final: "final",
      "3rd-place-match": "third_place"
    };
    return map[slug] || slug;
  }

  function isTvKnockoutMatch(match) {
    return ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final", "third_place"].includes(tvMatchStageKey(match));
  }

  function knockoutTvFixtures(state) {
    const knockout = [...(state.matchesData || [])]
      .filter(match => isTvKnockoutMatch(match) && !match.completed)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return knockout.length ? knockout.slice(0, 4) : (state.upcomingFixtures || []).slice(0, 4);
  }

  function fixtureImpactText(match, leaderboard) {
    const players = (match.players || []).slice(0, 4);
    if (!players.length) return "Potential +5 progression bonus if owned teams advance.";
    const names = players.map(player => player.name).filter(Boolean);
    if (names.length === 1) return `${names[0]} can gain knockout progression points.`;
    if (names.length >= 2) return `${names.slice(0, 2).join(" and ")} have a direct knockout swing.`;
    return "Knockout progression points on offer.";
  }

  function renderUpcomingMatches(fixtures, leaderboard = []) {
    const matches = [...(fixtures || [])]
      .filter(match => !match.completed)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    const visibleMatches = matches.slice(0, 4);

    if (!visibleMatches.length) {
      return `
        <div class="tv-empty-state">
          <strong>No upcoming knockout matches found</strong>
          <span>The fixture feed has no future knockout matches ready yet.</span>
        </div>
      `;
    }

    return visibleMatches.map(match => {
      const statusClass = fixtureStatusClass(match);
      const playerBits = [];
      [match.team1, match.team2].forEach(teamName => {
        (leaderboard || []).forEach(player => {
          if (playerOwnsTeam(player, teamName)) playerBits.push(`${escapeHtml(player.name)}: ${teamLabelHtml(teamName)}`);
        });
      });
      const players = playerBits.slice(0, 4).join(" ");

      return `
        <article class="tv-match-card tv-knockout-match-card">
          <div class="tv-match-meta">
            <span class="fixture-status ${statusClass}">${fixtureStatusLabel(match)}</span>
            <strong>${formatTimeOnly(match.date)}</strong>
          </div>
          <h3>${teamLabelHtml(match.team1)} <span>v</span> ${teamLabelHtml(match.team2)}</h3>
          <div class="tv-fixture-info-grid">
            <p><span>Fixture</span>${formatDateTime(match.date)}</p>
            <p><span>Points on offer</span>Win +3 · Qualify +5 · Clean sheet +2</p>
          </div>
          <em>${players ? `Sweepstake interest ${players}` : "No sweepstake players involved"}</em>
          <small class="tv-fixture-impact">${fixtureImpactText(match, leaderboard)}</small>
        </article>
      `;
    }).join("");
  }

  function renderPrizePool(state) {
    const projected = calculateProjectedPayouts(state.leaderboard, state.playerDetails, state.bonusData);
    const poolTotal = typeof PRIZE_POOL !== "undefined" ? PRIZE_POOL.total : 80;

    if (!projected.length) {
      return `
        <div class="tv-empty-state">
          <strong>Prize projection unavailable</strong>
          <span>Projected payouts will appear when leaderboard data is ready.</span>
        </div>
      `;
    }

    return `
      <div class="tv-prize-total">
        <span>Projected Pot</span>
        <strong>£${poolTotal}</strong>
      </div>
      <div class="tv-prize-list">
        ${projected.slice(0, 6).map(player => `
          <div class="tv-prize-row">
            <strong>${escapeHtml(player.name)}</strong>
            <span>£${escapeHtml(player.total)}</span>
            <em>${player.prizes.map(prize => `${escapeHtml(prize.icon)} ${escapeHtml(prize.label)}`).join(" + ")}</em>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderBadgeRaces(state) {
    if (!state.bonusData) {
      return `
        <div class="tv-empty-state">
          <strong>No badge race data</strong>
          <span>Badge races will appear when bonus data is ready.</span>
        </div>
      `;
    }

    return `
      <div class="tv-badge-race-grid">
        ${badgeRaceCard(
          "Golden Boot",
          "Top scorers",
          (state.bonusData.goldenBootRace || []).slice(0, 4).map(item => ({
            title: item.player,
            detail: `${item.goals} goals · ${ownersForTeam(state.leaderboard, item.team)}`,
            team: item.team
          }))
        )}
        ${badgeRaceCard(
          "Most Goals Nation",
          "Team goals",
          (state.bonusData.nationGoalTable || []).slice(0, 4).map(item => ({
            title: `${item.goals} goals`,
            detail: ownersForTeam(state.leaderboard, item.team),
            team: item.team
          }))
        )}
        ${badgeRaceCard(
          "Fastest Goal",
          "Prize race",
          fastestGoalRows(state)
        )}
      </div>
    `;
  }

  function badgeRaceCard(title, subtitle, rows) {
    return `
      <section class="tv-badge-race-card">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(subtitle)}</span>
        <ol>
          ${(rows || []).length ? rows.map(row => `
            <li>
              <strong>${row.team ? teamLabelHtml(row.team) : escapeHtml(row.title)}</strong>
              ${row.team ? `<em>${escapeHtml(row.title)}</em>` : ""}
              <small>${escapeHtml(row.detail || "")}</small>
            </li>
          `).join("") : `<li><strong>No data yet</strong><small>Race data pending.</small></li>`}
        </ol>
      </section>
    `;
  }

  function fastestGoalRows(state) {
    const race = Array.isArray(state.bonusData?.fastestGoalRace) && state.bonusData.fastestGoalRace.length
      ? state.bonusData.fastestGoalRace
      : state.bonusData?.fastestGoal
        ? [state.bonusData.fastestGoal]
        : [];

    return race.slice(0, 4).map(item => ({
      title: item.player || "Unknown player",
      detail: `${item.clockDisplay || "TBC"} · ${ownersForTeam(state.leaderboard, item.team)}`,
      team: item.team
    }));
  }

  function ownersForTeam(leaderboard, team) {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, team))
      .map(player => player.name);

    return owners.length ? `Owner: ${owners.join(", ")}` : "No owner";
  }

  function tournamentProgressText(status) {
    const completed = Number(status?.completedMatches ?? 0);
    const total = Number(status?.totalTournamentMatches ?? 104);
    return `${completed}/${total}`;
  }

  function formatTvUpdated(status) {
    return status?.lastUpdated ? formatDateTime(status.lastUpdated) : "Unknown";
  }

  function setupPresentationLoop() {
    const stages = Array.from(document.querySelectorAll("[data-tv-stage]"));
    const dots = Array.from(document.querySelectorAll("[data-tv-stage-dot]"));

    if (!stages.length) return;

    let activeIndex = 0;

    function activateStage(index) {
      window.clearTimeout(stageTimer);
      stopAutoScroll();
      activeIndex = index;

      stages.forEach((stage, stageIndex) => {
        stage.classList.toggle("is-active", stageIndex === activeIndex);
      });

      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === activeIndex);
      });

      startAutoScrollForStage(stages[activeIndex]);

      stageTimer = window.setTimeout(() => {
        activateStage((activeIndex + 1) % stages.length);
      }, STAGE_DURATIONS[activeIndex] || 15000);
    }

    activateStage(0);
  }

  function stopAutoScroll() {
    if (scrollFrame) {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
    }
  }

  function startAutoScrollForStage(stage) {
    if (!autoScrollEnabled || !stage) return;

    const areas = Array.from(stage.querySelectorAll(".tv-autoscroll-area"))
      .filter(area => area.scrollHeight - area.clientHeight > 24);

    if (!areas.length) return;

    let pauseUntil = 0;

    function tick(now) {
      if (now >= pauseUntil) {
        areas.forEach(area => {
          const maxScroll = area.scrollHeight - area.clientHeight;

          if (area.scrollTop >= maxScroll - 2) {
            area.scrollTop = 0;
            pauseUntil = now + 1600;
          } else {
            area.scrollTop += 0.22;
          }
        });
      }

      scrollFrame = window.requestAnimationFrame(tick);
    }

    scrollFrame = window.requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTvDashboard);
  } else {
    initTvDashboard();
  }
}());
