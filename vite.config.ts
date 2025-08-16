import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['tests/e2e/**/*', '**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**']
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