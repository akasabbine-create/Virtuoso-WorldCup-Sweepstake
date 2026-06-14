fetch("data/leaderboard.json")
  .then(res => res.json())
  .then(data => {
    const tbody = document.querySelector("#board tbody");

    data.forEach((p, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td>${p.points}</td>
        </tr>
      `;
    });
  });
