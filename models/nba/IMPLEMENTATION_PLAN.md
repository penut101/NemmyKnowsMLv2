# NBA V1 implementation checklist

Authoritative requirements: NBA_AGENT_PROMPT_ASTRA_MEDIUM.md supplied by the user; deferred work: root FUTURE_DEVELOPMENT.md.

- [x] Inspect repository and read both specifications in full.
- [x] Build isolated Python package, configuration, migrations, immutable raw storage, and source receipts.
- [x] Pin public sources; implement resumable NBA/archive, injury, and market adapters with explicit availability timestamps.
- [x] Normalize canonical identities, validate scores, reconstruct/validate regulation rotations, quarantine corrupt games.
- [x] Build prior-only team ratings, net RAPM, projected pregame/H2 minutes, and availability features.
- [x] Build basketball-only and market-aware pregame datasets; create Q1/Q2-only halftime features and regulation H2 targets.
- [ ] Run season walk-forward models, nested out-of-fold priors, ablations, and closing-market comparisons where timestamped coverage permits.
- [ ] Run leakage/contract/integration tests, real-data ingestion and evaluation, and report actual coverage/blockers.
- [x] Update README, THIRD_PARTY_NOTICES, FUTURE_DEVELOPMENT, and reproduction commands.

Implemented does not mean all coverage requirements are satisfied. Remaining verification includes the expanded real-data rebuild, strict halftime coverage, PostgreSQL CI and a final metrics report. Historical market-aware evaluation remains blocked by absent quote-availability timestamps. No source timestamps will be invented to check that box.

Decisions: add models/nba without modifying other sports. Use PostgreSQL in Compose/CI and SQLite for portable local execution. Public historical event streams are retrospective reconstructions, not certified live-receipt histories. Injury/market snapshots without evidence of availability at cutoff are excluded from strict evaluation. Never synthesize historical injury or market timestamps. Keep advanced groups out of selected models unless earlier walk-forward validation supports them.
