#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * Run this script to apply pending database migrations
 */

const { DatabaseMigration } = require('../src/database/migrations/index.js');

async function runMigrations() {
  const migration = new DatabaseMigration();
  
  try {
    console.log('Starting database migration...');
    await migration.init();
    await migration.migrate();
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    migration.close();
  }
}

runMigrations();
