/**
 * Initial Database Schema Migration
 * 
 * This migration represents the baseline schema with JobConfiguration, JobExecution, and GeneratedImage tables
 */

module.exports = {
  version: 1,
  description: 'Initial database schema with job configuration, execution, and image tables',
  
  up: `
    -- Create job_configurations table
    CREATE TABLE IF NOT EXISTS job_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      settings TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create job_executions table
    CREATE TABLE IF NOT EXISTS job_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      configuration_id INTEGER NOT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'running',
      total_images INTEGER DEFAULT 0,
      successful_images INTEGER DEFAULT 0,
      failed_images INTEGER DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (configuration_id) REFERENCES job_configurations(id) ON DELETE CASCADE
    );

    -- Create generated_images table
    CREATE TABLE IF NOT EXISTS generated_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execution_id INTEGER NOT NULL,
      generation_prompt TEXT NOT NULL,
      seed INTEGER,
      qc_status VARCHAR(20) DEFAULT 'pending',
      qc_reason TEXT,
      final_image_path VARCHAR(500),
      metadata TEXT,
      processing_settings TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_job_executions_configuration_id ON job_executions(configuration_id);
    CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
    CREATE INDEX IF NOT EXISTS idx_job_executions_started_at ON job_executions(started_at);
    CREATE INDEX IF NOT EXISTS idx_generated_images_execution_id ON generated_images(execution_id);
    CREATE INDEX IF NOT EXISTS idx_generated_images_qc_status ON generated_images(qc_status);
    CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at);
  `,
  
  down: `
    -- Drop indexes
    DROP INDEX IF EXISTS idx_generated_images_created_at;
    DROP INDEX IF EXISTS idx_generated_images_qc_status;
    DROP INDEX IF EXISTS idx_generated_images_execution_id;
    DROP INDEX IF EXISTS idx_job_executions_started_at;
    DROP INDEX IF EXISTS idx_job_executions_status;
    DROP INDEX IF EXISTS idx_job_executions_configuration_id;
    
    -- Drop tables
    DROP TABLE IF EXISTS generated_images;
    DROP TABLE IF EXISTS job_executions;
    DROP TABLE IF EXISTS job_configurations;
  `
};
