"""DELIBERATE FAILURE — red-first proof for CI_TRUTH_RESTORATION_001 / F1.

This file exists for exactly one commit on the `ci-truth/<repo>` branch. Its only
job is to make the new `tests` check go RED on a real pull request, so that the
claim "pytest is now an enforced gate" rests on an observation rather than on an
assumption. The very next commit on this branch deletes this file, and the same
check is then captured GREEN.

A gate that has never been seen blocking is not a repaired gate. Both the red
capture and the green capture are saved as `gh api` JSON under
GovernedStudioReset/CI_TRUTH_RESTORATION_001/evidence/<repo>/.
"""


def test_RED_FIRST_PROOF_deliberate_failure():
    assert False, (
        "CI_TRUTH_RESTORATION_001 red-first proof: this failure is intentional. "
        "It demonstrates that the `tests` check actually runs pytest on a pull "
        "request and actually reports red. The next commit on this branch removes "
        "this file and the same check is captured green."
    )
