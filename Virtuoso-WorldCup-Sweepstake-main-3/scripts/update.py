import subprocess
import sys

subprocess.run([sys.executable, "engine/scorer.py"], check=True)

print("Updated leaderboard")
