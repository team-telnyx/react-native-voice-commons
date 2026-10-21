#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
FIXTURE=$(mktemp -d)
trap 'rm -rf "$FIXTURE"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file=$1 expected=$2
  grep -qF -- "$expected" "$file" || fail "$file does not contain: $expected"
}

assert_not_contains() {
  local file=$1 unexpected=$2
  if grep -qF -- "$unexpected" "$file"; then
    fail "$file unexpectedly contains: $unexpected"
  fi
}

mkdir -p "$FIXTURE/scripts/release" "$FIXTURE/package" "$FIXTURE/react-voice-commons-sdk"
cp "$ROOT/scripts/release/release_package.sh" "$FIXTURE/scripts/release/release_package.sh"

for dir in package react-voice-commons-sdk; do
  printf '{"version":"1.2.3"}\n' >"$FIXTURE/$dir/package.json"
  cat >"$FIXTURE/$dir/CHANGELOG.md" <<'EOF'
# CHANGELOG.md

## Unreleased

### Enhancement

- Preserve this maintainer-written note.

## [1.2.3] (2026-01-01)

### Bug Fixing

- Keep the previous release.
EOF
done

git -C "$FIXTURE" init -q
git -C "$FIXTURE" config user.name 'Release Test'
git -C "$FIXTURE" config user.email 'release-test@example.com'
git -C "$FIXTURE" add .
git -C "$FIXTURE" commit -qm 'test fixture'

cat >"$FIXTURE/draft.md" <<'EOF'
Here is the CHANGELOG section you requested:

```markdown
## [9.9.9]
### Enhancement

- Preserve this maintainer-written note.
- Add a generated enhancement.
```
EOF

cd "$FIXTURE"

unreleased=$(scripts/release/release_package.sh unreleased-notes voice-sdk)
[[ "$unreleased" == *"Preserve this maintainer-written note."* ]] \
  || fail "unreleased-notes omitted the source note"
[[ "$unreleased" != *"Keep the previous release."* ]] \
  || fail "unreleased-notes included a previous release"

for pkg in voice-sdk commons-sdk; do
  case "$pkg" in
    voice-sdk) dir=package ;;
    commons-sdk) dir=react-voice-commons-sdk ;;
  esac

  cp draft.md "$pkg-draft.md"
  scripts/release/release_package.sh insert-draft "$pkg" 1.2.4 "$pkg-draft.md"
  scripts/release/release_package.sh bump "$pkg" 1.2.4

  assert_contains "$dir/CHANGELOG.md" "## [1.2.4]"
  assert_contains "$dir/CHANGELOG.md" "<!-- AI-DRAFT:"
  assert_contains "$dir/CHANGELOG.md" "- Add a generated enhancement."
  assert_contains "$dir/CHANGELOG.md" "- Keep the previous release."
  assert_not_contains "$dir/CHANGELOG.md" "Here is the CHANGELOG section"
  assert_not_contains "$dir/CHANGELOG.md" "## Unreleased"
  assert_not_contains "$dir/CHANGELOG.md" "## [9.9.9]"
  assert_not_contains "$dir/CHANGELOG.md" '```'

  if scripts/release/release_package.sh check "$pkg" 1.2.4 >/dev/null 2>&1; then
    fail "check accepted an unreviewed $pkg draft"
  fi
  sed -i.bak '/<!-- AI-DRAFT:/d' "$dir/CHANGELOG.md"
  rm -f "$dir/CHANGELOG.md.bak"
  scripts/release/release_package.sh check "$pkg" 1.2.4
done

cat >draft-with-fenced-fragment.md <<'EOF'
### Enhancement

- Keep this generated enhancement.

```markdown
### Bug Fixing

- Do not publish this fenced fragment.
```

### Bug Fixing

- Keep this generated bug fix.
EOF
scripts/release/release_package.sh insert-draft voice-sdk 1.2.5 draft-with-fenced-fragment.md
assert_contains package/CHANGELOG.md "- Keep this generated enhancement."
assert_contains package/CHANGELOG.md "- Keep this generated bug fix."
assert_not_contains package/CHANGELOG.md "- Do not publish this fenced fragment."

mkdir -p test-bin
cat >test-bin/gh <<'EOF'
#!/usr/bin/env bash
node -e '
  const oid = process.env.MOCK_MERGE_COMMIT;
  const prs = Array.from({length: 100}, (_, index) => ({
    number: index + 1,
    title: `Large release note ${index + 1}`,
    body: "x".repeat(2000),
    mergeCommit: {oid},
    files: [{path: "package/lib/call.ts"}],
  }));
  process.stdout.write(JSON.stringify(prs));
'
EOF
chmod +x test-bin/gh
MOCK_MERGE_COMMIT=$(git rev-parse HEAD)
export MOCK_MERGE_COMMIT
if PATH="$FIXTURE/test-bin:$PATH" scripts/release/release_package.sh \
  draft-prompt voice-sdk 1.2.6 '' oversized-prompt.txt >/dev/null 2>&1; then
  fail "draft-prompt accepted input larger than its byte limit"
fi
[[ ! -e oversized-prompt.txt ]] \
  || fail "draft-prompt left an oversized prompt for the Codex action to consume"

printf 'Conversational response without a section or bullet.\n' >invalid-draft.md
cp package/CHANGELOG.md changelog-before-invalid.md
if scripts/release/release_package.sh insert-draft voice-sdk 1.2.6 invalid-draft.md >/dev/null 2>&1; then
  fail "insert-draft accepted a response without a section or bullet"
fi
cmp -s package/CHANGELOG.md changelog-before-invalid.md \
  || fail "insert-draft changed the CHANGELOG after rejecting an invalid response"

echo "Release script tests passed"
