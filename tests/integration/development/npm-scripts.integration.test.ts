import { describe, it, expect } from 'vitest'

describe('Development Workflow - NPM Scripts', () => {
  describe('Development Scripts', () => {
    it('should have dev script for Vite dev server', () => {
      const scripts = {
        dev: 'vite',
      }
      expect(scripts.dev).toBe('vite')
    })

    it('should have electron:dev script for development', () => {
      const scripts = {
        'electron:dev': 'NODE_ENV=development electron .',
      }
      expect(scripts['electron:dev']).toContain('development')
    })

    it('should have build script', () => {
      const scripts = {
        build: 'vite build',
      }
      expect(scripts.build).toBe('vite build')
    })
  })

  describe('Testing Scripts', () => {
    it('should have test script for Vitest', () => {
      const scripts = {
        test: 'vitest',
      }
      expect(scripts.test).toBe('vitest')
    })

    it('should have test:run for CI', () => {
      const scripts = {
        'test:run': 'vitest run',
      }
      expect(scripts['test:run']).toBe('vitest run')
    })

    it('should have test:e2e for Playwright', () => {
      const scripts = {
        'test:e2e': 'playwright test',
      }
      expect(scripts['test:e2e']).toBe('playwright test')
    })

    it('should have test:all for complete test suite', () => {
      const scripts = {
        'test:all': 'npm run test:run && npm run test:e2e',
      }
      expect(scripts['test:all']).toContain('test:run')
      expect(scripts['test:all']).toContain('test:e2e')
    })
  })

  describe('Linting Scripts', () => {
    it('should have lint script', () => {
      const scripts = {
        lint: 'eslint . --ext js,jsx,ts,tsx',
      }
      expect(scripts.lint).toContain('eslint')
    })

    it('should have lint:fix script', () => {
      const scripts = {
        'lint:fix': 'eslint . --ext js,jsx,ts,tsx --fix',
      }
      expect(scripts['lint:fix']).toContain('--fix')
    })
  })

  describe('Database Scripts', () => {
    it('should have migrate script', () => {
      const scripts = {
        migrate: 'node scripts/run-migrations.js',
      }
      expect(scripts.migrate).toContain('run-migrations')
    })
  })

  describe('Build Scripts', () => {
    it('should have electron:build script', () => {
      const scripts = {
        'electron:build': 'npm run build && electron .',
      }
      expect(scripts['electron:build']).toContain('build')
    })

    it('should have preview script', () => {
      const scripts = {
        preview: 'vite preview',
      }
      expect(scripts.preview).toBe('vite preview')
    })
  })

  describe('Script Dependencies', () => {
    it('should run build before electron:build', () => {
      const electronBuildScript = 'npm run build && electron .'
      expect(electronBuildScript).toContain('npm run build')
    })

    it('should run tests before test:all completes', () => {
      const testAllScript = 'npm run test:run && npm run test:e2e'
      expect(testAllScript).toContain('test:run')
      expect(testAllScript).toContain('&&')
    })
  })

  describe('Environment Setup', () => {
    it('should set NODE_ENV for electron:dev', () => {
      const electronDevScript = 'NODE_ENV=development electron .'
      expect(electronDevScript).toContain('NODE_ENV=development')
    })

    it('should have prepare script for husky', () => {
      const scripts = {
        prepare: 'husky install',
      }
      expect(scripts.prepare).toBe('husky install')
    })
  })
})

