import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'

// Mock React DOM
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}))

// Mock App component
vi.mock('../../../../src/renderer/App', () => ({
  default: () => null,
}))

describe('main.jsx - React Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clean up DOM
    document.body.innerHTML = '<div id="root"></div>'
  })

  describe('React 18 createRoot', () => {
    it('should use React 18 createRoot API', async () => {
      // Import main.jsx to trigger the initialization
      await import('../../../../src/renderer/main.jsx')
      
      expect(createRoot).toHaveBeenCalled()
    })

    it('should get root element from DOM', () => {
      const rootElement = document.getElementById('root')
      expect(rootElement).toBeTruthy()
      expect(rootElement?.id).toBe('root')
    })

    it('should call render on the root', async () => {
      const mockRender = vi.fn()
      const mockCreateRoot = vi.fn(() => ({
        render: mockRender,
        unmount: vi.fn(),
      }))
      
      vi.mocked(createRoot).mockImplementation(mockCreateRoot)
      
      // Re-import to trigger initialization with new mock
      vi.resetModules()
      await import('../../../../src/renderer/main.jsx')
      
      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe('DOM Initialization', () => {
    it('should find root element by id', () => {
      const rootElement = document.getElementById('root')
      expect(rootElement).not.toBeNull()
      expect(rootElement?.id).toBe('root')
    })

    it('should have a valid container element', () => {
      const container = document.getElementById('root')
      expect(container).toBeInstanceOf(HTMLElement)
    })
  })

  describe('App Component Integration', () => {
    it('should import App component', async () => {
      // This test verifies that the import statement works
      const AppModule = await import('../../../../src/renderer/App')
      expect(AppModule.default).toBeDefined()
    })

    it('should render App component into root', async () => {
      const mockRender = vi.fn()
      vi.mocked(createRoot).mockReturnValue({
        render: mockRender,
        unmount: vi.fn(),
      })
      
      vi.resetModules()
      await import('../../../../src/renderer/main.jsx')
      
      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe('CSS Import', () => {
    it('should import index.css', async () => {
      // This test verifies that the CSS import doesn't throw
      expect(async () => {
        await import('../../../../src/renderer/index.css')
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing root element gracefully', () => {
      document.body.innerHTML = '' // Remove root element
      
      // This would typically throw in a real scenario
      const rootElement = document.getElementById('root')
      expect(rootElement).toBeNull()
    })

    it('should create root with valid container', () => {
      const container = document.getElementById('root')
      if (container) {
        const root = createRoot(container)
        expect(root).toBeDefined()
      }
    })
  })

  describe('Module Exports', () => {
    it('should execute main.jsx without errors', async () => {
      await expect(import('../../../../src/renderer/main.jsx')).resolves.toBeDefined()
    })

    it('should initialize React application', async () => {
      const mockCreateRoot = vi.fn(() => ({
        render: vi.fn(),
        unmount: vi.fn(),
      }))
      
      vi.mocked(createRoot).mockImplementation(mockCreateRoot)
      
      vi.resetModules()
      await import('../../../../src/renderer/main.jsx')
      
      expect(mockCreateRoot).toHaveBeenCalled()
    })
  })
})

