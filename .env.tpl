# ──────────────────────────────────────────────────────────────────────────────
# 1Password secret-reference template  (SAFE TO COMMIT — contains no secrets)
#
# Each value is an `op://VAULT/ITEM/FIELD` reference. At runtime, `op run`
# resolves them into the process environment — nothing is ever written to disk.
#
#   Run dev:   npm run dev:op       (= op run --env-file=.env.tpl -- next dev)
#   One-off:   op run --env-file=.env.tpl -- <command>
#
# Convention: all secrets live in ONE item named `social-dashboard`.
# Change the vault name below if yours differs (default assumed: "Development").
# ──────────────────────────────────────────────────────────────────────────────

# ── Supabase (REQUIRED to boot) ───────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=op://Development/social-dashboard/NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=op://Development/social-dashboard/NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=op://Development/social-dashboard/SUPABASE_SERVICE_ROLE_KEY

# ── Anthropic (AI chat) ───────────────────────────────────────────────────────
ANTHROPIC_API_KEY=op://Development/social-dashboard/ANTHROPIC_API_KEY

# ── Metricool (analytics) ─────────────────────────────────────────────────────
METRICOOL_TOKEN=op://Development/social-dashboard/METRICOOL_TOKEN
METRICOOL_USER_ID=op://Development/social-dashboard/METRICOOL_USER_ID
METRICOOL_BLOG_ID=op://Development/social-dashboard/METRICOOL_BLOG_ID
NEXT_PUBLIC_METRICOOL_TOKEN=op://Development/social-dashboard/METRICOOL_TOKEN
NEXT_PUBLIC_METRICOOL_USER_ID=op://Development/social-dashboard/METRICOOL_USER_ID
NEXT_PUBLIC_METRICOOL_BLOG_ID=op://Development/social-dashboard/METRICOOL_BLOG_ID

# ── Cloudflare R2 (video storage) ─────────────────────────────────────────────
R2_ACCOUNT_ID=op://Development/social-dashboard/R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=op://Development/social-dashboard/R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=op://Development/social-dashboard/R2_SECRET_ACCESS_KEY
R2_BUCKET=op://Development/social-dashboard/R2_BUCKET
R2_PUBLIC_BASE_URL=op://Development/social-dashboard/R2_PUBLIC_BASE_URL

# ── Twilio (SMS to owner) ─────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=op://Development/social-dashboard/TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=op://Development/social-dashboard/TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER=op://Development/social-dashboard/TWILIO_FROM_NUMBER
TWILIO_MESSAGING_SERVICE_SID=op://Development/social-dashboard/TWILIO_MESSAGING_SERVICE_SID

# ── Google Drive (raw/edited video links) ─────────────────────────────────────
GOOGLE_OAUTH_CLIENT_ID=op://Development/social-dashboard/GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=op://Development/social-dashboard/GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_SERVICE_ACCOUNT_EMAIL=op://Development/social-dashboard/GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_KEY=op://Development/social-dashboard/GOOGLE_SERVICE_ACCOUNT_KEY
GDRIVE_ROOT_FOLDER_ID=op://Development/social-dashboard/GDRIVE_ROOT_FOLDER_ID

# ── ClickUp (optional — Video Queue integration) ──────────────────────────────
CLICKUP_API_TOKEN=op://Development/social-dashboard/CLICKUP_API_TOKEN
CLICKUP_WEBHOOK_SECRET=op://Development/social-dashboard/CLICKUP_WEBHOOK_SECRET
