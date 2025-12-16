const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Database Transaction Manager
 * 
 * Provides transaction support for complex database operations
 * Includes connection pooling and performance optimization
 */
class TransactionManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/settings.db');
    this.connectionPool = [];
    this.maxConnections = 5;
    this.activeConnections = 0;
    this.queryLog = [];
    this.performanceMetrics = {
      totalQueries: 0,
      totalExecutionTime: 0,
      slowQueries: [],
      averageQueryTime: 0
    };
  }

  async getConnection() {
    return new Promise((resolve, reject) => {
      if (this.connectionPool.length > 0) {
        const connection = this.connectionPool.pop();
        resolve(connection);
      } else if (this.activeConnections < this.maxConnections) {
        this.activeConnections++;
        const connection = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            this.activeConnections--;
            reject(err);
          } else {
            // Enable WAL mode for better concurrency
            connection.run('PRAGMA journal_mode = WAL', (err) => {
              if (err) {
                console.warn('WAL mode not available:', err.message);
              }
            });
            
            // Enable foreign keys
            connection.run('PRAGMA foreign_keys = ON', (err) => {
              if (err) {
                console.warn('Foreign keys not available:', err.message);
              }
            });
            
            resolve(connection);
          }
        });
      } else {
        reject(new Error('Connection pool exhausted'));
      }
    });
  }

  async releaseConnection(connection) {
    if (connection) {
      this.connectionPool.push(connection);
    }
  }

  async executeTransaction(operations) {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const tm = this;
      
      connection.serialize(() => {
        // Begin transaction
        connection.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            this.releaseConnection(connection);
            reject(err);
            return;
          }
        });

        let completedOperations = 0;
        const results = [];
        let hasError = false;

        // Execute each operation
        operations.forEach((operation, index) => {
          if (hasError) return;

          const queryStartTime = Date.now();
          
          connection.run(operation.sql, operation.params || [], function(err) {
            const queryTime = Date.now() - queryStartTime;
            
            // Log query performance
            tm.logQuery(operation.sql, queryTime);
            
            if (err) {
              hasError = true;
              connection.run('ROLLBACK', () => {
                tm.releaseConnection(connection);
                reject(err);
              });
              return;
            }

            results[index] = {
              success: true,
              lastID: this.lastID,
              changes: this.changes
            };

            completedOperations++;
            
            // If all operations completed, commit transaction
            if (completedOperations === operations.length) {
              connection.run('COMMIT', (err) => {
                if (err) {
                  tm.releaseConnection(connection);
                  reject(err);
                } else {
                  tm.releaseConnection(connection);
                  const totalTime = Date.now() - startTime;
                  console.log(`Transaction completed in ${totalTime}ms`);
                  resolve({
                    success: true,
                    results,
                    executionTime: totalTime
                  });
                }
              });
            }
          });
        });
      });
    });
  }

  async executeQuery(sql, params = []) {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      connection.get(sql, params, (err, row) => {
        const queryTime = Date.now() - startTime;
        this.logQuery(sql, queryTime);
        
        this.releaseConnection(connection);
        
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async executeQueryAll(sql, params = []) {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      connection.all(sql, params, (err, rows) => {
        const queryTime = Date.now() - startTime;
        this.logQuery(sql, queryTime);
        
        this.releaseConnection(connection);
        
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  logQuery(sql, executionTime) {
    this.performanceMetrics.totalQueries++;
    this.performanceMetrics.totalExecutionTime += executionTime;
    this.performanceMetrics.averageQueryTime = 
      this.performanceMetrics.totalExecutionTime / this.performanceMetrics.totalQueries;

    // Log slow queries (over 100ms)
    if (executionTime > 100) {
      this.performanceMetrics.slowQueries.push({
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        executionTime,
        timestamp: new Date()
      });
    }

    // Keep only last 50 slow queries
    if (this.performanceMetrics.slowQueries.length > 50) {
      this.performanceMetrics.slowQueries = this.performanceMetrics.slowQueries.slice(-50);
    }

    this.queryLog.push({
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      executionTime,
      timestamp: new Date()
    });

    // Keep only last 1000 queries in log
    if (this.queryLog.length > 1000) {
      this.queryLog = this.queryLog.slice(-1000);
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      connectionPoolSize: this.connectionPool.length,
      activeConnections: this.activeConnections,
      recentQueries: this.queryLog.slice(-10)
    };
  }

  async optimizeDatabase() {
    const connection = await this.getConnection();
    
    return new Promise((resolve, reject) => {
      const tm = this;
      connection.serialize(() => {
        // Analyze tables for better query planning
        connection.run('ANALYZE', (err) => {
          if (err) {
            console.warn('ANALYZE failed:', err.message);
          }
        });

        // Optimize database
        connection.run('VACUUM', (err) => {
          if (err) {
            console.warn('VACUUM failed:', err.message);
          }
          // Reindex for better performance
          connection.run('REINDEX', (err2) => {
            if (err2) {
              console.warn('REINDEX failed:', err2.message);
            }
            tm.releaseConnection(connection);
            console.log('Database optimization completed');
            resolve();
          });
        });
      });
    });
  }

  async closeAllConnections() {
    const closePromises = this.connectionPool.map(connection => {
      return new Promise((resolve) => {
        connection.close((err) => {
          if (err) {
            console.error('Error closing connection:', err);
          }
          resolve();
        });
      });
    });

    await Promise.all(closePromises);
    this.connectionPool = [];
    this.activeConnections = 0;
    console.log('All database connections closed');
  }
}

module.exports = { TransactionManager };
