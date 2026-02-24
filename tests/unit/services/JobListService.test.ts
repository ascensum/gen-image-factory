/**
 * UNIT TEST: JobListService (Story 3.1 / 3.2 gap – "Has pending reruns" Epic 3 layered)
 *
 * Verifies: hasPendingRetries → empty list/count when no ids; ids injected and enrichment applied when queue has ids.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { JobListService } = req('../../../src/services/JobListService.js');

describe('JobListService', () => {
  let fetchList: ReturnType<typeof vi.fn>;
  let fetchCount: ReturnType<typeof vi.fn>;
  let getPendingIds: ReturnType<typeof vi.fn>;
  let service: InstanceType<typeof JobListService>;

  beforeEach(() => {
    fetchList = vi.fn();
    fetchCount = vi.fn();
    getPendingIds = vi.fn();
    service = new JobListService({
      fetchJobExecutionsWithFilters: fetchList,
      fetchJobExecutionsCount: fetchCount,
      getPendingRerunExecutionIds: getPendingIds
    });
  });

  describe('getJobExecutionsWithFilters', () => {
    it('when hasPendingRetries and no pending ids, returns empty jobs without calling fetch', async () => {
      getPendingIds.mockReturnValue([]);

      const res = await service.getJobExecutionsWithFilters({ hasPendingRetries: true }, 1, 25);

      expect(res).toEqual({ success: true, jobs: [] });
      expect(fetchList).not.toHaveBeenCalled();
    });

    it('when hasPendingRetries and pending ids, injects ids and enriches pendingJobs', async () => {
      getPendingIds.mockReturnValue([7, 9]);
      fetchList.mockResolvedValue({
        success: true,
        jobs: [{ id: 7, label: 'a' }, { id: 8, label: 'b' }]
      });

      const res = await service.getJobExecutionsWithFilters({ hasPendingRetries: true }, 1, 25);

      expect(fetchList).toHaveBeenCalledWith(expect.objectContaining({ ids: [7, 9] }), 1, 25);
      expect(res.success).toBe(true);
      expect(res.jobs).toEqual([
        expect.objectContaining({ id: 7, pendingJobs: 1 }),
        expect.objectContaining({ id: 8, pendingJobs: 0 })
      ]);
    });

    it('when no hasPendingRetries, calls fetch with same filters', async () => {
      fetchList.mockResolvedValue({ success: true, jobs: [{ id: 1 }] });

      await service.getJobExecutionsWithFilters({ status: 'completed' }, 2, 10);

      expect(fetchList).toHaveBeenCalledWith({ status: 'completed' }, 2, 10);
    });

    it('normalizes result.executions to jobs and enriches', async () => {
      getPendingIds.mockReturnValue([1]);
      fetchList.mockResolvedValue({ success: true, executions: [{ id: 1, label: 'x' }] });

      const res = await service.getJobExecutionsWithFilters({ hasPendingRetries: true }, 1, 25);

      expect(res.success).toBe(true);
      expect(res.jobs).toEqual([expect.objectContaining({ id: 1, pendingJobs: 1 })]);
    });

    it('passes through fetch failure', async () => {
      fetchList.mockResolvedValue({ success: false, error: 'db error' });

      const res = await service.getJobExecutionsWithFilters({}, 1, 25);

      expect(res.success).toBe(false);
      expect(res.error).toBe('db error');
    });
  });

  describe('getJobExecutionsCount', () => {
    it('when hasPendingRetries and no pending ids, returns count 0 without calling fetch', async () => {
      getPendingIds.mockReturnValue([]);

      const res = await service.getJobExecutionsCount({ hasPendingRetries: true });

      expect(res).toEqual({ success: true, count: 0 });
      expect(fetchCount).not.toHaveBeenCalled();
    });

    it('when hasPendingRetries and pending ids, injects ids and returns fetch result', async () => {
      getPendingIds.mockReturnValue([3, 5]);
      fetchCount.mockResolvedValue({ success: true, count: 2 });

      const res = await service.getJobExecutionsCount({ hasPendingRetries: true });

      expect(fetchCount).toHaveBeenCalledWith(expect.objectContaining({ ids: [3, 5] }));
      expect(res).toEqual({ success: true, count: 2 });
    });
  });
});
