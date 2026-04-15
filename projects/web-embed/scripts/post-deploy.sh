#!/bin/bash
set -euo pipefail

STACK="${PULUMI_STACK:?PULUMI_STACK is not set}"

URL=$(pulumi stack output embedUrl --stack "$STACK")
echo "Verifying $STACK web-embed deployment at: $URL"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL/icon.svg"
curl --fail --silent --show-error --max-time 30 --output /dev/null "$URL/health"
echo "web-embed $STACK smoke test OK"
