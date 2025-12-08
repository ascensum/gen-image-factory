import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['tests/e2e/**/*', '**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**',
        '**/dist/**',
        '**/build/**',
        '**/electron/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/e2e/**',
        '**/coverage/**',
        '**/.{idea,git,cache,output,temp}/**'
      ],
      include: [
        'src/**/*.{ts,tsx,js,jsx}'
      ],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      }
    }
  },
  
  // Root directory for development
  root: '.',
  
  // Base directory for serving files
  base: './',
  
  // Build configuration
  build: {
    outDir: 'electron/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  
  // Development server configuration
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  
  // CSS configuration
  css: {
    postcss: './postcss.config.js'
  }
}); 