# Issue authoring guide

Issues should make both the product question and the implementation boundary clear. Use the sections below when they apply.

## Recommended structure

```markdown
## Hypothesis

What do we currently believe, and what user behavior would support it?

## Purpose

What question or problem does this experiment address?

## Scope

What is included in this Issue?

## Out of scope

What must not change as part of this Issue?

## Acceptance criteria

What observable result means the implementation is complete?

## Automated validation

What local commands or checks should Codex run?

## Human experience checks

What must a human try or judge locally?

## Learning / follow-up

Where should the keep, revise, or reject result be recorded?
```

Not every Issue needs every section. UX-bearing or hypothesis-testing Issues should include all applicable sections, especially the human experience checks.

## Keep three kinds of statements separate

- **Stable product constraints** are decisions that should remain true unless deliberately changed.
- **Current hypotheses** are beliefs being tested and may be kept, revised, or rejected.
- **Implementation details** describe how the current experiment is built and may change without changing the hypothesis.

Agents must not treat a hypothesis as a permanent product requirement, accept or reject it on their own, or materially rewrite it. If the requested implementation requires a product decision, stop and report it.

## Make validation actionable

Name local commands and expected results for automated validation. Describe human checks in observable terms, such as the path to try, the question to answer, and any notable discomfort or confusion to look for. Automated verification is technical evidence; it is not a substitute for human experience review.

Prefer local validation. Mention external services or network access only when they are genuinely required by the experiment. Do not make AWS a prerequisite for ordinary local UX testing.
