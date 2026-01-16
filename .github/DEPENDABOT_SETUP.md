# Dependabot Auto-Merge Setup

Dependabot is configured to automatically create PRs for dependency updates. Auto-approval and auto-merge are handled automatically via GitHub Actions workflow.

## Automatic Auto-Approval (Already Configured)

The `.github/workflows/dependabot-auto-merge.yml` workflow automatically:
- ✅ Enables auto-merge with squash strategy for minor/patch updates
- ✅ Skips major version updates (requires manual review)

**Requirements**:
- Repository must have "Allow auto-merge" enabled in **Settings** → **General** → **Pull Requests**
- Branch protection rules must allow auto-merge (if enabled)

## Manual Setup (If Needed)

If you need to configure auto-merge manually:

### Option 1: GitHub Auto-Merge

1. Go to your repository **Settings** → **General** → **Pull Requests**
2. Enable **"Allow auto-merge"**
3. Dependabot PRs will auto-merge once CI passes

### Option 2: GitHub App

Install a GitHub App like:
- **Dependabot Auto-merge** (by dependabot)
- **Mergify** (more advanced, supports rules)

## Current Configuration

- **Update Frequency**: Weekly (Mondays at 9:00 AM)
- **PR Limit**: 10 open PRs at a time
- **Grouping**: Minor and patch updates are grouped together
- **Labels**: `dependencies`, `automated`

## Safety

- ✅ CI tests run on all Dependabot PRs to catch breakages
- ✅ Releases are tag-based, so broken code won't auto-release
- ✅ You can review PRs before they merge (auto-merge is optional)
- ✅ Major version updates are NOT auto-merged (manual review required)

## Manual Override

To disable auto-merge for a specific PR, just comment on the PR or close it.

