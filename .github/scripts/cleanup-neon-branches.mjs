// @ts-check

/**
 * Delete Neon preview branches for all projects defined in projects.json.
 *
 * @param {object} params
 * @param {typeof import('@actions/core')} params.core
 * @param {string} params.branchName - The Neon branch name to delete (e.g. "preview/feat/my-feature")
 */
export async function cleanupNeonBranches({ core, branchName }) {
  const fs = await import('node:fs')
  const config = JSON.parse(fs.readFileSync('.github/projects.json', 'utf8'))
  const apiKey = process.env.NEON_API_KEY

  for (const project of config.projects) {
    try {
      const res = await fetch(
        `https://console.neon.tech/api/v2/projects/${project.neonProjectId}/branches?search=${encodeURIComponent(branchName)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      const data = await res.json()
      const branch = data.branches?.find((b) => b.name === branchName)

      if (!branch) {
        core.info(`${project.appId}: no branch '${branchName}', skip`)
        continue
      }

      const delRes = await fetch(
        `https://console.neon.tech/api/v2/projects/${project.neonProjectId}/branches/${branch.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` } }
      )
      core.info(`${project.appId}: deleted '${branchName}' (${delRes.status})`)
    } catch (e) {
      core.warning(`${project.appId}: failed to cleanup — ${e.message}`)
    }
  }
}
