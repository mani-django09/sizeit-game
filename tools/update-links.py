"""Write a plain-HTML "More free games" block at the end of every game page.

The header menu is built by JavaScript. This block gives search engines (and people
without JavaScript) ordinary links between the games. Re-run after adding a game:
    python tools/update-links.py
"""
import io
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# folder -> (name, one-line pitch). Keep in sync with SITE.games in assets/common.js.
GAMES = {
    "size-it-up": ("How Big?", "Resize an object to its real size next to another."),
    "which-is-heavier": ("Heavier or Lighter", "Guess which of two things weighs more."),
    "sort-it": ("Sort It", "Put five things in order by size and by weight."),
    "ballpark": ("Ballpark", "Pick the range a real-world number falls in."),
    "speed-race": ("Speed Race", "Pick the faster racer, then watch them race."),
    "number-guess": ("Number Guess", "Guess a real-world number as closely as you can."),
    "how-many-fit": ("How Many Fit?", "Guess how many of one thing fit along another."),
    "how-far": ("How Far?", "Guess the straight-line distance between two cities."),
    "survival": ("Survival", "Mixed questions against the clock, with three lives."),
}

for folder in GAMES:
    p = ROOT / folder / "index.html"
    s = io.open(p, encoding="utf-8").read()
    items = "\n".join(
        f'          <li><a href="../{f}/"><b>{name}</b><span>{pitch}</span></a></li>'
        for f, (name, pitch) in GAMES.items() if f != folder)
    block = f"""<!-- more-games:start -->
      <section class="more-games">
        <h2>More free games</h2>
        <ul>
{items}
        </ul>
      </section>
      <!-- more-games:end -->"""
    s = re.sub(r"<!-- more-games:start -->.*?<!-- more-games:end -->\n?\s*", "", s, flags=re.S)
    s = s.replace("    </article>", f"      {block}\n    </article>", 1)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("updated", folder)
