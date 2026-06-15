fetch(`data/leaderboard.json?ts=${Date.now()}`)
  .then(res => res.json())
  .then(data => {
    const tbody = document.querySelector("#board tbody");
    tbody.innerHTML = "";

    data.forEach(p => {
      const tr = document.createElement("tr");

      if (p.rank === 1) {
        tr.classList.add("leader");
      }

      tr.innerHTML = `
        <td>${p.rank}</td>
        <td>${p.name}</td>
        <td>${p.teams ? p.teams.join(", ") : ""}</td>
        <td>${p.gamesPlayed ?? 0}</td>
        <td>${p.points}</td>
      `;

      tbody.appendChild(tr);
    });
  })
  .catch(error => {
    console.error("Could not load leaderboard:", error);
  });
