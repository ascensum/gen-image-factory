import React from 'react';
import { JobStatus } from './DashboardPanel';

interface ProgressIndicatorProps {
  jobStatus: JobStatus;
  isLoading: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  jobStatus,
  isLoading
}) => {
  const { state, progress, currentStep, totalSteps, startTime, estimatedTimeRemaining } = jobStatus;
  
  const isJobActive = state === 'running' || state === 'starting';
  const progressPercentage = Math.round(progress * 100);
  
  // Calculate time elapsed
  const timeElapsed = startTime ? Math.floor((Date.now() - new Date(startTime).getTime()) / 1000) : 0;
  const timeElapsedFormatted = formatTime(timeElapsed);
  const timeRemainingFormatted = estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : '--:--';

  // Dynamic job steps based on actual backend response
  const jobSteps = React.useMemo(() => {
    // If we have totalSteps from backend, create dynamic steps
    if (totalSteps > 0) {
      const steps = [];
      for (let i = 1; i <= totalSteps; i++) {
        let name, description;
        switch (i) {
          case 1:
            name = 'Initialize';
            description = 'Setting up job configuration';
            break;
          case 2:
            name = 'Generate Images';
            description = 'Creating images with AI models';
            break;
          case 3:
            name = 'Quality Check';
            description = 'Running quality assessment';
            break;
          case 4:
            name = 'Save Results';
            description = 'Storing generated images';
            break;
          case 5:
            name = 'Process Images';
            description = 'Processing and enhancing images';
            break;
          case 6:
            name = 'Finalize';
            description = 'Completing job and cleanup';
            break;
          default:
            name = `Step ${i}`;
            description = `Processing step ${i}`;
        }
        steps.push({ id: i, name, description });
      }
      return steps;
    }
    
    // Fallback to default steps if no totalSteps available
    return [
      { id: 1, name: 'Initialize', description: 'Setting up job configuration' },
      { id: 2, name: 'Generate Images', description: 'Creating images with AI models' },
      { id: 3, name: 'Quality Check', description: 'Running quality assessment' },
      { id: 4, name: 'Save Results', description: 'Storing generated images' }
    ];
  }, [totalSteps]);

  const getStepStatus = (stepId: number) => {
    if (!isJobActive) return 'pending';
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Job Progress</h3>
          <p className="text-sm text-gray-600">
            {state === 'idle' && 'No job in progress'}
            {state === 'starting' && 'Initializing job...'}
            {state === 'running' && `Step ${currentStep} of ${totalSteps}`}
            {state === 'completed' && 'Job completed successfully'}
            {state === 'failed' && 'Job failed'}
            {state === 'stopped' && 'Job stopped'}
          </p>
        </div>
        
        {/* Circular Progress */}
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress)}`}
              className={`transition-all duration-500 ease-out ${
                state === 'completed' ? 'text-green-500' :
                state === 'failed' ? 'text-red-500' :
                state === 'running' || state === 'starting' ? 'text-blue-500' :
                'text-gray-400'
              }`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-900 circular-progress-percentage">
              {progressPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span className="progress-percentage">{progressPercentage}%</span>
        </div>
        <div 
          className="w-full bg-gray-200 rounded-full h-2"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Job progress"
        >
          <div
            className={`h-2 rounded-full transition-all duration-500 ease-out ${
              state === 'completed' ? 'bg-green-500' :
              state === 'failed' ? 'bg-red-500' :
              state === 'running' || state === 'starting' ? 'bg-blue-500' :
              'bg-gray-400'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Time Information */}
      {isJobActive && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">Time Elapsed</div>
            <div className="text-lg font-semibold text-gray-900">{timeElapsedFormatted}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">Estimated Remaining</div>
            <div className="text-lg font-semibold text-gray-900">{timeRemainingFormatted}</div>
          </div>
        </div>
      )}

      {/* Step Timeline */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900">Job Steps</h4>
        <div className="space-y-3">
          {jobSteps.map((step, index) => {
            const status = getStepStatus(step.id);
            const isLast = index === jobSteps.length - 1;
            
            return (
              <div key={step.id} className="flex items-start">
                {/* Step indicator */}
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    status === 'completed' ? 'bg-green-500 text-white' :
                    status === 'current' ? 'bg-blue-500 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {status === 'completed' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 h-8 ml-4 ${
                      status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
                
                {/* Step content */}
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm font-medium ${
                        status === 'completed' ? 'text-green-900' :
                        status === 'current' ? 'text-blue-900' :
                        'text-gray-500'
                      }`}>
                        {step.name}
                      </div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                    
                    {status === 'current' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span className="text-xs text-blue-600">In Progress</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-4 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-600">Updating progress...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format time in MM:SS format
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default ProgressIndicator;
