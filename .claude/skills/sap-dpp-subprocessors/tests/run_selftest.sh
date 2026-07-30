#!/usr/bin/env bash
# Proves the validation gate still catches the four classic failure modes.
# Expects: unsourced value, illegal dropdown string, Bucket B leak, missing sign-off.
cd "$(dirname "$0")/.." || exit 1
cp tests/fixtures/example_broken.json data/vendors/
out=$(python3 scripts/validate.py)
rm -f data/vendors/example_broken.json
for pat in "has no source_url" "not an allowed dropdown value" "Bucket B field populated" "needs signed_off_by"; do
  echo "$out" | grep -q "$pat" && echo "PASS: $pat" || echo "FAIL: gate no longer catches '$pat'"
done
