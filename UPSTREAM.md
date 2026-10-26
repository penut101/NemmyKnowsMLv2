# Source provenance

Imported on 2026-10-26. The owner requested this fork and states René Núñez granted permission to reuse the interface and methodology. Existing author metadata and license notices remain intact; no new license is imposed on upstream work.

| Component | Repository | Imported commit |
| --- | --- | --- |
| Website | https://github.com/renenunezg/momentumweb | 7444f75d5a8409dfd8589cea20309dcce0779c11 |
| MLB | https://github.com/renenunezg/mlbmodel | 8e4cd5e3469ab2fe8e557a0a660efde7a28c749d |
| NFL | https://github.com/renenunezg/momentumnfl | 9b7cc9eabb57aab58d9ac338eded57314a452b71 |
| CFB | https://github.com/renenunezg/momentumcfb | 9eb5e16b1bf75fe56488b309371bae542c158a26 |
| NHL | https://github.com/renenunezg/momentumnhl | 830edd745d8419e7cb78678950001388f99b1f27 |

The frontend Git history is retained. Models use `git subtree add --squash`, preserving every tracked file and recording the original commit. This is a combined repository rather than a GitHub fork-network relationship: one repository cannot be a native fork of five repositories, and the requested destination is private.

Fork adaptations cover identity, contacts, article attribution, optional analytics configuration, database-unavailable behavior, callback destination, and monorepo CI. The four model implementations remain unchanged.

For updates, compare changes first. Use `git subtree pull --prefix=models/<sport> <upstream-url> <branch> --squash` for a model. Fetch frontend changes from `upstream` and review before merging. Check database migrations, artifacts, and contract tests for compatibility.
