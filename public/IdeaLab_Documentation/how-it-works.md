# IdeaLab 2.0: How Each Part Works

IdeaLab 2.0 turns the old single form into a workspace where each venture has its own page with seven connected parts plus an overview. Everything you type saves itself, and a scorecard shows what is still missing.

1. You open a venture from My Ventures or IdeaLab.
2. The workspace loads it from the database (only if you own it).
3. You edit a section; the change saves automatically after about a second.
4. The scorecard, pitch and next-step hint recalculate from what you entered.
5. Validation Lab holds the experiments that test your riskiest assumptions.

## Database

The migration only adds things; your current data is not changed. Private tables are readable by the owner alone.

| Item | What it holds |
| --- | --- |
| New columns on `ideas` | name, tagline, industry, stage, business model, funding goal, version number |
| `idea_workspace` | the blueprint (problem, solution, persona, tech, team) and pitch settings |
| `idea_competitors` | alternatives customers use today |
| `idea_market_assumptions` | market size inputs (TAM, SAM, SOM) |
| `idea_risks` | risks and assumptions with likelihood and impact |
| `idea_milestones` | features and dated milestones |
| `idea_private_notes` | your private notes |
| New columns on `hypotheses` | metric, threshold, test method, conclusion, link to a risk |

## Data and saving layer

| File | What it does |
| --- | --- |
| `ventureRepo.ts` | Every database call: list, create, load, save, and add or remove competitors, risks and milestones. Saves are version-checked, so a stale tab cannot silently overwrite newer work. |
| `useVenture.ts` | The hook the workspace uses. Holds the loaded venture, tracks save state, and exposes the edit and save functions. |
| `autosave.ts` | Waits about 1.2 seconds after you stop typing, then saves. If a save fails, your edits stay on screen and are retried. |
| Conflict handling | If the venture changed in another tab, saving pauses and you choose to reload or overwrite. |

## Pages and routes

| Page | Route | What it does |
| --- | --- | --- |
| `App.tsx` | n/a | Adds two founder-only routes. Nothing else changed. |
| `IdeaLab.tsx` | `/dashboard/idealab` | Opens your most recent venture, or the new-venture form if you have none. |
| `NewVenture` (in `IdeaLab.tsx`) | `/dashboard/idealab/new` | Asks for a name and creates the venture once, even on double-click. |
| `VentureWorkspace.tsx` | `/dashboard/idealab/:ideaId` | The workspace: header, section menu, save status, venture switcher. |
| `MyVentures.tsx` | `/dashboard/ventures` | Venture cards now show name and stage, with links to the workspace. |
| `ValidationLab.tsx` | `/dashboard/validation` | Now works per venture, adds an Inconclusive result, and warns if you mark something validated with no experiment. |

## The workspace sections

| Section | What you do there |
| --- | --- |
| Overview | See status, the single best next step, and all ten scorecard indicators. |
| 01 Venture Blueprint | Write the problem and solution in detail; separate observed facts from assumptions. |
| 02 Customer & Market | Define the first customer segment, list competitors, and estimate market size from customers times spend. |
| 03 Business Model | Choose a model and enter price and costs; see MRR, margin, CAC and break-even with the formula shown. |
| 04 Product & Execution | Define the MVP, must-have features, dated milestones, tech approach and team gaps. |
| 05 Risks & Validation | Place risks on a 5 by 5 grid and turn the worst ones into testable hypotheses. |
| 06 Pitch Studio | See a 13-section pitch built from your data, each part labelled by evidence type; edit, choose what to share, download. |
| 07 Venture Scorecard | Ten separate indicators, each with what is met, what is missing, and what to do next. |

## Logic files

None of these call the network; they only calculate from what you entered.

| File | What it does |
| --- | --- |
| `types.ts` | Defines the shapes of data used everywhere. |
| `financials.ts` | Calculates MRR, ARR, margin, CAC and break-even. Each result shows its formula, inputs, what is missing, and its limits. Bad input gives "missing", never a made-up number. |
| `scorecard.ts` | Ten checklist indicators. A score is the share of items done, not a chance of success. Filling forms never makes a venture "validated". |
| `pitch.ts` | Builds the pitch text and labels each part: founder-written, calculated, from an experiment, assumption, or missing. |
| `ideaCheck.ts` | Your original draft-strength check, unchanged and used as a separate measure. |

## Tests and what is not built

The three test files and `fakeSupabase.ts` are optional and do not run in the app. They checked the calculations, saving, conflicts and pitch logic (43 tests), plus 39 browser checks, on stand-in packages rather than your real project.

Not built yet:

- customer interview log
- PDF export of the pitch
- logging experiments inside the workspace (still in Validation Lab)
- AI analysis of ideas (planned for later)

Open decision: funding goal and use of funds sit on a table every logged-in user can read. Moving them to owner-only is a small follow-up.
