# Skicast

## Design

Skicast follows Apple's design principles. For any UI work, whether that's building, restyling, animating or reviewing, load the `apple-design` skill first and follow it. It's installed at user level in `~/.claude/skills/apple-design`.

- Keep the existing look. Colour, type and radius tokens live in `src/apple.css` (Cottonwood tokens). Use those tokens and don't invent new values. If a new token is needed, add it there with a comment saying why.
- The layout is phone-first. Design for a phone in one hand, often outdoors and wearing gloves: large touch targets, high contrast and glanceable numbers.
- Motion should be physical and interruptible. Use springs that start from the current value and carry the user's velocity, and respect `prefers-reduced-motion`.
- Show restraint: one screen, no decoration that doesn't carry information. Green, amber and red mean wind band only.

## Branching and releases

Every push or merge to `main` triggers a Netlify production deploy, and each one costs 15 credits. The Free plan has 300 credits a month, and when they run out every project on the account is paused until the next cycle. Deploy previews are free. So `main` changes once per release, never per feature.

### The flow

1. **Cut a release branch from `main`**, named `SkiCast-X.Y.Z` (for example `SkiCast-0.2.0`). Bump `version` in `package.json` to match as the first commit.
2. **Open a draft PR from the release branch into `main` straight away.** Its deploy preview rebuilds on every change and is the release candidate: test it on a phone, outdoors.
3. **Branch feature work off the release branch, and open PRs back into the release branch**, never into `main`. This includes Claude session branches (`claude/...`). Check them locally, then confirm on the release PR's preview.
4. **When the preview is good, merge the release PR into `main`.** That is the one production deploy. Tag the merge commit `vX.Y.Z`.
5. **Cut the next release branch from the new `main`.**

### Rules for Claude

- **Before creating any branch**, find the open release branch (the head of the open draft PR into `main`) and branch from it. If there isn't one, ask the user which version to start, rather than branching from `main`.
- **Before opening a PR**, target the release branch. Never open a PR into `main` except the release PR itself or a hotfix.
- **Before merging anything into `main`, or pushing to it**, stop and remind the user: this triggers a production deploy costing 15 credits, out of 300 a month on the Free plan. Wait for an explicit go-ahead in that conversation. Never push directly to `main`.

### Versioning

Versions are `MAJOR.MINOR.PATCH`. While the major version is `0`, the app is pre-launch.

- **Major (`X.0.0`)**: a change that alters what the app fundamentally is or how people use it, such as a new screen layout, a different data source or region, or dropping a feature. `1.0.0` marks the first version ready for people beyond the developer.
- **Minor (`X.Y.0`)**: a normal release, with new features or visible improvements that don't change the app's basic shape. Most releases are minor.
- **Hotfix (`X.Y.Z`)**: a fix for something broken in production that can't wait for the next release, such as a crash, wrong data or a broken deploy. No features. Keep production's major and minor and bump the patch, so a hotfix to `0.2.0` is `0.2.1`, and a second one is `0.2.2`.

Hotfixes are the one exception to the flow. Branch `SkiCast-X.Y.Z` (production's version with the patch bumped) from `main`, open the PR into `main`, check its preview, and merge it. That's one production deploy, so remind the user of the cost as usual. Then merge `main` into the open release branch so the fix isn't lost, and make sure the release branch's version is still higher than the hotfix's.
