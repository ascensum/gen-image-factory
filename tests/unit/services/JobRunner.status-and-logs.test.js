import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/producePictureModule', () => ({ producePictureModule: vi.fn() }));
vi.mock('../../../src/paramsGeneratorModule', () => ({}));
vi.mock('../../../src/aiVision', () => ({}));

const { JobRunner } = require('../../../src/services/jobRunner');

describe('JobRunner - status/progress/logs helpers', () => {
  let runner;
  let prevGlobalRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    prevGlobalRunner = global.currentJobRunner;
    runner = new JobRunner();
  });

  afterEach(() => {
    global.currentJobRunner = prevGlobalRunner;
  });

  it('calculateProgress accounts for completed + current step partial weight', () => {
    // BASE_PROGRESS_STEPS weights are 20 (init) and 80 (image_generation)
    expect(runner.calculateProgress([])).toBe(0);
    expect(runner.calculateProgress(['initialization'])).toBe(20);
    expect(runner.calculateProgress(['initialization'], 'image_generation')).toBe(60); // 20 + 0.5*80
    expect(runner.calculateProgress(['initialization', 'image_generation'])).toBe(100);
  });

  it('getJobStatus returns a shaped payload and uses estimated time helper', () => {
    runner.calculateEstimatedTimeRemaining = vi.fn().mockReturnValue(123);
    runner.jobConfiguration = { parameters: { count: 7 } };
    runner.configurationId = 55;
    runner.databaseExecutionId = 999;
    runner.persistedLabel = 'My Job';
    runner.currentJob = Promise.resolve(); // make currentJob non-null

    runner.jobState.status = 'running';
    runner.jobState.currentStep = 'image_generation';
    runner.jobState.progress = 50;
    runner.jobState.startTime = new Date();
    runner.jobState.gensDone = 2;
    runner.jobState.totalGenerations = 7;

    const s = runner.getJobStatus();
    expect(s.state).toBe('running');
    expect(s.currentJob).toBeTruthy();
    expect(s.currentJob.label).toBe('My Job');
    expect(s.currentJob.configurationId).toBe(55);
    expect(s.currentJob.executionId).toBe(999);
    expect(s.estimatedTimeRemaining).toBe(123);
    expect(runner.calculateEstimatedTimeRemaining).toHaveBeenCalled();
  });

  it('getJobProgress returns stepName and normalized progress', () => {
    runner.calculateEstimatedTimeRemaining = vi.fn().mockReturnValue(null);
    runner.jobState.currentStep = 'initialization';
    runner.jobState.progress = 20;

    const p = runner.getJobProgress();
    expect(p.progress).toBeCloseTo(0.2);
    expect(p.currentStep).toBe(1);
    expect(p.totalSteps).toBe(2);
    expect(typeof p.stepName).toBe('string');
  });

  it('getJobLogs appends jobState.error once and filters debug in standard mode', () => {
    runner._inMemoryLogs = [
      { id: '1', level: 'debug', message: 'd1' },
      { id: '2', level: 'info', message: 'i1' },
    ];

    runner.jobState.error = 'boom';
    const standard = runner.getJobLogs('standard');
    expect(standard.some((l) => l.level === 'debug')).toBe(false);
    expect(standard.some((l) => l.message === 'boom')).toBe(true);

    const standard2 = runner.getJobLogs('standard');
    // should not duplicate the same error message over and over
    const boomCount = standard2.filter((l) => l.message === 'boom').length;
    expect(boomCount).toBe(1);
  });
});

