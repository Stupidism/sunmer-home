// @ts-check

/**
 * Upsert a Vercel preview status comment on a PR.
 *
 * Reads the result JSON file for the current app, merges it with
 * existing state from a previous comment, and posts/updates the
 * status table.
 *
 * @param {object} params
 * @param {ReturnType<typeof import('@actions/github').getOctokit>} params.github
 * @param {typeof import('@actions/github').context} params.context
 * @param {typeof import('@actions/core')} params.core
 */
export async function upsertPreviewComment({ github, context, core }) {
  const fs = await import('node:fs')

  const marker = '<!-- vercel-pr-preview -->'
  const issue_number = context.issue.number
  const updated = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')
  const allProjects = JSON.parse(process.env.ALL_PROJECTS_JSON || '[]')
  const affectedProjects = JSON.parse(process.env.AFFECTED_JSON || '[]')
  const affectedSet = new Set(affectedProjects.map((item) => item.appId))

  let result = {
    appId: process.env.APP_ID,
    appName: process.env.APP_ID,
    status: 'failed',
    reason: 'missing-result-file',
    runUrl: process.env.RUN_URL,
    headSha: process.env.HEAD_SHA,
  }

  try {
    const raw = fs.readFileSync(process.env.RESULT_FILE, 'utf8')
    result = JSON.parse(raw)
  } catch (error) {
    core.warning(`Failed to read preview result for ${process.env.APP_ID}: ${error}`)
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number,
    per_page: 100,
  })

  const existing = comments.find((comment) => comment.body && comment.body.includes(marker))

  let existingState = {}
  if (existing?.body) {
    const match = existing.body.match(/<!-- vercel-pr-preview-state ([\s\S]*?) -->/)
    if (match?.[1]) {
      try {
        existingState = JSON.parse(match[1])
      } catch (error) {
        core.warning(`Failed to parse existing preview state: ${error}`)
      }
    }
  }

  const nextState = {}
  for (const project of allProjects) {
    if (affectedSet.has(project.appId)) {
      nextState[project.appId] = {
        appId: project.appId,
        appName: project.appName,
        status: 'running',
        reason: 'waiting-for-result',
        runUrl: process.env.RUN_URL,
      }
    } else {
      nextState[project.appId] = {
        appId: project.appId,
        appName: project.appName,
        status: 'skipped',
        reason: 'not-affected',
      }
    }
  }

  for (const [appId, state] of Object.entries(existingState)) {
    if (nextState[appId]) {
      nextState[appId] = { ...nextState[appId], ...state }
    }
  }

  nextState[result.appId] = { ...nextState[result.appId], ...result }

  const toRow = (project) => {
    const item = nextState[project.appId] || {
      appId: project.appId,
      appName: project.appName,
      status: 'skipped',
      reason: 'not-affected',
    }
    const status = item.status || 'failed'
    const icon =
      status === 'ready'
        ? '![Ready](https://vercel.com/static/status/ready.svg)'
        : status === 'failed'
          ? '![Error](https://vercel.com/static/status/error.svg)'
          : status === 'running'
            ? '![Building](https://vercel.com/static/status/building.svg)'
            : '![Skipped](https://vercel.com/static/status/canceled.svg)'
    const statusLabel =
      status === 'ready' ? 'Ready' : status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : 'Skipped'

    const actions = []
    if (item.previewUrl) {
      actions.push(`[Preview](${item.previewUrl})`)
    }
    if (item.buildUrl) {
      actions.push(`[Build](${item.buildUrl})`)
    }
    if (status === 'failed') {
      actions.push(`[Logs](${item.runUrl || process.env.RUN_URL})`)
    }

    return `| ${project.appName} | ${icon} ${statusLabel} | ${actions.join(', ') || '-'} | ${updated} |`
  }

  const body = [
    marker,
    `<!-- vercel-pr-preview-state ${JSON.stringify(nextState)} -->`,
    '### Vercel Preview',
    '',
    '| Project | Deployment | Actions | Updated (UTC) |',
    '| :--- | :----- | :------ | :------ |',
    ...allProjects.map(toRow),
    '',
    '_This preview is recreated on new commits and managed by Vercel._',
  ].join('\n')

  if (existing) {
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existing.id,
      body,
    })
  } else {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number,
      body,
    })
  }
}
