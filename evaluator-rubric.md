# Evaluator Rubric

Use this rubric after implementation and before final acceptance.
Scores: 0 = fails, 1 = partly, 2 = meets. The notes below grade session 006 (2026-10-05).

| Category | Question | Score (0-2) | Notes |
| --- | --- | --- | --- |
| Correctness | Does the implemented behavior match the requested feature? | 2 | API defaults, cinema_order, SEO files, sky lift and the 3-way sync all work as asked. The sky is the minimum of wave 8b, not the full cloud pass. |
| Verification | Did the required checks actually run, with evidence? | 2 | `npm run verify` 7/7 after each group; before/after screenshots read; luma 71.6 to 89.6 (default) and 73.2 to 104.1 (sunset); sync-engine apply tested on a scratch copy. |
| Scope discipline | Did the session stay inside the chosen feature scope? | 2 | Only guimaraes-3d was edited; braga-3d was read only. |
| Reliability | Does the result survive restart or rerun without repair? | 2 | Fresh headless load shows 0 errors and 0 warnings; `--dry-run` is repeatable and `--apply` never overwrites fork work. |
| Maintainability | Is the code and documentation clear enough for the next session? | 2 | Drift reasons live in `FIT_RULES.drift`; the sync script header explains the four states. |
| Handoff readiness | Can a fresh session continue work from repo artifacts only? | 2 | `session-handoff.md`, `claude-progress.md` and `feature_list.json` match the code. |

## Verdict

- Accept

## Required Follow-Up

- Missing evidence: a live check of the cinema film order (the 18-stop run was not played end to end); the fit-drift reasons are inferred from the deviation numbers, not from site surveys.
- Required fixes: none blocking.
- Next review trigger: wave 8b clouds and sun shafts, or the next `sync-engine.sh --record`.
