# Release Guide

This guide is for OhMyC maintainers publishing npm packages or desktop
installers. The npm and desktop release pipelines are independent. Publishing
one does not publish the other.

## Release Types

| Release | Use it for | Trigger | Result |
| --- | --- | --- | --- |
| Desktop draft | Testing desktop installers from a branch | Manually run **Build Desktop App** with `draft` | Creates or updates a draft GitHub Release |
| Desktop official release | Publishing macOS and Windows installers from an immutable version | Create a Git tag, then manually run **Build Desktop App** with `official` | Creates a non-draft GitHub Release with desktop installers |
| Snapshot release | Testing unpublished package changes from a branch | Manually run **Snapshot Release** | Publishes affected public packages to npm with the `snapshot` dist-tag |
| Package release | Publishing stable npm packages | Push to a branch watched by **Release** | Opens or updates a Changesets version PR, then publishes after that PR is merged |

## Release Flow

```text
                         What are you shipping?
                                  |
                   +--------------+--------------+
                   |                             |
              Desktop app                  npm packages
                   |                             |
           Official version?               Stable version?
              /         \                    /         \
            no           yes                no           yes
            |             |                 |             |
     Select branch   Create and push   Push branch +   Merge Changesets
       in Actions    vMAJOR.MINOR.PATCH  Changeset      into a watched
            |             tag                |          release branch
            |             |                    |              |
       Run Build      Run Build          Run Snapshot   Release workflow
       Desktop App    Desktop App          Release      opens version PR
        (draft)        (official)              |              |
            |             |                    |         Review and merge
            |             |                    |          the version PR
            |             |                     |              |
      Draft GitHub   Public GitHub       npm packages   npm packages
        Release        Release          tagged snapshot published as latest
```

The npm and desktop branches do not converge: publishing packages does not
build installers, and publishing installers does not publish packages. Snapshot
and desktop draft releases use mutable branches for testing. Stable package and
official desktop releases add a review or immutable version boundary before
publication.

## Build a Desktop Draft

Use a draft to test installers built from a branch before creating an official
version tag.

1. Push the branch to build.
2. Open **Actions → Build Desktop App → Run workflow**.
3. Select the branch from the **Use workflow from** control.
4. Enter an unused version-shaped value such as `v0.2.0-rc.1` in `tag`.
5. Select `draft` for `release_kind`.
6. Run the workflow.
7. Download and test the generated artifacts from the draft GitHub Release.

Draft builds check out the branch selected in **Use workflow from**. The `tag`
input supplies the bundle version and draft release name; it does not make the
branch immutable.

## Publish an Official Desktop Release

Official desktop builds check out a Git tag, so the tag must exist on the remote
before the workflow starts.

1. Confirm that the release commit is merged and all release-candidate checks
   pass.
2. Choose a new semantic version. Use `vMAJOR.MINOR.PATCH`, for example
   `v0.2.0`.
3. Create an annotated tag on the exact release commit and push it:

   ```bash
   git tag -a v0.2.0 -m "OhMyC v0.2.0"
   git push origin v0.2.0
   ```

4. Open **Actions → Build Desktop App → Run workflow**.
5. Enter the same tag, such as `v0.2.0`, in `tag`.
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

1. Push the branch that contains the implementation and its Changeset.
2. Open **Actions → Snapshot Release → Run workflow**.
3. Enter the exact branch name in `branch`.
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

> [!IMPORTANT]
> The workflow input currently defaults to `main`, but the repository default
> branch is `develop`. Always enter an existing branch explicitly.

## Publish a Stable Package Release

The **Release** workflow uses Changesets to separate versioning from
publication.

1. Merge all intended changes and their Changeset files into a branch watched
   by `.github/workflows/release.yml`.
2. Wait for **Release** to open or update the `chore: update versions` pull
   request.
3. Review the package versions, changelogs, internal dependency updates, and
   lockfile changes in that pull request.
4. Run the release-candidate checks against the version pull request.
5. Merge the version pull request into the same watched branch.
6. Wait for **Release** to build the workspace and publish the versioned public
   packages to npm.
7. Verify each published package and version on npm and install it in a clean
   consumer project.

The workflow watches only:

- `main`
- `master`
- `releases/*`

> [!WARNING]
> The repository default branch is currently `develop`. Merging into `develop`
> does not trigger the stable package workflow. Use an existing watched release
> branch, or update the workflow before relying on `develop` for publication.

The workflow publishes only non-private packages selected by pending
Changesets. The root project and packages with `"private": true` are not
published.
