#!/usr/bin/env bash
# Release helpers shared by the release-01, release-03 and release-pr-check workflows.
#
# Packages and their release tags:
#   voice-sdk   -> package/                  -> voice-sdk-vX.Y.Z   (@telnyx/react-native-voice-sdk)
#   commons-sdk -> react-voice-commons-sdk/  -> commons-sdk-vX.Y.Z (@telnyx/react-voice-commons-sdk)
#
# Usage (run from the repository root):
#   release_package.sh plan <voice-sdk-version> <commons-sdk-version>
#       Validate the requested versions (either may be empty, not both) and print
#       key=value lines (also appended to $GITHUB_OUTPUT when set): voice_version,
#       voice_tag, commons_version, commons_tag, tags, branch.
#   release_package.sh parse-branch <branch>
#       Print "<package> <version>" for each release tag in a release/... branch name.
#   release_package.sh ensure-new <package> <version>
#       Fail if the release tag exists or <version> is not newer than package.json.
#   release_package.sh bump <package> <version>
#       Set package.json "version".
#   release_package.sh check <package> <version>
#       Fail unless package.json is <version> and CHANGELOG.md has a non-empty
#       "## [<version>]" section.
#   release_package.sh previous-tag <package>
#       Print the highest stable release tag for <package>, or nothing.
#   release_package.sh pr-notes <package> <previous-tag>
#       Print merged PRs since <previous-tag> that touched <package> (needs GH_TOKEN).
#   release_package.sh notes <package> <version>
#       Print the CHANGELOG.md section for <version>, without its heading.
set -euo pipefail

SEMVER_RE='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'

# Errors go to stderr so they stay visible when stdout is captured or redirected.
# GitHub Actions turns ::error:: lines on either stream into annotations.
fail() {
  echo "::error::$*" >&2
  exit 1
}

require_package() {
  case "$1" in
    voice-sdk | commons-sdk) ;;
    *) fail "Unknown package '$1'; expected voice-sdk or commons-sdk" ;;
  esac
}

package_dir() {
  case "$1" in
    voice-sdk) echo package ;;
    commons-sdk) echo react-voice-commons-sdk ;;
  esac
}

tag_prefix() {
  echo "$1-v"
}

package_version() {
  node -p "require('./$(package_dir "$1")/package.json').version"
}

# Exit 0 when semver $1 has higher precedence than semver $2.
version_gt() {
  node -e '
    const parse = (v) => {
      const i = v.indexOf("-");
      return {
        core: (i < 0 ? v : v.slice(0, i)).split(".").map(Number),
        pre: i < 0 ? null : v.slice(i + 1).split("."),
      };
    };
    const cmpId = (x, y) => {
      const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny) return Number(x) - Number(y);
      if (nx) return -1;
      if (ny) return 1;
      return x < y ? -1 : x > y ? 1 : 0;
    };
    const [a, b] = process.argv.slice(1).map(parse);
    let c = 0;
    for (let i = 0; i < 3 && !c; i++) c = a.core[i] - b.core[i];
    if (!c && (a.pre || b.pre)) {
      if (!a.pre) c = 1;
      else if (!b.pre) c = -1;
      else {
        for (let i = 0; i < Math.max(a.pre.length, b.pre.length) && !c; i++) {
          if (a.pre[i] === undefined) c = -1;
          else if (b.pre[i] === undefined) c = 1;
          else c = cmpId(a.pre[i], b.pre[i]);
        }
      }
    }
    process.exit(c > 0 ? 0 : 1);
  ' "$1" "$2"
}

cmd_plan() {
  local voice="${1#v}" commons="${2#v}"
  [[ -n "$voice" || -n "$commons" ]] || fail "Provide a version for voice-sdk, commons-sdk, or both"

  local tags=()
  if [[ -n "$voice" ]]; then
    [[ "$voice" =~ $SEMVER_RE ]] || fail "Invalid voice-sdk version '$1'; expected semver like 1.2.0"
    tags+=("$(tag_prefix voice-sdk)$voice")
  fi
  if [[ -n "$commons" ]]; then
    [[ "$commons" =~ $SEMVER_RE ]] || fail "Invalid commons-sdk version '$2'; expected semver like 1.2.0"
    tags+=("$(tag_prefix commons-sdk)$commons")
  fi

  local plan
  plan=$(
    echo "voice_version=$voice"
    echo "voice_tag=${voice:+$(tag_prefix voice-sdk)$voice}"
    echo "commons_version=$commons"
    echo "commons_tag=${commons:+$(tag_prefix commons-sdk)$commons}"
    echo "tags=${tags[*]}"
    echo "branch=release/$(IFS=+; echo "${tags[*]}")"
  )
  echo "$plan"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$plan" >>"$GITHUB_OUTPUT"
  fi
}

