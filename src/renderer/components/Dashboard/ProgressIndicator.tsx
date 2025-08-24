import React from 'react';
import { JobStatus } from './DashboardPanel';

interface ProgressIndicatorProps {
  jobStatus: JobStatus;
  isLoading: boolean;
  jobConfiguration?: any; // Job configuration to determine enabled steps
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  jobStatus,
  isLoading,
  jobConfiguration
}) => {
  const { state, progress, currentStep, totalSteps, startTime, estimatedTimeRemaining } = jobStatus;
  
  const isJobActive = state === 'running' || state === 'starting';
  const progressPercentage = Math.round(progress * 100);
  
  // Calculate time elapsed
  const timeElapsed = startTime ? Math.floor((Date.now() - new Date(startTime).getTime()) / 1000) : 0;
  const timeElapsedFormatted = formatTime(timeElapsed);
  const timeRemainingFormatted = estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : '--:--';

  // Dynamic job steps based on new 3-step design - matches backend architecture
  const jobSteps = React.useMemo(() => {
    const allPossibleSteps = [
      { 
        id: 1, 
        name: 'Initialization', 
        description: 'Setting up job configuration and parameters', 
        icon: '⚙️', 
        required: true,
        subSteps: ['Configuration', 'Parameters']
      },
      { 
        id: 2, 
        name: 'Image Generation', 
        description: 'Generating images and metadata', 
        icon: '🎨', 
        required: true,
        subSteps: ['AI Generation', 'Metadata'],
        hasMetadata: jobConfiguration?.ai?.runMetadataGen
      },
      { 
        id: 3, 
        name: 'AI Operations', 
        description: 'Quality checks and image processing', 
        icon: '🤖', 
        required: false,
        subSteps: ['Quality Check', 'Processing'],
        hasQualityCheck: jobConfiguration?.ai?.runQualityCheck,
        hasProcessing: jobConfiguration?.processing && (
          jobConfiguration.processing.imageEnhancement ||
          jobConfiguration.processing.imageConvert ||
          jobConfiguration.processing.removeBg ||
          jobConfiguration.processing.trimTransparentBackground
        )
      }
    ];

    // Filter steps based on job configuration settings
    const enabledSteps = allPossibleSteps.filter(step => {
      // Always include required steps
      if (step.required) return true;
      
      // For AI Operations step, check if any AI features are enabled
      if (step.id === 3) {
        return step.hasQualityCheck || step.hasProcessing;
      }
      
      // If no configuration available, include all steps (fallback)
      return true;
    });

    // Reassign sequential IDs to enabled steps
    return enabledSteps.map((step, index) => ({
      ...step,
      id: index + 1
    }));
  }, [jobConfiguration]);

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

      {/* Horizontal Step Carousel/Roulette */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Job Steps</h4>
        
        {/* Horizontal step carousel */}
        <div className="relative overflow-hidden">
          <div className="flex items-center space-x-2 transition-transform duration-500 ease-in-out">
            {jobSteps.map((step, index) => {
              const status = getStepStatus(step.id);
              const isLast = index === jobSteps.length - 1;
              
              return (
                <React.Fragment key={step.id}>
                  {/* Step card */}
                  <div className={`flex-shrink-0 transition-all duration-300 ${
                    status === 'completed' ? 'opacity-60 scale-90' :
                    status === 'current' ? 'opacity-100 scale-100' :
                    'opacity-40 scale-95'
                  }`}>
                    <div className={`bg-white border-2 rounded-lg p-3 min-w-[140px] ${
                      status === 'completed' ? 'border-green-200 bg-green-50' :
                      status === 'current' ? 'border-blue-300 bg-blue-50 shadow-md' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      {/* Step icon and number */}
                      <div className="flex items-center justify-center mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          status === 'completed' ? 'bg-green-500 text-white' :
                          status === 'current' ? 'bg-blue-500 text-white' :
                          'bg-gray-300 text-gray-600'
                        }`}>
                          {status === 'completed' ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-lg">{step.icon}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Step name */}
                      <div className={`text-center text-xs font-medium mb-1 ${
                        status === 'completed' ? 'text-green-700' :
                        status === 'current' ? 'text-blue-700' :
                        'text-gray-500'
                      }`}>
                        {step.name}
                      </div>
                      
                      {/* Sub-steps - show relevant ones based on configuration */}
                      {step.subSteps && (
                        <div className="text-center text-xs text-gray-500 leading-tight mb-1">
                          {step.id === 2 && step.hasMetadata ? (
                            <div>AI Generation + Metadata</div>
                          ) : step.id === 2 ? (
                            <div>AI Generation only</div>
                          ) : step.id === 3 && step.hasQualityCheck && step.hasProcessing ? (
                            <div>QC + Processing</div>
                          ) : step.id === 3 && step.hasQualityCheck ? (
                            <div>Quality Check only</div>
                          ) : step.id === 3 && step.hasProcessing ? (
                            <div>Processing only</div>
                          ) : step.id === 3 ? (
                            <div>Skipped (no AI features)</div>
                          ) : (
                            <div>{step.subSteps.join(' + ')}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Step description - only show for current step */}
                      {status === 'current' && (
                        <div className="text-center text-xs text-gray-600 leading-tight">
                          {step.description}
                        </div>
                      )}
                      
                      {/* Current step indicator */}
                      {status === 'current' && (
                        <div className="flex items-center justify-center mt-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Connection line */}
                  {!isLast && (
                    <div className={`flex-shrink-0 w-8 h-0.5 ${
                      status === 'completed' ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        
        {/* Current step details - below carousel */}
        {isJobActive && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-900">
                  Currently: {jobSteps.find(s => s.id === currentStep)?.name || 'Processing'}
                </span>
              </div>
              <span className="text-xs text-gray-600">
                Step {currentStep} of {totalSteps}
              </span>
            </div>
          </div>
        )}
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
