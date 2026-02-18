import { useMemo } from 'react';
import type { JobStatus, JobExecution } from './useDashboardState';
import type { GeneratedImageWithStringId as GeneratedImage } from '../../../../types/generatedImage';

export const useDashboardProgress = (config: any, jobStatus: JobStatus, generatedImages: GeneratedImage[]) => {
  
  const progressSteps = useMemo(() => {
    if (!config) return [];
    
    const steps = [
      {
        name: 'Initialization',
        icon: '️',
        description: 'Setup & Parameters',
        required: true,
        completed: true,
        weight: 20
      }
    ];
    
    const subtasks = [];
    subtasks.push('AI Generation');
    if (config.ai?.runMetadataGen) subtasks.push('Metadata');
    if (config.ai?.runQualityCheck) subtasks.push('QC');
    if (config.processing?.removeBg) subtasks.push('Background Removal');
    
    const hasProcessing = config.processing && (
      config.processing.imageEnhancement ||
      config.processing.imageConvert ||
      config.processing.sharpening > 0 ||
      config.processing.saturation !== 1 ||
      config.processing.convertToJpg ||
      config.processing.trimTransparentBackground
    );
    
    if (hasProcessing) subtasks.push('Processing');
    
    if (subtasks.length > 0) {
      steps.push({
        name: 'Image Generation',
        icon: '',
        description: subtasks.join(' + '),
        required: true,
        completed: false,
        weight: 80
      });
    }
    
    return steps;
  }, [config]);

  const smartProgress = useMemo(() => {
    const statusCount = Math.max(1, Number((jobStatus as any)?.currentJob?.totalGenerations || 0));
    const cfgCount = Math.max(1, Number(config?.parameters?.count || 1));
    const count = statusCount || cfgCount;

    const statusVariations = Math.max(1, Math.min(20, Number((jobStatus as any)?.currentJob?.variations || 0)));
    const cfgVariations = Math.max(1, Math.min(20, Number(config?.parameters?.variations || 1)));
    const variations = statusVariations || cfgVariations;

    const jobState = jobStatus?.state;
    const qcEnabled = !!(config?.ai?.runQualityCheck);

    let singleProgress = 0;
    if (jobState === 'completed') singleProgress = 100;

    let overallGenerationProgress = 0;
    let currentGeneration = 1;
    let gensDone = 0;
    
    try {
      const execId = (jobStatus as any)?.currentJob?.executionId || (jobStatus as any)?.currentJob?.id;
      const runnerGensDone = Number((jobStatus as any)?.currentJob?.gensDone || 0);
      if (count > 1) {
        if ((jobStatus as any)?.currentJob) {
          gensDone = Math.min(runnerGensDone, count);
          overallGenerationProgress = Math.round(Math.min(100, (gensDone / count) * 100));
        } else if (execId && Array.isArray(generatedImages)) {
          const imagesForExec = generatedImages.filter(img => String(img.executionId) === String(execId));
          gensDone = Math.floor((imagesForExec.length || 0) / variations);
          overallGenerationProgress = Math.round(Math.min(100, (gensDone / count) * 100));
        }
        if (qcEnabled && jobState !== 'completed') overallGenerationProgress = Math.min(overallGenerationProgress, 95);
        if (jobState === 'completed') overallGenerationProgress = 100;
        currentGeneration = Math.min(count, Math.max(1, gensDone + 1));
      } else {
        overallGenerationProgress = singleProgress;
        currentGeneration = 1;
      }
    } catch {}

    return {
      overallGenerationProgress,
      current: singleProgress,
      currentGeneration,
      totalGenerations: count,
      gensDone,
      totalImages: variations
    };
  }, [config, jobStatus, generatedImages]);

  return { progressSteps, smartProgress };
};
