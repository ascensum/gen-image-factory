/**
 * Add Temp Image Path Migration
 * 
 * This migration adds a tempImagePath field to generated_images table for storing
 * the path to unprocessed images in tempDirectory (for retry mechanism)
 */

module.exports = {
  version: 3,
  description: 'Add tempImagePath field to generated_images table for retry mechanism',
  
  up: `
    -- Add tempImagePath column to generated_images table
    ALTER TABLE generated_images ADD COLUMN tempImagePath TEXT;
    
    -- Create index on tempImagePath for retry operations
    CREATE INDEX IF NOT EXISTS idx_generated_images_temp_image_path ON generated_images(tempImagePath);
    
    -- Add comment explaining the field purpose
    -- tempImagePath: Path to unprocessed image in tempDirectory (for retry mechanism)
    -- finalImagePath: Path to processed image in output directory (for display/export)
  `,
  
  down: `
    -- Drop index on tempImagePath
    DROP INDEX IF EXISTS idx_generated_images_temp_image_path;
    
    -- Remove tempImagePath column (SQLite doesn't support DROP COLUMN, so we'll recreate the table)
    -- This is a simplified down migration - in production, you'd need to handle data preservation
    CREATE TABLE generated_images_backup AS SELECT 
      id, execution_id, generation_prompt, seed, qc_status, qc_reason, 
      final_image_path, image_mapping_id, metadata, created_at, updated_at
    FROM generated_images;
    
    DROP TABLE generated_images;
    
    ALTER TABLE generated_images_backup RENAME TO generated_images;
    
    -- Recreate primary key and foreign key constraints
    CREATE UNIQUE INDEX IF NOT EXISTS sqlite_autoindex_generated_images_1 ON generated_images(id);
    CREATE INDEX IF NOT EXISTS idx_generated_images_execution_id ON generated_images(execution_id);
    CREATE INDEX IF NOT EXISTS idx_generated_images_qc_status ON generated_images(qc_status);
    CREATE INDEX IF NOT EXISTS idx_generated_images_image_mapping_id ON generated_images(image_mapping_id);
  `
};
