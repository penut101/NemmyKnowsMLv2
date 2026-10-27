# Third-party notices

The existing web and sports projects derive from the repositories documented in `UPSTREAM.md` and their retained notices. The user reports permission from the original author. This document adds the NBA sources; it does not grant additional rights to upstream material or sports data.

## NBA implementation

| Source | Version used | Use and licensing boundary |
| --- | --- | --- |
| [shufinskiy/nba_data](https://github.com/shufinskiy/nba_data) | `e829d4678be1e075f99e5d41a1c5f97089be446b` | Pinned NBA play-by-play archives. Repository declares Apache-2.0; underlying NBA data rights remain with their owners. No archive committed here. |
| [mxufc29/nbainjuries](https://github.com/mxufc29/nbainjuries) | `57603738fb28185e3c1bf4d71d75af0f85514ac1` | MIT, copyright 2024 mxufc29. Vendored utility/constants/exceptions under `models/nba/src/vendor/nbainjuries`, with the full LICENSE. PDF reader import adapted from PyPDF2 to pypdf. Local extraction and canonical matching wrap the utility. |
| [kyleskom/NBA-Machine-Learning-Sports-Betting](https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting) | `8e36b0b72ecc5082aa8976dff742cdf910b3aa36` | Referenced historical SBR SQLite data and inspected spread convention. No repository license was declared at inspection. No implementation code or database redistributed. |
| [sportsdataverse/sportsdataverse-data](https://github.com/sportsdataverse/sportsdataverse-data) | ESPN NBA player-box release assets, content-hashed locally | Independent score/minute validation fallback. Repository MIT declaration does not license underlying ESPN/NBA sports data. The related hoopR-nba-data repository had no detected license; no blanket data redistribution right is asserted. |
| NBA Stats, NBA CDN and [official injury reports](https://official.nba.com/nba-injury-report-2023-24-season/) | Response bytes and observation metadata retained locally | Public source adapters; NBA marks/data remain the owners' property. Access may be restricted or change. |
| ESPN and Action Network public odds endpoints | Immutable captured response observations | Used as data sources, not copied code. Collection timestamps are preserved. No historical availability timestamps are invented. |

The NBA package depends on NumPy, pandas, SciPy, scikit-learn, SQLAlchemy, Alembic, psycopg, requests, python-dotenv, PyArrow, pdfplumber, pypdf and pytest. Their distributions retain their respective licenses. Generated local data, model artifacts and secrets are excluded from Git. Source pins and stored content hashes support provenance; they do not override provider terms.
