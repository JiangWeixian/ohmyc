# Release Guide

This guide is for OhMyC maintainers publishing npm packages or desktop
installers. The npm and desktop release pipelines are independent. Publishing
one does not publish the other.

## Release Branches

| Branch | Purpose | Publication |
| --- | --- | --- |
| `develop` | Hotfixes and stable releases | Stable npm packages through Changesets; official desktop tags come from this branch |
| `next` | Development and testing for the next version | Manually triggered npm snapshots; select this branch for desktop draft builds |

Target hotfix pull requests at `develop` and next-version work at `next`.
After a hotfix or stable version update lands, merge `develop` back into `next`
so the next version keeps those fixes and version changes. When the next version
is ready for a stable release, merge the intended changes from `next` into
`develop`. CI checks pull requests targeting either branch.

## Release Types

| Release | Use it for | Trigger | Result |
| --- | --- | --- | --- |
| Desktop draft | Testing desktop installers from a branch | Manually run **Build Desktop App** with `draft` (no tag) | Creates or updates that branch's fixed-slot draft GitHub Release |
| Desktop official release | Publishing macOS and Windows installers from an immutable version | Create a Git tag, then manually run **Build Desktop App** with `official` + tag | Creates a non-draft GitHub Release with desktop installers |
| Snapshot release | Testing unpublished package changes from `next` | Manually run **Snapshot Release** | Publishes affected public packages to npm with the `snapshot` dist-tag |
| Package release | Publishing stable npm packages | Push to `develop` | Opens or updates a Changesets version PR, then publishes after that PR is merged |

## Release Flow

1. For the next version, merge implementation changes and Changesets into `next`.
   Run **Snapshot Release** manually to publish npm snapshots. Run **Build Desktop
   App** from `next` with `draft` when desktop installers need testing.
2. For a hotfix or stable version, merge the release changes into `develop`.
   **Release** opens or updates a Changesets version PR. Review and merge that PR
   into `develop` to publish stable npm packages.
3. For official desktop installers, create a version tag on a verified `develop`
   commit, then run **Build Desktop App** with `official` and that tag.

Pushing to `next` runs CI but does not publish a snapshot. npm publishing and
desktop builds remain independent; publishing one does not publish the other.

## Build a Desktop Draft

Use a draft to test installers built from a branch before creating an official
version tag. Drafts use a **per-branch fixed slot**: the same branch always
updates one draft GitHub Release (no version inventing, no draft pile-up on
that branch).

1. Push the branch to build. Use `next` for next-version testing; hotfix branches
   can also produce draft installers for validation.
2. Open **Actions → Build Desktop App → Run workflow**.
3. Select the branch from the **Use workflow from** control.
4. Leave `tag` empty (ignored for draft).
5. Select `draft` for `release_kind`.
6. Run the workflow.
7. Download and test the generated artifacts from that branch's draft GitHub
   Release.

### Draft identity

| Field | Value |
| --- | --- |
| GitHub Release tag | `v0.0.0-draft-{branch-slug}` |
| Release title | `OhMyC draft ({branch})` |
| macOS bundle version | `0.0.0-draft-{branch-slug}` |
| Windows MSI bundle version | `0.0.0-1` (MSI-safe small prerelease id) |

Branch slug rules: lowercase, non `[a-z0-9]` → `-`, collapse repeats, trim,
max 40 characters. Example: `hotfix/geek-design` → tag
`v0.0.0-draft-hotfix-geek-design`.

Draft builds check out the branch selected in **Use workflow from**. Re-running
draft on the same branch overwrites that slot's assets. Different branches get
different slots and do not overwrite each other.

## Publish an Official Desktop Release

Official desktop builds check out a Git tag, so the tag must exist on the remote
before the workflow starts. The build rejects tags whose commits are not
included in the remote `develop` branch.

1. Confirm that the release commit is merged into `develop` and all
   release-candidate checks pass.
2. Choose a new semantic version. Use `vMAJOR.MINOR.PATCH`, for example
   `v0.2.0`.
3. Fetch `develop`, create an annotated tag on the verified release commit, and
   push it. The example uses the latest remote `develop` commit:

   ```bash
   git fetch origin develop
   git tag -a v0.2.0 origin/develop -m "OhMyC v0.2.0"
   git push origin v0.2.0
   ```

4. Open **Actions → Build Desktop App → Run workflow** and select `develop` in
   **Use workflow from**.
5. Enter the same tag, such as `v0.2.0`, in `tag` (required for official).
6. Select `official` for `release_kind`.
7. Run the workflow and wait for both the macOS and Windows jobs to pass.
8. Verify the GitHub Release is public rather than a draft.
9. Download and test the macOS DMG and Windows EXE/MSI installers.
10. Review the release title, notes, version, and attached assets before
    announcing the release.

The workflow derives the desktop bundle version from the tag. A tag containing
`-`, such as `v0.2.0-rc.1`, creates a prerelease. Windows prerelease tags must
contain a numeric identifier no greater than 65535 so the workflow can produce
a valid MSI version.

Do not move or recreate an official release tag after publication. Publish a
new patch version for corrections.

## Prepare a Package Change

Add a Changeset for every change that should publish a public npm package:

```bash
pnpm changeset
```

Select the affected packages and the appropriate semantic version impact, then
commit the generated file under `.changeset/` with the implementation.

Do not add a package release for changes limited to private packages such as
`@ohmyc/ui` or `@ohmyc/desktop`. A Changeset may record a private-only change
with an empty frontmatter block when the repository needs a release note without
publishing a package.

## Publish a Snapshot Package Release

Use a snapshot to test affected public packages without assigning their next
stable versions.

1. Merge the implementation and its Changeset into `next`.
2. Open **Actions → Snapshot Release → Run workflow**.
3. Select `next` in **Use workflow from**. No branch input is needed: the
   workflow always checks out `next`.
4. Run the workflow and wait for the `version` job to finish.
5. Read the workflow log to record the generated snapshot versions.
6. Install the required package with the `snapshot` dist-tag or the exact
   generated version, then verify it in a clean consumer project.

The workflow runs these commands in an ephemeral checkout:

```bash
pnpm ci:snapshot
pnpm ci:prerelease
```

`ci:snapshot` generates versions with the `snapshot` suffix. `ci:prerelease`
builds the workspace and publishes affected public packages with the npm
`snapshot` dist-tag, without creating Git tags.

The source is fixed to `next`, even if the workflow is dispatched from another
ref. Snapshot version changes stay in the runner checkout and are not committed
back to `next`.

The equivalent CLI command is:

```bash
gh workflow run snapshot-release.yml --ref next
```

## Publish a Stable Package Release

The **Release** workflow uses Changesets to separate versioning from
publication.

1. Merge all intended release changes and their Changeset files into `develop`.
2. Wait for **Release** to open or update the `chore: update versions` pull
   request.
3. Review the package versions, changelogs, internal dependency updates, and
   lockfile changes in that pull request.
4. Run the release-candidate checks against the version pull request.
5. Merge the version pull request into `develop`.
6. Wait for **Release** to build the workspace and publish the versioned public
   packages to npm.
7. Verify each published package and version on npm and install it in a clean
   consumer project.

The workflow watches only pushes to `develop`. `next`, `main`, `master`, and
`releases/*` do not trigger stable package publication. Changesets uses
`develop` as its comparison base.

The workflow publishes only non-private packages selected by pending
Changesets. The root project and packages with `"private": true` are not
published.
