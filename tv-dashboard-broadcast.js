(function () {
  const STAGE_DURATIONS = [30000, 15000, 18000, 20000, 18000];
  const NAV_LABELS = ["Leaderboard", "Movers", "Matches", "Prizes", "Picture"];
  const STAGE_TITLES = {
    leaderboard: "LIVE LEADERBOARD",
    movers: "BIGGEST MOVERS",
    progress: "TOURNAMENT PROGRESS",
    fixtures: "UPCOMING FIXTURES",
    prizes: "PRIZE RACE",
    badges: "BADGE RACES",
    picture: "CHAMPIONSHIP PICTURE"
  };

  let startedAt = Date.now();
  let manualStage = -1;
  let manualUntil = 0;
  let tickerIndex = 0;
  let tickerTimer = 0;

  const q = selector => document.querySelector(selector);
  const qa = selector => Array.from(document.querySelectorAll(selector));
  const norm = value => String(value || "").trim().toLowerCase();
  const esc = value => {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value ?? "").replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
  };
  const team = value => typeof teamLabelHtml === "function" ? teamLabelHtml(value) : `<span class="team-name">${esc(value)}</span>`;
  const teamName = (value, classes) => typeof teamNameHtml === "function" ? teamNameHtml(value, classes) : team(value);
  const gd = value => typeof formatGoalDifference === "function" ? formatGoalDifference(value || 0) : String(value || 0);
  const timeOnly = value => typeof formatTimeOnly === "function" ? formatTimeOnly(value) : esc(value || "TBC");
  const dateTime = value => typeof formatDateTime === "function" ? formatDateTime(value) : esc(value || "TBC");
  const fixtureLabel = match => typeof fixtureStatusLabel === "function" ? fixtureStatusLabel(match) : match.status || "Upcoming";
  const fixtureClass = match => typeof fixtureStatusClass === "function" ? fixtureStatusClass(match) : match.live ? "live" : match.completed ? "final" : "upcoming";
  const load = (path, fallback) => typeof loadJson === "function" ? loadJson(path).catch(() => fallback) : Promise.resolve(fallback);

  function visibleFixtures(fixtures) {
    const future = [...(fixtures || [])]
      .filter(match => !match.completed)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return (future.length ? future : fixtures || []).slice(0, 4);
  }

  function playerMap(board) {
    return new Map((board || []).map(player => [norm(player.name), player]));
  }

  function teamOwners(board, teamNameValue) {
    return (board || []).filter(player => {
      if (typeof playerOwnsTeam === "function") return playerOwnsTeam(player, teamNameValue);
      return (player.teams || []).some(playerTeam => norm(playerTeam) === norm(teamNameValue));
    });
  }

  function ownedSide(player, match) {
    const teams = (player?.teams || []).map(norm);
    if (teams.includes(norm(match.team1))) return match.team1;
    if (teams.includes(norm(match.team2))) return match.team2;
    return "";
  }

  function opponent(match, side) {
    if (norm(side) === norm(match.team1)) return match.team2;
    if (norm(side) === norm(match.team2)) return match.team1;
    return "";
  }

  function scoreFor(match, side) {
    if (norm(side) === norm(match.team1)) return `${match.score1}-${match.score2}`;
    if (norm(side) === norm(match.team2)) return `${match.score2}-${match.score1}`;
    return `${match.score1}-${match.score2}`;
  }

  function gainFor(match, playerName) {
    return (match.playerGains || []).find(gain => norm(gain.name) === norm(playerName));
  }

  function resultVerb(points) {
    if (Number(points) === 3) return "beat";
    if (Number(points) === 1) return "drew with";
    return "scored against";
  }

  function resultStory(playerName, match, players) {
    const player = players.get(norm(playerName));
    const side = ownedSide(player, match);
    const gain = gainFor(match, playerName);
    const points = Number(gain?.points || 0);
    if (side) {
      return `${team(side)} ${resultVerb(points)} ${team(opponent(match, side))} ${scoreFor(match, side)} (+${points} pts)`;
    }
    return `${team(match.team1)} ${esc(match.score1)}-${esc(match.score2)} ${team(match.team2)} (+${points} pts)`;
  }

  function movementRanks(player) {
    const current = Number(player.rank || 0);
    const previous = Number(player.previousRank || current + Number(player.movement || 0));
    return { current, previous };
  }

  function movementReason(player, latest, players) {
    const movement = Number(player.movement || 0);
    if (movement > 0) {
      const result = (latest || []).find(match => gainFor(match, player.name));
      return result ? resultStory(player.name, result, players) : "Climbed through goal difference and tie-breakers";
    }

    const newestGain = (latest || []).find(match => (match.playerGains || []).some(gain => norm(gain.name) !== norm(player.name)));
    const gain = newestGain && (newestGain.playerGains || [])[0];
    if (newestGain && gain) return `${esc(gain.name)} gained ground: ${resultStory(gain.name, newestGain, players)}`;
    return "Dropped as the latest results reshaped the pack";
  }

  function movers(board) {
    return [...(board || [])]
      .filter(player => Number(player.movement || 0) !== 0)
      .sort((a, b) => Math.abs(Number(b.movement || 0)) - Math.abs(Number(a.movement || 0)))
      .slice(0, 8);
  }

  function biggestUp(board) {
    return [...(board || [])].filter(player => Number(player.movement || 0) > 0)
      .sort((a, b) => Number(b.movement || 0) - Number(a.movement || 0))[0] || null;
  }

  function biggestDown(board) {
    return [...(board || [])].filter(player => Number(player.movement || 0) < 0)
      .sort((a, b) => Number(a.movement || 0) - Number(b.movement || 0))[0] || null;
  }

  function spoonRows(details, limit = 5) {
    if (!details?.length || typeof flattenPlayerTeams !== "function" || typeof sortWoodenSpoonTeams !== "function") return [];
    return sortWoodenSpoonTeams(flattenPlayerTeams(details)).slice(0, limit);
  }

  function renderSectionHeading(title) {
    return `<div class="tv-section-heading"><h2>${esc(title)}</h2></div>`;
  }

  function renderMovement(player) {
    const movement = Number(player.movement || 0);
    if (movement > 0) return `<span class="tv-move-pill up">▲${Math.abs(movement)}</span>`;
    if (movement < 0) return `<span class="tv-move-pill down">▼${Math.abs(movement)}</span>`;
    return `<span class="tv-move-pill same">-</span>`;
  }

  function renderLeaderboardRows(state) {
    if (!state.board.length) return `<tr><td colspan="10">No leaderboard data found.</td></tr>`;
    return state.board.map(player => {
      const classes = player.rank === 1 ? "is-first" : player.rank === 2 ? "is-second" : player.rank === 3 ? "is-third" : "";
      const teams = (player.teams || []).map(playerTeam => {
        const highlightClasses = typeof teamHighlightClasses === "function"
          ? teamHighlightClasses(playerTeam, player.name, state.spoonTeam, state.mostGoalsTeams)
          : [];
        return teamName(playerTeam, highlightClasses);
      }).join("");
      const badges = typeof badgeHtml === "function" ? badgeHtml(state.badgesByPlayer[player.name]) : "";
      const medalText = typeof medal === "function" ? medal(player.rank) : "";
      return `
        <tr class="${classes}">
          <td class="tv-rank-cell">${medalText} ${esc(player.rank)}</td>
          <td class="tv-move-cell">${renderMovement(player)}</td>
          <td class="tv-player-cell">${esc(player.name)}</td>
          <td class="tv-team-cell">${teams}</td>
          <td>${esc(player.gamesPlayed ?? 0)}</td>
          <td>${gd(player.goalDifference ?? 0)}</td>
          <td>${esc(player.matchPoints ?? 0)}</td>
          <td>${esc(player.bonusPoints ?? 0)}</td>
          <td class="tv-points-cell">${esc(player.points ?? 0)}</td>
          <td class="tv-badge-cell">${badges}</td>
        </tr>
      `;
    }).join("");
  }

  function infoCard(label, title, detail, tone) {
    return `
      <section class="tv-panel tv-mini-panel tv-broadcast-card ${tone || ""}">
        <span>${esc(label)}</span>
        <strong>${esc(title)}</strong>
        <em>${detail}</em>
      </section>
    `;
  }

  function renderRightColumn(state) {
    const leader = state.board[0];
    const challenger = state.board[1];
    const spoon = spoonRows(state.details, 1)[0];
    const up = biggestUp(state.board);
    const leaderGap = leader && challenger ? Math.max(0, Number(leader.points || 0) - Number(challenger.points || 0)) : 0;
    return `
      <aside class="tv-side-stack tv-side-stack-broadcast">
        ${infoCard("Current Leader", leader?.name || "No data", leader ? `${esc(leader.points)} pts · GD ${gd(leader.goalDifference)}` : "Waiting for leaderboard", "gold")}
        ${infoCard("Closest Challenger", challenger?.name || "No data", challenger ? `${leaderGap} pts back · Rank ${esc(challenger.rank)}` : "No challenger yet", "silver")}
        ${infoCard("Wooden Spoon", spoon?.playerName || "No data", spoon ? `${team(spoon.team)} · ${esc(spoon.points)} pts` : "Waiting for teams", "bronze")}
        ${infoCard("Fastest Climber", up?.name || "No movers", up ? `Up ${Math.abs(Number(up.movement || 0))} · Rank ${esc(up.rank)}` : "Table holding steady", "blue")}
      </aside>
    `;
  }

  function renderLeaderboardStage(state) {
    const shell = q('[data-tv-stage="0"]');
    if (!shell) return;
    shell.innerHTML = `
      <div class="tv-stage-grid tv-stage-grid-leaderboard tv-stage-grid-scoreboard">
        <section class="tv-panel tv-panel-primary tv-drift tv-autoscroll-area">
          ${renderSectionHeading(STAGE_TITLES.leaderboard)}
          <table class="tv-leaderboard-table tv-scoreboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Move</th>
                <th>Player</th>
                <th>Teams</th>
                <th>GP</th>
                <th>GD</th>
                <th>Match</th>
                <th>Bonus</th>
                <th>Total</th>
                <th>Badges</th>
              </tr>
            </thead>
            <tbody>${renderLeaderboardRows(state)}</tbody>
          </table>
        </section>
        ${renderRightColumn(state)}
      </div>
    `;
  }

  function renderMoverCard(player, latest, players, hero) {
    const movement = Number(player.movement || 0);
    const direction = movement > 0 ? "up" : "down";
    const symbol = movement > 0 ? "▲" : "▼";
    const ranks = movementRanks(player);
    return `
      <article class="${hero ? "tv-mover-hero" : "tv-mover-card"} ${direction}">
        <span>${hero ? movement > 0 ? "BIGGEST WINNER" : "BIGGEST FALLER" : movement > 0 ? "Climber" : "Slider"}</span>
        <strong>${esc(player.name)} ${symbol}${Math.abs(movement)}</strong>
        <em>Moved ${esc(ranks.previous)} → ${esc(ranks.current)}</em>
        <p>${movementReason(player, latest, players)}</p>
      </article>
    `;
  }

  function renderMoversStage(state) {
    const shell = q('[data-tv-stage="1"]');
    if (!shell) return;
    const allMovers = movers(state.board);
    const hero = biggestUp(state.board) || allMovers[0];
    const rest = allMovers.filter(player => player !== hero).slice(0, 6);
    const players = playerMap(state.board);
    shell.innerHTML = `
      <div class="tv-stage-grid tv-two-column tv-movers-progress-grid">
        <section class="tv-panel tv-drift">
          ${renderSectionHeading(STAGE_TITLES.movers)}
          ${hero ? renderMoverCard(hero, state.latest, players, true) : `<div class="tv-empty-state"><strong>No ranking movement yet</strong><span>The table is holding steady.</span></div>`}
          <div class="tv-mover-card-grid">
            ${rest.map(player => renderMoverCard(player, state.latest, players, false)).join("")}
          </div>
        </section>
        <section class="tv-panel tv-drift tv-drift-alt">
          ${renderSectionHeading(STAGE_TITLES.progress)}
          ${renderProgress(state)}
        </section>
      </div>
    `;
  }

  function renderProgress(state) {
    const completed = Number(state.status?.completedMatches ?? 0);
    const total = Number(state.status?.totalTournamentMatches ?? 104);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const recent = (state.latest || []).slice(0, 4);
    return `
      <div class="tv-progress-hero">
        <strong>${percent}%</strong>
        <span>${esc(completed)} of ${esc(total)} matches complete</span>
      </div>
      <div class="tv-progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></div>
      <div class="tv-result-strip tv-result-strip-compact">
        ${recent.length ? recent.map(match => `
          <div>
            <strong>${team(match.team1)} ${esc(match.score1)}-${esc(match.score2)} ${team(match.team2)}</strong>
            <span>${dateTime(match.date)}</span>
          </div>
        `).join("") : `<div><strong>No recent results yet</strong><span>Results will appear after completed matches.</span></div>`}
      </div>
    `;
  }

  function fixtureOwners(match, board) {
    const fromMatch = (match.players || []).map(player => {
      const full = playerMap(board).get(norm(player.name)) || player;
      const teams = (full.teams || player.teams || []).filter(playerTeam => norm(playerTeam) === norm(match.team1) || norm(playerTeam) === norm(match.team2));
      return { name: player.name, teams };
    });
    if (fromMatch.length) return fromMatch;
    return [match.team1, match.team2].flatMap(matchTeam => teamOwners(board, matchTeam).map(owner => ({ name: owner.name, teams: [matchTeam] })));
  }

  function fixtureImpact(match, state) {
    const owners = fixtureOwners(match, state.board);
    if (!owners.length) return "No sweepstake player can score from this fixture";
    const ranked = owners.map(owner => state.board.find(player => norm(player.name) === norm(owner.name))).filter(Boolean).sort((a, b) => a.rank - b.rank);
    const leader = state.board[0];
    const best = ranked[0];
    const challenger = ranked.find(player => player.rank > 1 && player.rank <= 5) || ranked[0];
    if (best && leader && norm(best.name) === norm(leader.name)) return `${esc(best.name)} can extend the lead`;
    if (challenger && leader) {
      const gap = Math.max(0, Number(leader.points || 0) - Number(challenger.points || 0));
      return `${esc(challenger.name)} can close a ${gap} pt gap`;
    }
    return `${esc(owners[0].name)} can change the lower-table picture`;
  }

  function renderFixtureCard(match, state) {
    const owners = fixtureOwners(match, state.board);
    return `
      <article class="tv-fixture-impact-card">
        <div class="tv-match-meta">
          <span class="fixture-status ${fixtureClass(match)}">${esc(fixtureLabel(match))}</span>
          <strong>${timeOnly(match.date)}</strong>
        </div>
        <h3 class="tv-fixture-teams">
          <span>${team(match.team1)}</span>
          <em>v</em>
          <span>${team(match.team2)}</span>
        </h3>
        <div class="tv-fixture-owner-list">
          ${owners.length ? owners.map(owner => `
            <span><strong>${esc(owner.name)}</strong>${owner.teams.map(ownerTeam => team(ownerTeam)).join("")}</span>
          `).join("") : `<span><strong>No owners</strong>No sweepstake interest</span>`}
        </div>
        <div class="tv-fixture-impact">
          <strong>${fixtureImpact(match, state)}</strong>
          <span>Potential swing: 6 pts · Win +3 / Draw +1</span>
        </div>
      </article>
    `;
  }

  function renderFixturesStage(state) {
    const shell = q('[data-tv-stage="2"]');
    if (!shell) return;
    const matches = visibleFixtures(state.fixtures);
    shell.innerHTML = `
      <section class="tv-panel tv-panel-full tv-drift tv-fixtures-stage">
        ${renderSectionHeading(STAGE_TITLES.fixtures)}
        <div class="tv-fixture-impact-grid">
          ${matches.length ? matches.map(match => renderFixtureCard(match, state)).join("") : `<div class="tv-empty-state"><strong>No upcoming matches found</strong><span>The fixture feed has no future matches for today.</span></div>`}
        </div>
      </section>
    `;
  }

  function projectedPayouts(state) {
    if (typeof calculateProjectedPayouts !== "function") return [];
    return calculateProjectedPayouts(state.board, state.details, state.bonus) || [];
  }

  function raceRows(items, mapper, limit = 5) {
    return (items || []).slice(0, limit).map(mapper).join("") || `<li><strong>No data yet</strong><small>Race data pending.</small></li>`;
  }

  function ownerText(teamValue, board) {
    const owners = teamOwners(board, teamValue).map(owner => owner.name);
    return owners.length ? owners.join(", ") : "No owner";
  }

  function renderRacePanel(title, rows, accent) {
    return `
      <section class="tv-race-panel ${accent || ""}">
        <h3>${esc(title)}</h3>
        <ol>${rows}</ol>
      </section>
    `;
  }

  function renderPrizeStage(state) {
    const shell = q('[data-tv-stage="3"]');
    if (!shell) return;
    const projected = projectedPayouts(state);
    const poolTotal = typeof PRIZE_POOL !== "undefined" ? PRIZE_POOL.total : 80;
    const fastest = Array.isArray(state.bonus?.fastestGoalRace) ? state.bonus.fastestGoalRace : state.bonus?.fastestGoal ? [state.bonus.fastestGoal] : [];
    const spoon = spoonRows(state.details, 1)[0];
    const top = state.board.slice(0, 3);
    shell.innerHTML = `
      <section class="tv-panel tv-panel-full tv-drift tv-prize-broadcast">
        ${renderSectionHeading(STAGE_TITLES.prizes)}
        <div class="tv-prize-board">
          <div class="tv-prize-left">
            <section class="tv-pot-card">
              <span>Projected Pot</span>
              <strong>£${esc(poolTotal)}</strong>
              <em>Live projection from current standings</em>
            </section>
            <section class="tv-cash-board">
              <h3>Projected Cash Payouts</h3>
              ${top.map((player, index) => {
                const payout = projected.find(item => norm(item.name) === norm(player.name));
                return `<div><span>${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"}</span><strong>${esc(player.name)}</strong><em>£${esc(payout?.total ?? 0)} · ${esc(player.points)} pts</em></div>`;
              }).join("")}
              ${projected.filter(item => !top.some(player => norm(player.name) === norm(item.name))).slice(0, 3).map(item => `<div><span>Prize</span><strong>${esc(item.name)}</strong><em>£${esc(item.total)} · ${item.prizes.map(prize => esc(prize.label)).join(" + ")}</em></div>`).join("")}
              ${spoon ? `<div><span>Spoon</span><strong>${esc(spoon.playerName)}</strong><em>${team(spoon.team)} · wooden spoon race</em></div>` : ""}
            </section>
          </div>
          <div class="tv-race-stack-premium">
            ${renderRacePanel("Golden Boot", raceRows(state.bonus?.goldenBootRace, item => `<li><strong>${esc(item.player)}</strong><em>${team(item.team)} · ${esc(item.goals)} goals</em><small>Owner: ${esc(ownerText(item.team, state.board))}</small></li>`), "gold")}
            ${renderRacePanel("Most Goals Nation", raceRows(state.bonus?.nationGoalTable, item => `<li><strong>${team(item.team)}</strong><em>${esc(item.goals)} goals</em><small>Owner: ${esc(ownerText(item.team, state.board))}</small></li>`), "blue")}
            ${renderRacePanel("Fastest Goal", raceRows(fastest, item => `<li><strong>${esc(item.player || "Unknown")}</strong><em>${team(item.team)} · ${esc(item.clockDisplay || "TBC")}</em><small>${esc(item.match || "")} · Owner: ${esc(ownerText(item.team, state.board))}</small></li>`, 6), "bronze")}
          </div>
        </div>
      </section>
    `;
  }

  function bestImpactMatch(state) {
    return visibleFixtures(state.fixtures).map(match => {
      const owners = fixtureOwners(match, state.board);
      const ranks = owners.map(owner => state.board.find(player => norm(player.name) === norm(owner.name))).filter(Boolean);
      const score = ranks.reduce((total, player) => total + Math.max(0, 18 - Number(player.rank || 18)), 0);
      return { match, score };
    }).sort((a, b) => b.score - a.score)[0]?.match || visibleFixtures(state.fixtures)[0];
  }

  function renderChampionshipStage(state) {
    let shell = q('[data-tv-stage="4"]');
    if (!shell) {
      q(".tv-stage-shell")?.insertAdjacentHTML("beforeend", `<article class="tv-stage" data-tv-stage="4"></article>`);
      shell = q('[data-tv-stage="4"]');
    }
    if (!shell) return;
    const leader = state.board[0];
    const bottom = spoonRows(state.details, 5);
    const up = biggestUp(state.board);
    const down = biggestDown(state.board);
    const impact = bestImpactMatch(state);
    const projected = projectedPayouts(state);
    shell.innerHTML = `
      <section class="tv-panel tv-panel-full tv-drift tv-picture-stage">
        ${renderSectionHeading(STAGE_TITLES.picture)}
        <div class="tv-picture-grid">
          <section class="tv-picture-panel title-race">
            <span>Title Race</span>
            ${state.board.slice(0, 3).map((player, index) => `<div><strong>${index + 1}. ${esc(player.name)}</strong><em>${esc(player.points)} pts${leader ? ` · ${Math.max(0, Number(leader.points || 0) - Number(player.points || 0))} back` : ""}</em></div>`).join("")}
          </section>
          <section class="tv-picture-panel spoon-race">
            <span>Wooden Spoon Race</span>
            ${bottom.map((row, index) => `<div><strong>${index + 1}. ${esc(row.playerName)}</strong><em>${team(row.team)} · ${esc(row.points)} pts</em></div>`).join("")}
          </section>
          <section class="tv-picture-panel shakeups">
            <span>Biggest Shifts</span>
            <div><strong>Riser: ${esc(up?.name || "None")}</strong><em>${up ? `▲${Math.abs(Number(up.movement || 0))} to ${esc(up.rank)}` : "No upward movement"}</em></div>
            <div><strong>Faller: ${esc(down?.name || "None")}</strong><em>${down ? `▼${Math.abs(Number(down.movement || 0))} to ${esc(down.rank)}` : "No downward movement"}</em></div>
          </section>
          <section class="tv-picture-panel next-impact">
            <span>What Could Change Next</span>
            ${impact ? `<div><strong>${team(impact.team1)} v ${team(impact.team2)}</strong><em>${fixtureImpact(impact, state)} · Potential swing 6 pts</em></div>` : `<div><strong>No fixture data</strong><em>Next impact will appear when fixtures load</em></div>`}
          </section>
          <section class="tv-picture-panel prize-snapshot">
            <span>Prize Snapshot</span>
            ${(projected || []).slice(0, 4).map(item => `<div><strong>${esc(item.name)}</strong><em>£${esc(item.total)} · ${item.prizes.map(prize => esc(prize.label)).join(" + ")}</em></div>`).join("") || `<div><strong>No projection</strong><em>Prize data pending</em></div>`}
          </section>
        </div>
      </section>
    `;
  }

  function renderNav() {
    const nav = q(".tv-stage-indicator");
    if (!nav) return;
    nav.innerHTML = NAV_LABELS.map((label, index) => `
      <span class="${index === 0 ? "is-active" : ""}" data-tv-stage-dot="${index}" role="button" tabindex="0">${esc(label)}</span>
    `).join("");
    qa("[data-tv-stage-dot]").forEach((dot, index) => {
      dot.onclick = () => activate(index, true);
      dot.onkeydown = event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(index, true);
        }
      };
    });
  }

  function renderChrome(state) {
    document.body.classList.add("tv-broadcast-ready", "tv-content-polish-ready");
    const top = q(".tv-topbar");
    if (top) {
      const leader = state.board[0];
      top.innerHTML = `
        <div class="tv-brand-lockup">
          <img class="tv-brand-mark" src="assets/title/header_true_transparent.png" alt="Virtuoso World Cup Sweepstake">
          <div class="tv-brand-copy"><span>Broadcast Display</span><strong>Live sweepstake standings</strong></div>
        </div>
        <div class="tv-topbar-stats" aria-label="Dashboard summary">
          <div class="tv-summary-stat"><span>Leader</span><strong>${leader ? `${esc(leader.name)} · ${esc(leader.points)} pts` : "No data"}</strong></div>
          <div class="tv-summary-stat"><span>Matches</span><strong>${esc(state.status?.completedMatches ?? 0)}/${esc(state.status?.totalTournamentMatches ?? 104)}</strong></div>
          <div class="tv-summary-stat"><span>Mode</span><strong>${new URLSearchParams(window.location.search).get("autoscroll") === "true" ? "Autoscroll on" : "Presentation loop"}</strong></div>
        </div>
      `;
    }
    const footer = q(".tv-footer-ticker");
    if (footer && !q(".tv-broadcast-ticker")) {
      footer.insertAdjacentHTML("beforebegin", `<div class="tv-broadcast-ticker"><strong>Live Wire</strong><span data-tv-broadcast-copy></span></div>`);
    }
    renderNav();
  }

  function tickerItems(state) {
    const items = [];
    const leader = state.board[0];
    const up = biggestUp(state.board);
    const spoon = spoonRows(state.details, 1)[0];
    const result = state.latest?.[0];
    const upcoming = visibleFixtures(state.fixtures)[0];
    const projected = projectedPayouts(state);
    if (result) items.push(`Latest result: ${team(result.team1)} ${esc(result.score1)}-${esc(result.score2)} ${team(result.team2)}`);
    if (up) items.push(`Biggest mover: <strong>${esc(up.name)}</strong> up ${Math.abs(Number(up.movement || 0))} places`);
    if (spoon) items.push(`Wooden spoon watch: <strong>${esc(spoon.playerName)}</strong> with ${team(spoon.team)}`);
    if (leader) items.push(`Current leader: <strong>${esc(leader.name)}</strong> on ${esc(leader.points)} points`);
    if (upcoming) items.push(`Next up: ${team(upcoming.team1)} v ${team(upcoming.team2)} at ${timeOnly(upcoming.date)}`);
    if (projected[0]) items.push(`Prize race: <strong>${esc(projected[0].name)}</strong> projected for £${esc(projected[0].total)}`);
    return items.length ? items : ["Live sweepstake updates will appear here."];
  }

  function runTicker(state) {
    const copy = q("[data-tv-broadcast-copy]");
    if (!copy) return;
    const items = tickerItems(state);
    window.clearInterval(tickerTimer);
    function paint() {
      copy.classList.remove("is-visible");
      window.setTimeout(() => {
        copy.innerHTML = items[tickerIndex % items.length];
        copy.classList.add("is-visible");
        tickerIndex += 1;
      }, 200);
    }
    paint();
    tickerTimer = window.setInterval(paint, 8000);
  }

  function wantedStage() {
    if (manualStage > -1 && Date.now() < manualUntil) return manualStage;
    if (manualStage > -1) {
      manualStage = -1;
      startedAt = Date.now();
    }
    const total = STAGE_DURATIONS.reduce((sum, duration) => sum + duration, 0);
    let elapsed = (Date.now() - startedAt) % total;
    for (let index = 0; index < STAGE_DURATIONS.length; index += 1) {
      elapsed -= STAGE_DURATIONS[index];
      if (elapsed < 0) return index;
    }
    return 0;
  }

  function activate(index, hold) {
    const stages = qa("[data-tv-stage]");
    const dots = qa("[data-tv-stage-dot]");
    const safeIndex = Math.max(0, Math.min(index, stages.length - 1));
    stages.forEach((stage, stageIndex) => {
      stage.classList.toggle("is-active", stageIndex === safeIndex);
      if (stageIndex === safeIndex) stage.querySelectorAll(".tv-autoscroll-area").forEach(area => { area.scrollTop = 0; });
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === safeIndex);
      dot.setAttribute("aria-current", dotIndex === safeIndex ? "page" : "false");
    });
    if (hold) {
      manualStage = safeIndex;
      manualUntil = Date.now() + (STAGE_DURATIONS[safeIndex] || 15000);
    }
  }

  function syncLoop() {
    activate(wantedStage(), false);
  }

  async function buildState() {
    const [raw, details, bonus, latest, fixtures, status] = await Promise.all([
      load("data/leaderboard.json", []),
      load("data/player_details.json", []),
      load("data/bonus_points.json", null),
      load("data/latest_results.json", []),
      load("data/upcoming_fixtures.json", []),
      load("data/status.json", null)
    ]);
    const board = typeof addGoalDifferenceToLeaderboard === "function" && typeof rankLeaderboardByTieBreakers === "function"
      ? rankLeaderboardByTieBreakers(addGoalDifferenceToLeaderboard(raw, details))
      : raw;
    const badgeData = typeof findCurrentBadgeHolders === "function" ? findCurrentBadgeHolders(board, details, bonus) : {};
    return {
      board,
      details,
      bonus,
      latest,
      fixtures,
      status,
      spoonTeam: badgeData.spoonTeam,
      badgesByPlayer: badgeData.badgesByPlayer || {},
      mostGoalsTeams: badgeData.mostGoalsTeams || []
    };
  }

  async function enhance() {
    const state = await buildState();
    renderChrome(state);
    renderLeaderboardStage(state);
    renderMoversStage(state);
    renderFixturesStage(state);
    renderPrizeStage(state);
    renderChampionshipStage(state);
    runTicker(state);
    syncLoop();
    window.setInterval(syncLoop, 90);
  }

  function boot() {
    let waited = 0;
    const poll = window.setInterval(() => {
      if (q("[data-tv-stage]") || waited++ > 100) {
        window.clearInterval(poll);
        enhance();
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}());
