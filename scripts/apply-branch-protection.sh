#!/usr/bin/env bash
# Requires: gh auth as a user with Admin on Nathandavid01/social-dashboard
set -euo pipefail
REPO="${REPO:-Nathandavid01/social-dashboard}"
BRANCH="${BRANCH:-main}"

echo "Applying hard branch protection on $REPO:$BRANCH …"

gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "merge-gate",
      "test",
      "Static embed guard + unit tests"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_linear_history": false,
  "allow_squash_merge": true
}
JSON

echo "Done. Verify: gh api repos/$REPO/branches/$BRANCH/protection"
echo "If contexts names differ, copy exact check names from a green PR and re-run."
