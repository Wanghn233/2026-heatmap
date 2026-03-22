#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3000"
BEARER_TOKEN="pigworm"
API_PATH="/api/weight"

post_weight() {
  local weight_kg="$1"
  local impedance="$2"

  curl --silent --show-error --fail \
    -X POST "${BASE_URL}${API_PATH}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BEARER_TOKEN}" \
    -d "{\"weightKg\":${weight_kg},\"impedance\":${impedance}}"
}

echo "Posting mock weight records to ${BASE_URL}${API_PATH}"

post_weight 67.8 512
post_weight 67.2 506
post_weight 66.9 503
post_weight 64.8 488
post_weight 64.5 485
post_weight 63.9 482
post_weight 68.1 514
post_weight 64.2 487

echo
echo "Done."
