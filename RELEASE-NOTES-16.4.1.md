# Resequiz 16.4.1 — Test hardening

Patch release for the Admin Statistics release.

- Regression tests no longer hard-code 16.3.0.
- Tests derive the expected application version from `app/package.json`.
- Server/package version consistency is verified explicitly.
- This prevents valid patch/minor releases from failing only because the version number changed.
- No question-bank content or gameplay behavior was changed by this patch.
