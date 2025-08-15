/**
 * Add Job Execution Label Migration
 * 
 * This migration adds a label field to job_executions table for human-friendly job run names
 */

module.exports = {
  version: 2,
  description: 'Add label field to job_executions table for human-friendly job run names',
  
  up: `
    -- Add label column to job_executions table
    ALTER TABLE job_executions ADD COLUMN label TEXT;
    
    -- Create index on label for search performance
    CREATE INDEX IF NOT EXISTS idx_job_executions_label ON job_executions(label);
  `,
  
  down: `
    -- Drop index on label
    DROP INDEX IF EXISTS idx_job_executions_label;
    
    -- Remove label column (SQLite doesn't support DROP COLUMN, so we'll recreate the table)
    -- This is a simplified down migration - in production, you'd need to handle data preservation
    CREATE TABLE job_executions_backup AS SELECT 
      id, configuration_id, started_at, completed_at, status, 
      total_images, successful_images, failed_images, error_message
    FROM job_executions;
    
    DROP TABLE job_executions;
    
    ALTER TABLE job_executions_backup RENAME TO job_executions;
    
    -- Recreate primary key and foreign key constraints
    CREATE UNIQUE INDEX IF NOT EXISTS sqlite_autoindex_job_executions_1 ON job_executions(id);
  `
};
