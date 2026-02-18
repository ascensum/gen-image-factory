import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import JobHistory from '../../../src/renderer/components/Dashboard/JobHistory';

describe('JobHistory rerun label formatting', () => {
  const noop = () => {};

  it('renders rerun labels as "Parent (Rerun <last6 of id>)"', () => {
    const jobs = [
      {
        id: '123456',
        status: 'completed',
        label: 'Landscape 1 (Rerun)',
        configurationName: 'Landscape 1 (Rerun)',
        displayLabel: 'Landscape 1 (Rerun)',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:05:00Z')
      } as any
    ];

    render(
      <JobHistory
        jobs={jobs as any}
        onJobAction={noop}
        isLoading={false}
        statusFilter="all"
        sortBy="newest"
      />
    );

    // getJobLabel uses last 6 chars of id (JobHistoryListItem.tsx)
    expect(screen.getByText(/Landscape 1 \(Rerun 123456\)/)).toBeInTheDocument();
  });

  it('leaves non-rerun labels unchanged', () => {
    const jobs = [
      {
        id: '999001',
        status: 'completed',
        label: 'Portrait 2',
        configurationName: 'Portrait 2',
        displayLabel: 'Portrait 2',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:05:00Z')
      } as any
    ];

    render(
      <JobHistory
        jobs={jobs as any}
        onJobAction={noop}
        isLoading={false}
        statusFilter="all"
        sortBy="newest"
      />
    );

    expect(screen.getByText('Portrait 2')).toBeInTheDocument();
  });

  it('renders job_<timestamp> when job has no label but has startedAt (e.g. running rerun)', () => {
    const jobs = [
      {
        id: 'no-label',
        status: 'completed',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:05:00Z')
      } as any
    ];

    render(
      <JobHistory
        jobs={jobs as any}
        onJobAction={noop}
        isLoading={false}
        statusFilter="all"
        sortBy="newest"
      />
    );

    expect(screen.getByText(/^job_\d{8}_\d{6}$/)).toBeInTheDocument();
  });

  it('renders job_<timestamp> when label is literal "undefined" but startedAt is present', () => {
    const jobs = [
      {
        id: 'bad',
        status: 'completed',
        label: 'undefined',
        displayLabel: 'undefined',
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:05:00Z')
      } as any
    ];

    render(
      <JobHistory
        jobs={jobs as any}
        onJobAction={noop}
        isLoading={false}
        statusFilter="all"
        sortBy="newest"
      />
    );

    expect(screen.getByText(/^job_\d{8}_\d{6}$/)).toBeInTheDocument();
  });
});