cmd_parse_branch() {
  local suffix="${1#release/}" part pkg version
  [[ "$suffix" != "$1" ]] || return 0
  IFS=+ read -r -a parts <<<"$suffix"
  for part in "${parts[@]}"; do
    [[ "$part" =~ ^(voice-sdk|commons-sdk)-v(.+)$ ]] || continue
    pkg=${BASH_REMATCH[1]}
    version=${BASH_REMATCH[2]}
    [[ "$version" =~ $SEMVER_RE ]] && echo "$pkg $version"
  done
  return 0
}

cmd_ensure_new() {
  local pkg=$1 version=$2 tag current
  require_package "$pkg"
  tag="$(tag_prefix "$pkg")$version"
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    fail "Tag $tag already exists"
  fi
  current=$(package_version "$pkg")
  version_gt "$version" "$current" || fail "$pkg $version is not newer than current package.json version $current"
}

cmd_bump() {
  local pkg=$1 version=$2 dir
  require_package "$pkg"
  dir=$(package_dir "$pkg")
  npm --prefix "$dir" pkg set version="$version"
  [[ "$(package_version "$pkg")" == "$version" ]] || fail "$dir/package.json version was not updated"
}

# Print the body of the "## [<version>]" section of <dir>/CHANGELOG.md: everything up to
# the next "#" or "##" heading. Fail if the section is missing or has no text.
changelog_section() {
  local dir=$1 version=$2 body
  body=$(awk -v h="## [$version]" '
    capture && /^##? / {exit}
    index($0, h) == 1 {capture=1; next}
    capture {print}
  ' "$dir/CHANGELOG.md")
  grep -q '[^[:space:]]' <<<"$body" \
    || fail "Add release notes under a '## [$version]' heading in $dir/CHANGELOG.md"
  printf '%s\n' "$body"
}

cmd_check() {
  local pkg=$1 version=$2 dir current
  require_package "$pkg"
  dir=$(package_dir "$pkg")
  current=$(package_version "$pkg")
  [[ "$current" == "$version" ]] || fail "$dir/package.json version is $current, expected $version"
  changelog_section "$dir" "$version" >/dev/null
}

cmd_previous_tag() {
  local pkg=$1 prefix
  require_package "$pkg"
  prefix=$(tag_prefix "$pkg")
  git tag --list "${prefix}*" --sort=-v:refname \
    | grep -E "^${prefix}[0-9]+\.[0-9]+\.[0-9]+$" \
    | head -n 1 || true
}

cmd_pr_notes() {
  local pkg=$1 previous=$2 dir commits
  require_package "$pkg"
  dir=$(package_dir "$pkg")
  local range=(HEAD) search=()
  if [[ -n "$previous" ]]; then
    range=("$previous..HEAD")
    search=(--search "merged:>=$(git log -1 --format=%cI "$previous")")
  fi

  commits=$(mktemp)
  git rev-list "${range[@]}" >"$commits"
  gh pr list --state merged --base main --limit 1000 ${search[@]+"${search[@]}"} \
    --json number,title,mergeCommit,files \
    --jq ".[] | select(any(.files[]; .path | startswith(\"$dir/\")))
               | [.mergeCommit.oid, (.number | tostring), .title] | @tsv" \
    | awk -F'\t' 'NR == FNR {in_range[$1] = 1; next} ($1 in in_range) {print "- PR #" $2 ": " $3}' \
      "$commits" -
  rm -f "$commits"
}

cmd_notes() {
  require_package "$1"
  changelog_section "$(package_dir "$1")" "$2"
}

command=${1:-}
[[ -n "$command" ]] || { echo "usage: $0 <command> [args...]; see the header of this script" >&2; exit 1; }
shift
case "$command" in
  plan) cmd_plan "${1:-}" "${2:-}" ;;
  parse-branch) cmd_parse_branch "${1:?branch required}" ;;
  ensure-new) cmd_ensure_new "${1:?package required}" "${2:?version required}" ;;
  bump) cmd_bump "${1:?package required}" "${2:?version required}" ;;
  check) cmd_check "${1:?package required}" "${2:?version required}" ;;
  previous-tag) cmd_previous_tag "${1:?package required}" ;;
  pr-notes) cmd_pr_notes "${1:?package required}" "${2:-}" ;;
  notes) cmd_notes "${1:?package required}" "${2:?version required}" ;;
  *) echo "Unknown command: $command" >&2; exit 1 ;;
esac
