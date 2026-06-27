# Virtuoso-WorldCup-Sweepstake

## Hero assets

The hero/header is layered:
- `assets/title/hero_stadium_background.*` is the stadium background from the approved layered-hero version.
- `assets/title/header_true_transparent.png` is the true transparent title/header overlay supplied by Rob.
- `assets/title/world_cup_sweepstake_logo.png` is kept as an alias of the same transparent header for compatibility.

The latest site layout and feature files from the uploaded zip have been kept intact.

## Leaderboard tie-breakers

Leaderboard ranks are sorted by total points, then goal difference, then goals scored, then fewer games played, then player name.

## TV dashboard mode

TV dashboard mode is a passive office-display view for a 55-75 inch landscape screen.

Activate it with either:
- `/tv/`
- `?tv=true`

Optional autoscroll can be enabled with:
- `/tv/?autoscroll=true`
- `?tv=true&autoscroll=true`

The TV dashboard keeps the existing data sources and scoring helpers, then presents a large-format loop:
- Leaderboard for 20 seconds
- Biggest Movers and Tournament Progress for 15 seconds
- Next Matches for 15 seconds
- Prize Pool and Badge Races for 15 seconds

## Mobile hero fix

The layered hero now includes a mobile-specific CSS override so the transparent header scales inside narrow phone screens without cropping the right-hand side of the title.

## Mobile hero blend polish

The mobile hero has an additional CSS pass that softens the stadium edges and fades the image into the page background on smaller screens.

## Knockout tracker

Knockout bonus handling is now live:

- Progression bonuses are awarded as soon as ESPN shows a real team in the relevant knockout fixture.
- Round of 32 +5, Round of 16 +5, quarter-final +5, semi-final +10, final +10, winner +15.
- Knockout clean sheets add +2 from the Round of 32 onwards.
- Penalty shootout winners count as the match winner for sweepstake points because the progressing team is what matters.
- `data/knockout_tracker.json` powers the visible Knockout Tracker section for bonus transparency.

## Knockout bracket and TV knockout polish

The main site now includes a knockout bracket driven from `data/matches.json`. TV mode also prioritises upcoming knockout fixtures and shows match, bonus and clean-sheet points on offer.

## Knockout/TV fix pass

This version restores clean podium row styling, makes bracket ownership inline beside teams, adds a TV knockout stage, and tightens the TV leaderboard so team chips do not stack vertically.

## Podium row visual fix

The main and TV leaderboards now use flat full-row podium bands for 1st, 2nd and 3rd place. This removes the blocky per-column grid effect introduced by later TV/knockout styling passes.

## Main leaderboard podium row correction

The main site leaderboard podium rows are forced back to continuous full-row bands. The final override at the end of `style.css` prevents later knockout/TV styles from applying per-cell backgrounds that caused the grid/block effect.
