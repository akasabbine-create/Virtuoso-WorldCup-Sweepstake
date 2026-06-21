# Virtuoso-WorldCup-Sweepstake

## Hero assets

The hero/header is layered:
- `assets/title/hero_stadium_background.*` is the stadium background from the approved layered-hero version.
- `assets/title/header_true_transparent.png` is the true transparent title/header overlay supplied by Rob.
- `assets/title/world_cup_sweepstake_logo.png` is kept as an alias of the same transparent header for compatibility.

The latest site layout and feature files from the uploaded zip have been kept intact.

## Leaderboard tie-breakers

Leaderboard ranks are sorted by total points, then goal difference, then goals scored, then fewer games played, then player name.

## Mobile hero fix

The layered hero now includes a mobile-specific CSS override so the transparent header scales inside narrow phone screens without cropping the right-hand side of the title.

## Mobile hero blend polish

The mobile hero has an additional CSS pass that softens the stadium edges and fades the image into the page background on smaller screens.
