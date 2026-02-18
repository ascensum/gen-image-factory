/**
 * AI Memory Integration Test
 * 
 * Verifies that the ai-memory installation works correctly:
 * - Qdrant collections accessible
 * - Embedding service generates vectors
 * - Hook scripts can capture and store memories
 * - Memory retrieval works
 */

import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AI Memory Integration', () => {
  const QDRANT_URL = 'http://localhost:26350';
  const EMBEDDING_URL = 'http://localhost:28080';
  const PROJECT_ROOT = path.join(__dirname, '../../..');
  
  // Helper to execute curl commands
  function curl(url, options = {}) {
    const method = options.method || 'GET';
    const data = options.data ? `-d '${JSON.stringify(options.data)}'` : '';
    const headers = options.headers ? Object.entries(options.headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' ') : '';
    
    try {
      const result = execSync(
        `curl -s -w '\n' -X ${method} ${headers} ${data} "${url}"`,
        { encoding: 'utf8' }
      );
      // Take only the last line (actual response, ignore curl progress)
      const jsonLine = result.trim().split('\n').pop();
      return JSON.parse(jsonLine);
    } catch (error) {
      throw new Error(`Curl failed: ${error.message}`);
    }
  }

  describe('Infrastructure Health', () => {
    test('Qdrant is accessible', () => {
      const response = curl(`${QDRANT_URL}/`);
      expect(response.title).toBe('qdrant - vector search engine');
    });

    test('Embedding service is healthy', () => {
      const response = curl(`${EMBEDDING_URL}/health`);
      expect(response.status).toBe('healthy');
      expect(response.model_loaded).toBe(true);
      expect(response.dimensions).toBe(768);
    });

    test('All three collections exist', () => {
      const response = curl(`${QDRANT_URL}/collections`);
      const collectionNames = response.result.collections.map(c => c.name);
      
      expect(collectionNames).toContain('code-patterns');
      expect(collectionNames).toContain('conventions');
      expect(collectionNames).toContain('discussions');
    });
  });

  describe('Embedding Generation', () => {
    test('Can generate embeddings for text', () => {
      const testText = 'This is a test document for ai-memory integration';
      
      const response = curl(`${EMBEDDING_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { texts: [testText] }
      });

      expect(response.embeddings).toBeDefined();
      expect(Array.isArray(response.embeddings)).toBe(true);
      expect(response.embeddings[0].length).toBe(768);
      expect(typeof response.embeddings[0][0]).toBe('number');
      expect(response.dimensions).toBe(768);
    });
  });

  describe('Hook Scripts', () => {
    const hooksDir = path.join(PROJECT_ROOT, '.claude/hooks/scripts');

    test('Hook directory exists and contains scripts', () => {
      expect(fs.existsSync(hooksDir)).toBe(true);
      
      const hookFiles = fs.readdirSync(hooksDir);
      expect(hookFiles.length).toBeGreaterThan(0);
      expect(hookFiles).toContain('post_tool_capture.py');
      expect(hookFiles).toContain('session_start.py');
      expect(hookFiles).toContain('pre_compact_save.py');
    });

    test('Hook scripts are executable', () => {
      const criticalHooks = [
        'post_tool_capture.py',
        'session_start.py',
        'pre_compact_save.py'
      ];

      criticalHooks.forEach(hookName => {
        const hookPath = path.join(hooksDir, hookName);
        expect(fs.existsSync(hookPath)).toBe(true);
        
        const stats = fs.statSync(hookPath);
        // Check if file is executable (Unix permissions)
        const isExecutable = (stats.mode & 0o111) !== 0;
        expect(isExecutable).toBe(true);
      });
    });

    test('Hook scripts are symlinks to shared installation', () => {
      const hookPath = path.join(hooksDir, 'post_tool_capture.py');
      const stats = fs.lstatSync(hookPath);
      
      expect(stats.isSymbolicLink()).toBe(true);
      
      const target = fs.readlinkSync(hookPath);
      expect(target).toContain('.ai-memory');
    });
  });

  describe('Configuration Files', () => {
    test('Claude settings.json exists and is valid', () => {
      const settingsPath = path.join(PROJECT_ROOT, '.claude/settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);
      
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.version).toBe(1);
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.sessionStart).toBeDefined();
      expect(settings.hooks.postTool).toBeDefined();
      expect(settings.hooks.preCompact).toBeDefined();
      expect(settings.env.AI_MEMORY_PROJECT_ID).toBe('gen-image-factory');
    });

    test('Gemini settings.json exists and is valid', () => {
      const settingsPath = path.join(PROJECT_ROOT, '.gemini/settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);
      
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.AfterTool).toBeDefined();
      expect(settings.env.AI_MEMORY_PROJECT_ID).toBe('gen-image-factory');
    });

    test('Cursor hooks.json exists and is valid', () => {
      const hooksPath = path.join(PROJECT_ROOT, '.cursor/hooks.json');
      expect(fs.existsSync(hooksPath)).toBe(true);
      
      const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
      expect(hooks.version).toBe(1);
      expect(hooks.hooks.afterFileEdit).toBeDefined();
      expect(hooks.hooks.afterFileEdit[0].command).toContain('cursor-afterFileEdit-adapter.sh');
    });

    test('Cursor adapter script exists and is executable', () => {
      const adapterPath = path.join(PROJECT_ROOT, '.cursor/hooks/cursor-afterFileEdit-adapter.sh');
      expect(fs.existsSync(adapterPath)).toBe(true);
      
      const stats = fs.statSync(adapterPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });
  });

  describe('Memory Storage and Retrieval', () => {
    const testPointId = Date.now(); // Use integer ID
    const testContent = 'This is a test memory for ai-memory integration verification';

    test('Can store a memory point in code-patterns collection', async () => {
      // First, generate embedding
      const embeddingResponse = curl(`${EMBEDDING_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { texts: [testContent] }
      });

      const vector = embeddingResponse.embeddings[0];

      // Store point in Qdrant
      const storeResponse = curl(`${QDRANT_URL}/collections/code-patterns/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: {
          points: [{
            id: testPointId,
            vector: vector,
            payload: {
              content: testContent,
              project_id: 'gen-image-factory',
              type: 'test',
              timestamp: new Date().toISOString()
            }
          }]
        }
      });

      expect(storeResponse.status).toBe('ok');
      expect(['completed', 'acknowledged']).toContain(storeResponse.result.status);
    });

    test('Can retrieve stored memory by search', () => {
      // Generate query embedding
      const queryEmbedding = curl(`${EMBEDDING_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { texts: ['test memory integration'] }
      });

      // Search for similar points
      const searchResponse = curl(`${QDRANT_URL}/collections/code-patterns/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          vector: queryEmbedding.embeddings[0],
          limit: 5,
          with_payload: true
        }
      });

      expect(searchResponse.status).toBe('ok');
      expect(searchResponse.result.length).toBeGreaterThan(0);
      
      // Find our test point
      const testPoint = searchResponse.result.find(
        r => r.payload && r.payload.content === testContent
      );
      expect(testPoint).toBeDefined();
      expect(testPoint.score).toBeGreaterThan(0.5); // Similarity threshold
    });

    test('Can retrieve stored memory by ID', () => {
      const getResponse = curl(`${QDRANT_URL}/collections/code-patterns/points/${testPointId}`);

      expect(getResponse.status).toBe('ok');
      expect(getResponse.result.id).toBe(testPointId);
      expect(getResponse.result.payload.content).toBe(testContent);
      expect(getResponse.result.payload.project_id).toBe('gen-image-factory');
    });

    test('Can delete test memory point (cleanup)', () => {
      const deleteResponse = curl(`${QDRANT_URL}/collections/code-patterns/points/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          points: [testPointId]
        }
      });

      expect(deleteResponse.status).toBe('ok');
      expect(['completed', 'acknowledged']).toContain(deleteResponse.result.status);
    });
  });

  describe('Performance', () => {
    test('Embedding generation completes within 1 second', () => {
      const start = Date.now();
      
      curl(`${EMBEDDING_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { texts: ['Performance test text'] }
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    test('Qdrant search completes within 200ms', () => {
      // Generate a query vector
      const embeddingResponse = curl(`${EMBEDDING_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { texts: ['search performance test'] }
      });

      const start = Date.now();
      
      curl(`${QDRANT_URL}/collections/code-patterns/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          vector: embeddingResponse.embeddings[0],
          limit: 10
        }
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Legacy Bootstrap Cleanup', () => {
    test('Bootstrap MCP config has been archived', () => {
      const backupPath = path.join(PROJECT_ROOT, '.cursor/mcp_config.json.bootstrap-backup');
      expect(fs.existsSync(backupPath)).toBe(true);
      
      const config = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      expect(config.mcpServers['qdrant-knowledge']).toBeDefined();
    });

    test('Active MCP config does not exist', () => {
      const activePath = path.join(PROJECT_ROOT, '.cursor/mcp_config.json');
      expect(fs.existsSync(activePath)).toBe(false);
    });

    test('Old memory-persistence rule has been archived', () => {
      const archivePath = path.join(PROJECT_ROOT, 'docs/archive/memory-persistence.mdc.bootstrap');
      expect(fs.existsSync(archivePath)).toBe(true);
    });
  });
});
