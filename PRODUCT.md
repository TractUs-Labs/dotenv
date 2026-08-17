# Product

## Register

product

## Users

Developers and engineers on a small internal team (~5-6 people), using this
during their normal work to look up, create, rotate, and share credentials
(API keys, DB passwords, tokens) across projects and environments. They're
technical, comfortable with dense information and keyboard-driven workflows,
and want fast in-and-out interactions — this is a utility they dip into, not
a destination.

## Product Purpose

A lightweight, self-hosted secrets manager scoped to one small team. Create,
edit, rotate, and share credentials organized into projects and environments,
with rule-based per-project/environment access control. Success looks like:
a teammate can find the secret they need, confirm it's current, and copy it
out in seconds, with confidence the tool is genuinely secure (not security
theater) rather than just secure-looking.

## Brand Personality

Precise, minimal, no-nonsense — closer to Doppler/1Password than a consumer
app. CLI-adjacent: dense, fast, terminal-native sensibility rather than
soft/friendly SaaS. Trustworthy through restraint, not through badges or
reassurance copy.

## Anti-references

Generic SaaS dashboard cliches: gradient accent cards, bouncy/elastic motion,
cute illustrations or empty-state mascots, hero-metric stat tiles, tiny
uppercase eyebrows on every section. Also avoid the consumer password-manager
tone (overly soft, friendly, reassuring copy) — this is a tool for engineers,
not a trust-building consumer product.

## Design Principles

- Genuinely secure, not security theater — the UI should never make false
  guarantees or perform trust it hasn't earned (e.g. don't imply e2e
  encryption the system doesn't do).
- Dense and fast over spacious and friendly — respect that users are
  developers mid-task, not browsing.
- Restraint as the trust signal — no decorative flourishes standing in for
  actual security communication.
- Rotation and staleness are first-class states, not afterthoughts — the UI
  should make "this secret is old / rotated / needs attention" visible at a
  glance.
- Keyboard- and screen-reader-usable by default, not bolted on.

## Accessibility & Inclusion

WCAG AA. Respect `prefers-reduced-motion`. No additional specific user needs
flagged.
