import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Characterization tests share a single SQLite file (createRequire bypasses vi.mock).
    // Running files in parallel causes SQLITE_BUSY. Sequential execution is required.
    fileParallelism: false,
    exclude: ['tests/e2e/**/*', 'tests/integration/ai-memory/**/*', '**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
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
        '**/.{idea,git,cache,output,temp}/**',
        // Entrypoints / side-effect modules that are not meaningfully unit-testable
        'src/index.js',
        'src/utils.js'
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

    // Pillar 4: Switch from esbuild to Terser for superior dead-code elimination
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,   // PRESERVE: Shadow Bridge Logger uses console interception — NON-NEGOTIABLE
        drop_debugger: true,
        pure_funcs: [],        // Do NOT annotate console.* as pure — Shadow Bridge depends on them
        passes: 2
      },
      mangle: {
        keep_classnames: false,
        keep_fnames: false
      }
    },

    sourcemap: false,

    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
        // Epic 5 pre-wire: Add Motia worker entry points here when they land.
        // Worker files must be top-level inputs — NOT routed via manualChunks.
        // e.g. motiaWorker: path.resolve(__dirname, 'src/workers/motia-worker.ts')
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/react-window')) {
            return 'vendor-windowing';
          }
          // Epic 5 pre-wire: PGlite WASM chunk — prevents 3-4MB inline base64 in vendor-misc.
          // Activate this branch when @electric-sql/pglite is added as a production dep.
          // if (id.includes('node_modules/@electric-sql/pglite')) {
          //   return 'vendor-database';
          // }
          // Epic 5 pre-wire: Motia orchestration chunk — must NOT be absorbed by vendor-misc
          // or Rollup cannot produce valid dynamic import URLs for step handlers.
          // if (id.includes('node_modules/@motia/') || id.includes('node_modules/motia')) {
          //   return 'vendor-orchestration';
          // }
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
        // Deterministic chunk filenames for reproducible builds
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      },
      // Silence expected "use client" directive warnings from React 19
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      }
    },

    target: 'esnext',
    assetsDir: 'assets',
    modulePreload: { polyfill: false },  // Electron has native ESM support; polyfill not needed

    // Epic 5 pre-wire: enable when PGlite is introduced as a production dep.
    // assetsInclude: ['**/*.wasm'],
    // plugins: [wasm()],   // vite-plugin-wasm — emits .wasm as file, prevents inline base64
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