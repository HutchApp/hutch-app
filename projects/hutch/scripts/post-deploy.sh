#!/bin/bash
set -euo pipefail

STACK="${PULUMI_STACK:?PULUMI_STACK is not set}"

RAW_URL=$(pulumi stack output apiUrl --stack "$STACK")
# Strip /$default suffix that API Gateway appends to the URL
URL="${RAW_URL%/\$default}"
echo "Verifying $STACK deployment at: $URL"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL/embed"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL/embed/icon.svg"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL/embed/health"

if [ "$STACK" = "staging" ]; then
  npx playwright install --with-deps chromium
  STAGING_URL="$URL" pnpm test:e2e:staging
else
  echo "No post-deploy E2E tests for $STACK — skipping"
fi
