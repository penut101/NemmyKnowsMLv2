# Future Development

This file tracks intentionally deferred work after the first complete V1 of the NBA pregame + halftime modeling system.

## Highest priority

### 1. Historical second-half sportsbook lines
Find or construct a reliable historical dataset containing:
- second-half spread
- second-half total
- second-half moneyline
- sportsbook
- timestamp
- price
- line

This is required to move from “predicting the second half well” to “measuring whether the model beats the available halftime market.”

Desired future normalized markets:
- `spreads_h2`
- `totals_h2`
- `h2h_h2`
- alternate H2 spreads/totals if practical

Once available, create:
- model H2 line
- market H2 line
- edge in points
- cover probability
- implied probability
- expected value
- theoretical ROI
- closing-line value

Do not block V1 on this.

### 2. Live second-half market collector
Once a reliable free or approved market source is identified, collect live halftime snapshots ourselves so future seasons are fully owned.

Store every meaningful change in:
- H2 spread
- H2 total
- H2 moneyline
- book price
- timestamp

### 3. Expected shot-quality model
Build an expected-points model using:
- player
- shot location
- shot distance
- shot type
- zone
- game context
- defender information if a free/reliable source is later found

Target outputs:
- xPTS
- expected eFG%
- H1 shooting over/underperformance
- team shot-quality differential

Use this to separate poor shooting process from bad shooting luck.

## Player / lineup improvements

### 4. Better RAPM
Upgrade the initial ridge RAPM to:
- separate offensive and defensive RAPM
- Bayesian/shrunk RAPM
- stronger possession weighting
- multi-season priors
- role/position priors
- uncertainty estimates

### 5. Lineup chemistry
Add lineup-synergy effects beyond summed individual player impact.

Potential inputs:
- five-man lineup history
- two-man / three-man combinations
- shared possessions
- lineup spacing / role compatibility
- historical net performance with shrinkage

Avoid small-sample overfitting.

### 6. Projected-minutes model V2
Improve projected minutes with:
- coach-specific rotation patterns
- role changes
- minutes restrictions
- blowout probability
- game importance
- foul-risk effects
- recent injury return
- rest management

Add uncertainty intervals around projected minutes.

### 7. Confirmed starter timing
Measure exactly when NBA live feeds populate confirmed starters before tipoff.

If not reliable enough, add a free pre-tip confirmation adapter while keeping NBA IDs canonical.

## Team-strength improvements

### 8. Matchup-specific modeling
Add:
- pick-and-roll offense/defense
- rim frequency and rim defense
- three-point attempt profile
- switch/drop/zone tendencies if obtainable
- transition frequency
- opponent shot-location profile

### 9. Playoffs model
Train a separate playoff model because:
- rotations tighten
- home-court behavior differs
- rest patterns differ
- matchup adaptation increases

Do not assume regular-season coefficients transfer unchanged.

### 10. Travel and schedule stress
Add:
- travel distance
- time-zone changes
- altitude
- 3-in-4
- 4-in-6
- prior-game overtime
- prior-game star minutes

## Market-model improvements

### 11. Better de-vig methods
Compare:
- proportional normalization
- power method
- Shin method where appropriate

Track calibration by favorite/underdog price band.

### 12. Book weighting
Learn which books are most informative.

Possible future consensus:
- median line
- sharp-book weighted line
- liquidity-aware weighting
- source reliability weighting

### 13. Market microstructure
Study:
- opener-to-close movement
- injury-news movement
- disagreement across books
- stale lines
- reverse line movement
- speed of repricing after official injury updates

## Halftime-model improvements

### 14. True possession parser
Replace the approximate possession formula with a full play-by-play possession parser.

Handle:
- offensive rebounds
- shooting fouls
- technical free throws
- end-of-quarter possessions
- jump balls
- team turnovers
- flagrant sequences

### 15. In-game injury detection
Detect:
- player leaves game and does not return
- locker-room events
- abrupt minute deviations
- official live status changes

Update H2 projected minutes and lineup strength immediately.

### 16. Foul-trouble model
Model expected second-half minutes conditional on:
- player foul count
- role
- coach behavior
- historical foul-management behavior
- game score

### 17. Better uncertainty modeling
Predict distributions, not only point estimates.

Options:
- quantile regression
- conformal prediction
- probabilistic gradient boosting
- Bayesian models

Use this for cover probabilities and expected value.

## Evaluation / betting research

### 18. Calibration layer
Calibrate:
- win probabilities
- cover probabilities
- total probabilities

Compare:
- Platt scaling
- isotonic regression
- beta calibration

Use only out-of-fold/walk-forward calibration.

### 19. Closing-line value
Once live market snapshots exist, track:
- bet line
- later line
- closing line
- CLV in points
- CLV in implied probability

CLV should be a core model-health metric.

### 20. Bankroll / stake sizing
Do not add automatic wagering in V1.

Future research only:
- flat staking
- fractional Kelly
- edge thresholds
- max exposure
- correlated-game exposure
- drawdown constraints

Backtest with conservative assumptions and realistic vig.

## Data / infrastructure

### 21. Endpoint resilience
Undocumented public feeds may change.

Add:
- versioned provider adapters
- contract tests
- health checks
- automatic fallback selection
- raw payload replay

### 22. Data-quality dashboard
Monitor:
- missing games
- failed rotation reconstructions
- injury-report coverage
- market-book coverage
- stale feeds
- unusual minute totals
- model drift

### 23. Live inference service
After offline validation, expose internal endpoints such as:

```text
GET /games/today
GET /pregame/{game_id}
GET /halftime/{game_id}
GET /injuries/{game_id}
GET /markets/{game_id}
```

FastAPI is a reasonable option.

### 24. UI/dashboard
Build a dashboard showing:
- today's games
- injuries
- projected minutes
- player impact
- basketball-only prediction
- market prediction
- halftime update
- model vs market disagreement
- model history/calibration

### 25. Deployment
Containerize and deploy:
- PostgreSQL
- collectors
- scheduled jobs
- model inference
- dashboard/API

Add observability and restart-safe jobs.

## Research questions to revisit

- Does detailed H1 box-score information materially beat score + time + pregame prior?
- Which Four Factors are actually persistent from H1 to H2?
- How much does explicit shooting-regression modeling help?
- Does projected H2 lineup strength materially improve H2 margin MAE?
- How much incremental value do injuries add once closing market lines are known?
- Does the basketball-only model identify systematic market disagreement?
- Are model edges stable by season, team, price range, and market type?
- Is the edge still present after vig and realistic execution assumptions?

## Rule for future work

Do not add complexity because it sounds sophisticated.

Every new layer must beat the simpler walk-forward baseline on out-of-sample metrics or provide a clear operational benefit.

## Implementation coverage notes

The NBA package under `models/nba` preserves the deferred scope above. Historical pregame market evaluation is a V1 data blocker, not a newly deferred requirement: the inspected SBR archive lacks quote-availability timestamps. Current ESPN/Action captures cannot supply historical knowledge times. Strict halftime evaluation also excludes archived first-half events with later edit timestamps; a broader as-received archive would improve coverage without relaxing integrity.

Current approximations are explicitly documented in the NBA README: net-only ridge RAPM, box-score possession estimates, description-derived scoring profiles, prior-minute projected starters and uncalibrated halftime win probabilities. Missing injury-report coverage is flagged, and uncertain status probabilities use a neutral prior until enough point-in-time matched outcomes exist. These limitations must remain visible in evaluation reports.
