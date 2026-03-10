/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'

// packages
import core from '@actions/core'
import github from '@actions/github'

export default async function ({ octokit, workflow_id, run_id, before }) {
  // get current run of this workflow (retry on transient 500 errors)
  let workflow_runs
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
        ...github.context.repo,
        workflow_id
      })
      workflow_runs = data.workflow_runs
      break
    } catch (error) {
      if (error.status >= 500 && attempt < 3) {
        core.warning(`GitHub API returned ${error.status}, retrying (${attempt}/3)...`)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      } else {
        throw error
      }
    }
  }

  // find any instances of the same workflow
  const waiting_for = workflow_runs
    // limit to currently running ones
    .filter(run => ['in_progress', 'queued', 'waiting', 'pending', 'action_required', 'requested'].includes(run.status))
    // exclude this one
    .filter(run => run.id !== run_id)
    // get older runs
    .filter(run => new Date(run.run_started_at) < before)

  core.info(`found ${waiting_for.length} workflow runs`)
  core.debug(inspect(waiting_for.map(run => ({ id: run.id, name: run.name }))))

  return waiting_for
}
