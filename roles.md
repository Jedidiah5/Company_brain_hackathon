# Roles

Three roles in the brief. Four of us, so one role doubles up. Put names against these at 12:30; a role with no
name on it does not get built.

| Role | Owns | Hands off |
|---|---|---|
| Brain + scoring | Company profile prompt, intent scoring prompt, ranking, the disqualify rules | `scores`, `reasoning`, `disqualified` on each lead |
| Data | Reddit and Hacker News fetch, pain points into queries, cleaning and deduping | Leads with everything above `scores` filled |
| Lightfern + pitch | The board, claim and status, demo script, Loom | The thing judges actually see |
| Fourth pair of hands | Doubles on Lightfern + pitch | The Loom is 30% of the marks and always runs late |

**Put the fourth person on the pitch, not the build.** The judging splits evenly between the build and the
sell, and three people on code with nobody rehearsing is how teams lose this track. The demo script and the
Loom need someone whose only job they are from about 14:00.

## The seams, where it usually breaks

- **Data to Brain.** Agree the lead shape at 12:30 and freeze the key names. Data should write a `leads.json`
  with five real records by 13:00 so Brain has something true to score before the fetch is finished.
- **Brain to Lightfern.** The board should render from a static `leads.json` from the start. Then the live
  fetch replaces the file and nothing in the board changes.
- **Everyone to the demo.** Whoever owns the pitch needs a frozen copy of the data by 14:30. If the live run
  fails on stage, the frozen copy is the demo.
