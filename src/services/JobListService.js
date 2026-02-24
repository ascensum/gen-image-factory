/**
 * JobListService - Job list/count with filters and "Has pending reruns" (Epic 3 layered architecture)
 *
 * Responsibility: Apply hasPendingRetries filter (via BulkRerunService), call persistence layer,
 * enrich results with pendingJobs. No direct use of global.bulkRerunQueue; adapter stays thin.
 *
 * ADR-001: < 400 lines. ADR-003: DI only.
 * Story 3.1 / 3.2 gap: "Has pending reruns" filter implemented in service, not adapter.
 */

class JobListService {
  /**
   * @param {Object} deps - Injected dependencies
   * @param {Function} deps.fetchJobExecutionsWithFilters - (filters, page, pageSize) => Promise<{ success, jobs?, executions?, ... }>
   * @param {Function} deps.fetchJobExecutionsCount - (filters) => Promise<{ success, count }>
   * @param {Function} deps.getPendingRerunExecutionIds - () => string[]|number[] (from BulkRerunService)
   */
  constructor(deps) {
    this._fetchList = deps.fetchJobExecutionsWithFilters;
    this._fetchCount = deps.fetchJobExecutionsCount;
    this._getPendingRerunExecutionIds = deps.getPendingRerunExecutionIds;
  }

  /**
   * Get job executions with filters. Applies "Has pending reruns" and enriches with pendingJobs.
   * @param {Object} filters - Filter criteria (may include hasPendingRetries)
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Page size
   * @returns {Promise<{ success: boolean, jobs: Array, error?: string }>}
   */
  async getJobExecutionsWithFilters(filters, page = 1, pageSize = 25) {
    const effectiveFilters = { ...filters };

    if (effectiveFilters.hasPendingRetries) {
      const pendingIds = this._getPendingRerunExecutionIds();
      if (!pendingIds || pendingIds.length === 0) {
        return { success: true, jobs: [] };
      }
      effectiveFilters.ids = pendingIds;
    }

    const result = await this._fetchList(effectiveFilters, page, pageSize);
    if (!result.success) {
      return result;
    }

    const jobs = result.jobs ?? result.executions ?? [];
    const pendingSet = new Set((this._getPendingRerunExecutionIds() || []).map(String));

    const enrichedJobs = Array.isArray(jobs)
      ? jobs.map(job => ({
          ...job,
          pendingJobs: pendingSet.has(String(job.id)) ? 1 : 0
        }))
      : [];

    // Frontend may read result.executions first; both must be enriched so "Has pending reruns" filter shows jobs
    return {
      ...result,
      jobs: enrichedJobs,
      executions: enrichedJobs
    };
  }

  /**
   * Get count of job executions matching filters. Applies "Has pending reruns".
   * @param {Object} filters - Filter criteria
   * @returns {Promise<{ success: boolean, count: number, error?: string }>}
   */
  async getJobExecutionsCount(filters) {
    const effectiveFilters = { ...filters };

    if (effectiveFilters.hasPendingRetries) {
      const pendingIds = this._getPendingRerunExecutionIds();
      if (!pendingIds || pendingIds.length === 0) {
        return { success: true, count: 0 };
      }
      effectiveFilters.ids = pendingIds;
    }

    return this._fetchCount(effectiveFilters);
  }
}

module.exports = { JobListService };
