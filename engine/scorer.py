import json
from collections import defaultdict

def load(path):
    with open(path) as f:
        return json.load(f)

def save(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def calculate(players, matches):
    scores = defaultdict(int)

    for match in matches:
        t1, t2 = match["team1"], match["team2"]
        s1, s2 = match["score1"], match["score2"]

        if s1 > s2:
            results = {t1: 3}
        elif s2 > s1:
            results = {t2: 3}
        else:
            results = {t1: 1, t2: 1}

        for p in players:
            for team in p["teams"]:
                if team in results:
                    scores[p["name"]] += results[team]

    leaderboard = [
        {"name": p["name"], "points": scores[p["name"]]}
        for p in players
    ]

    leaderboard.sort(key=lambda x: x["points"], reverse=True)

    return leaderboard

if __name__ == "__main__":
    players = load("data/players.json")
    matches = load("data/matches.json")

    leaderboard = calculate(players, matches)

    save("data/leaderboard.json", leaderboard)
