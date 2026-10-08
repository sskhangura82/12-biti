"""Liveness canary for the `tests` workflow — CI_TRUTH_RESTORATION_001 / F1.

This file is the enforcement point's self-test, and it is load-bearing for two
separate reasons.

First, it guarantees the `tests` workflow always collects at least one real test.
A pytest gate that collects zero tests reports a *green* check while enforcing
nothing, and "a gate that is green because it tested nothing" is the exact class
of untruth that OUTSIDER_DEV_REVIEW_001 was adjudicated on. Without this file, a
repository with no other Python tests would show a reassuring green check forever.

Second, it enforces invariants on the workflow itself, so the gate cannot be
quietly hollowed out in a later commit without a pull request going red:

  1. the `tests` workflow file still exists;
  2. it still triggers on `pull_request`;
  3. every `uses:` in it is pinned to a 40-hex commit SHA rather than a mutable
     tag, so an upstream retag cannot change what this gate runs;
  4. no `secrets.*` reference appears inside any `if:` condition -- the Actions
     validator rejects that construct, creates zero jobs, and records the run as
     an ordinary failure, which is how
     governed-builder-harness/.github/workflows/release.yml came to fail 786 of
     786 runs while still looking like an installed release gate.

Deliberately dependency-free: it needs nothing but the standard library, so the
gate does not depend on a package install succeeding in order to have an opinion.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "tests.yml"

# Matched only at the start of a line (after optional indent and list dash) so that
# prose in this file or in the workflow's own comments cannot trip the lint. A token
# scan over raw bytes that counts every occurrence anywhere would false-positive on
# its own documentation.
_USES_LINE = re.compile(r"^\s*-?\s*uses:\s*(\S+)")
_PINNED_USES_LINE = re.compile(r"^\s*-?\s*uses:\s*\S+@[0-9a-f]{40}\s*(#.*)?$")
_IF_LINE = re.compile(r"^\s*-?\s*if:\s*(.+)$")


def _workflow_lines():
    assert WORKFLOW.is_file(), (
        f"the `tests` workflow is missing at {WORKFLOW.relative_to(REPO_ROOT)}; "
        "the pull-request pytest gate has been removed"
    )
    return WORKFLOW.read_text(encoding="utf-8").splitlines()


def test_tests_workflow_exists_and_triggers_on_pull_request():
    lines = _workflow_lines()
    triggers = [ln for ln in lines if re.match(r"^\s{2}pull_request:\s*$", ln)]
    assert triggers, (
        "the `tests` workflow no longer triggers on `pull_request`; it would stop "
        "being a pull-request gate while still appearing to be one"
    )


def test_every_action_is_pinned_to_a_commit_sha():
    lines = _workflow_lines()
    unpinned = [
        ln.strip()
        for ln in lines
        if _USES_LINE.match(ln) and not _PINNED_USES_LINE.match(ln)
    ]
    assert not unpinned, (
        "these `uses:` entries are not pinned to a 40-hex commit SHA, so an "
        f"upstream retag could silently change what this gate runs: {unpinned}"
    )


def test_no_secret_reference_inside_any_if_condition():
    """The defect that made release.yml fail 786/786 runs, as an executable lint.

    `secrets` is not an available context for `jobs.<id>.steps.<id>.if`. A
    workflow that references it there is rejected before any job is created, so
    the run fails without ever executing the checks the file claims to perform.
    Job-level `env:` may read `secrets.*`; an `if:` may then read `env.*`.
    """
    offenders = []
    for ln in _workflow_lines():
        m = _IF_LINE.match(ln)
        if m and "secrets." in m.group(1):
            offenders.append(ln.strip())
    assert not offenders, (
        "`secrets.*` referenced inside an `if:` condition. The Actions validator "
        "rejects this, creates zero jobs, and the gate silently never executes. "
        f"Use a job-level `env:` and test `env.*` in the `if:` instead: {offenders}"
    )
