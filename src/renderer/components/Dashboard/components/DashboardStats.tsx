import React from 'react';
import type { JobStatistics } from '../hooks/useDashboardState';

interface DashboardStatsProps {
  statistics: JobStatistics;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ statistics }) => {
  return (
    <div className="flex items-center flex-wrap gap-x-6 gap-y-2 justify-end ml-auto">
      <div className="text-sm whitespace-nowrap">
        <span className="text-gray-600">Total Jobs:</span>
        <span className="ml-1 font-semibold text-blue-600">{statistics.totalJobs}</span>
      </div>
      <div className="text-sm whitespace-nowrap">
        <span className="text-gray-600">Success Rate:</span>
        <span className="ml-1 font-semibold text-green-600">{statistics.successRate}%</span>
      </div>
      <div className="text-sm whitespace-nowrap">
        <span className="text-gray-600">Images Generated:</span>
        <span className="ml-1 font-semibold text-purple-600">{statistics.totalImagesGenerated}</span>
      </div>
      <div className="text-sm whitespace-nowrap">
        <span className="text-gray-600">Avg Duration:</span>
        <span className="ml-1 font-semibold text-orange-600">{statistics.averageExecutionTime}s</span>
      </div>
    </div>
  );
};

export default DashboardStats;
