// @ts-check
/// <reference types="@actions/github-script" />

/**
 * Detect affected projects based on changed files in a PR,
 * and auto-label the PR with `app:<appId>` labels.
 *
 * @param {object} params
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} params.github
 * @param {typeof import('@actions/github').context} params.context
 * @param {typeof import('@actions/core')} params.core
 * @param {string[]} params.extraAffectAll - additional files that affect all projects (e.g. the calling workflow file)
 */
export async function detectAffected({ github, context, core, extraAffectAll = [] }) {
  const fs = await import('node:fs')
  const config = JSON.parse(fs.readFileSync('.github/projects.json', 'utf8'))

  const owner = context.repo.owner
  const repo = context.repo.repo
  const pull_number = context.payload.pull_request.number

  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number,
    per_page: 100,
  })

  const changed = files.map((f) => f.filename)

  const alwaysAffectAll = [...config.alwaysAffectAll, '.github/projects.json', ...extraAffectAll]

  const projects = config.projects.map((p) => ({
    appId: p.appId,
    appName: p.appName,
    appPath: p.appPath,
    neonProjectId: p.neonProjectId,
    projectIdSecret: p.vercelProjectIdSecret,
    triggers: p.triggers,
  }))

  const affectAll = changed.some((file) =>
    alwaysAffectAll.some((target) => file === target || file.startsWith(`${target}/`))
  )

  const affected = projects.filter((project) => {
    if (affectAll) return true
    return changed.some((file) => project.triggers.some((prefix) => file.startsWith(prefix)))
  })

  const unaffected = projects.filter((p) => !affected.some((a) => a.appId === p.appId))

  core.info(`Changed files: ${changed.length}`)
  core.info(`Affect all: ${affectAll}`)
  core.info(`Affected: ${affected.map((p) => p.appId).join(', ') || '(none)'}`)
  core.info(`Unaffected: ${unaffected.map((p) => p.appId).join(', ') || '(none)'}`)

  // Auto-label PR with affected apps
  const desiredLabels = affected.map((p) => `app:${p.appId}`)
  const allAppLabels = projects.map((p) => `app:${p.appId}`)
  const currentLabels = context.payload.pull_request.labels.map((l) => l.name)
  const currentAppLabels = currentLabels.filter((l) => allAppLabels.includes(l))

  const labelsToAdd = desiredLabels.filter((l) => !currentAppLabels.includes(l))
  const labelsToRemove = currentAppLabels.filter((l) => !desiredLabels.includes(l))

  for (const label of labelsToAdd) {
    try {
      await github.rest.issues.addLabels({ owner, repo, issue_number: pull_number, labels: [label] })
    } catch (e) {
      core.warning(`Failed to add label ${label}: ${e.message}`)
    }
  }

  for (const label of labelsToRemove) {
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: pull_number, name: label })
    } catch (e) {
      core.warning(`Failed to remove label ${label}: ${e.message}`)
    }
  }

  return { projects, affected, unaffected }
}
