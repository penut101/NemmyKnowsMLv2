# NBA V1 engineering validation — 2026-10-28

V1 remains blocked on historical pregame market timestamps. The public-data pipeline, point-in-time feature builders, basketball-only models and integrity checks are implemented and executed. Real-data output validation passed; synthetic market tests are not presented as real predictive performance.

## Verified data coverage

| Starting season | Accepted games | Halftime timestamp gate passed |
| --- | ---: | ---: |
| 2020 | 826 | 87 |
| 2021 | 969 | 103 |
| 2022 | 1,024 | 83 |
| 2023 | 994 | 43 |
| Total | 3,813 | 316 |

The archive cohort covers 2020–21 through 2023–24. Independent ESPN/hoopR boxes supplied 80,393 canonical player-game rows. Rotations validated for 2,671 games; 1,142 were quarantined. Validation checks substitutions, per-player reported minutes within the fallback's rounding tolerance, and exactly 240 regulation player-minutes per team.

Fifteen official historical injury PDFs yielded 942 parsed rows and 690 canonical matches under parser version 3. The remaining 252 rows were excluded because their player/game identities could not be resolved in this cohort. Previous parser snapshots remain immutable. Injury coverage is a bounded smoke sample, not a complete season archive.

The SBR archive yielded 13,524 normalized market snapshots for 3,381 matched games. None has verifiable quote-availability timestamps. The inspected ESPN historical odds response also lacks quote timestamps. Consequently, zero historical rows qualify for strict market-aware training or an honest market benchmark. A captured Action response normalized to 168 quotes with collection times preserved; its unmapped current events were not joined to historical games.

## Walk-forward results

Selection used starting seasons 2021–22 for pregame and 2022 for halftime. Starting season 2023 (2023–24) was held out of selection. The following are final-holdout results for the groups selected by earlier-fold **margin MAE**:

| Model | Games | Margin MAE | Margin RMSE | Total MAE | Win log loss | Brier | Win accuracy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pregame P0: Elo/rest/form | 994 | 11.083 | 14.187 | 16.463 | 0.6122 | 0.2123 | 64.7% |
| Halftime H1: state + OOF pregame prior | 43 | 7.722 | 9.674 | 11.286 | 0.4489 | 0.1444 | 74.4% |

Pregame earlier-fold mean margin MAE was P0 **10.835**, P1 11.238, P2 11.254 and P3 11.338. The advanced groups were therefore not retained in the selected standalone margin model. Their total forecasts did improve: P1 earlier-fold total MAE averaged 15.484 versus P0's 16.249, and its final-holdout total MAE was 15.117. Current bundle selection is margin-driven; it does not claim one feature group is best for every target.

Halftime validation margin MAE was H0 8.428, H1 **8.351**, H3 8.358, H4 8.525, H5 8.806 and H6 8.860. The H1 improvement was small and based on only 83 validation games. On the untouched 43-game holdout, H0 actually had lower margin MAE (7.613) than the selected H1 (7.722); H1 improved total MAE (11.286 versus 11.818). This is not evidence of a stable betting edge. Halftime probabilities remain uncalibrated.

The 316 timestamp-eligible halftime games include the first season, which cannot supply out-of-season pregame priors. Actual halftime evaluation used 83 games in 2022–23 and 43 in 2023–24. H2 market-prior comparisons and real P4 pregame evaluation remain unavailable. H3–H6 results above omit unavailable market priors. No closing-market, ROI, EV or CLV result is claimed.

## Integrity and verification

Local migrations ran through revision 0003. Fresh PostgreSQL 17 migration and immutability checks passed in GitHub Actions. The local suite contains 23 passing tests covering canonical identities, independent score reconciliation, timestamp precision/timezones, future-data poisoning, later corrections, raw/snapshot immutability, injury status outcomes, traded-player rosters, bounded minutes, spread signs, de-vigging, Q1/Q2 isolation, model serialization and stale-artifact removal.

Raw observations are content-hashed and append-only. Ratings and roster history require observations available strictly before the target cutoff. Full-game statistics wait until the latest recorded correction. Halftime rows with missing or later first-half edits are excluded. Full-game target minutes and confirmed starters are not pregame inputs. Halftime labels use Q3/Q4 only; overtime affects the final winner but not H2 margin/total.

The evaluation trains only on earlier seasons and selects basketball feature groups on earlier validation folds, leaving the final season out of selection. Halftime priors are out-of-season pregame predictions. Market-aware paths are exercised with fixtures; these fixtures are kept separate from the real evaluation. The `validate-outputs` command passed on **12,704 prediction rows and 14,242 team/stage minute allocations**. It checked cutoffs, allocation totals, database prediction counts and artifact hashes, and reproduced both pregame and halftime holdout forecasts from the saved models, including the separate P1 prior model.

The validated dataset SHA-256 is `ea81124f85e67b770d7617085ad29d8a1de0ea987954aa42c837106b4ba6bc3e`. Earlier exploratory results and stale predictions were superseded. The [PostgreSQL CI run](https://github.com/penut101/NemmyKnowsMLv2/actions/runs/40705038777) also passed; subsequent final packaging changes run the same workflow.

## Remaining limitations and next work

Official NBA box requests returned HTTP 403, so independent rounded ESPN minutes provide the validation fallback. Historical injury hubs can serve current reports; the adapter filters requested seasons and requests dated PDFs directly when necessary. Unresolved crosswalks and source failures are retained for review. The archived feeds are retrospective reconstructions, not certified as-received live histories; edit-time gates reduce leakage risk but cannot certify identical historical versions across feeds.

Possessions and scoring profiles are approximations. Rosters use recent appearances rather than an authoritative transaction history. RAPM is net-only; injury status estimates have sparse observations; halftime win probabilities are uncalibrated Normal approximations. Limited halftime coverage makes ablation estimates uncertain. Data before 2020 has not been validated in this run.

To satisfy the remaining V1 market requirement, obtain historical quotes with defensible knowledge times or accumulate forward snapshots. No paid service was introduced. Full xPTS, true possessions, offensive/defensive RAPM, sophisticated foul/rotation models, sportsbook H2 history and dashboard deployment remain intentionally deferred in the root future-development document.

Exact setup and reproduction commands are in [README.md](README.md). Runtime versions and machine-readable validation evidence are in [validation/](validation/). Source pins and licensing boundaries are in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
