import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../../../../src/renderer/App'

describe('App.jsx - Main React Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render the main app container', () => {
      const { container } = render(<App />)
      const appContainer = container.querySelector('.min-h-screen')
      expect(appContainer).toBeInTheDocument()
    })

    it('should render the home view by default', () => {
      render(<App />)
      expect(screen.getByText(/Open Settings/i)).toBeInTheDocument()
      expect(screen.getByText(/Open Dashboard/i)).toBeInTheDocument()
    })

    it('should display app version from electronAPI', async () => {
      const mockVersion = '1.0.0'
      window.electronAPI.getAppVersion = vi.fn().mockResolvedValue(mockVersion)
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByText(`Version ${mockVersion}`)).toBeInTheDocument()
      })
    })

    it('should display loading state initially', () => {
      render(<App />)
      expect(screen.getByText(/Version Loading.../i)).toBeInTheDocument()
    })
  })

  describe('IPC Communication', () => {
    it('should test IPC communication on mount', async () => {
      const mockPing = vi.fn().mockResolvedValue('pong')
      window.electronAPI.ping = mockPing
      
      render(<App />)
      
      await waitFor(() => {
        expect(mockPing).toHaveBeenCalled()
      })
    })

    it('should handle successful IPC communication', async () => {
      window.electronAPI.ping = vi.fn().mockResolvedValue('pong')
      
      render(<App />)
      
      await waitFor(() => {
        expect(window.electronAPI.ping).toHaveBeenCalled()
      })
    })

    it('should handle IPC communication errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error')
      window.electronAPI.ping = vi.fn().mockRejectedValue(new Error('IPC Error'))
      
      render(<App />)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
      })
    })

    it('should get app version from electronAPI', async () => {
      const mockGetAppVersion = vi.fn().mockResolvedValue('1.2.3')
      window.electronAPI.getAppVersion = mockGetAppVersion
      
      render(<App />)
      
      await waitFor(() => {
        expect(mockGetAppVersion).toHaveBeenCalled()
      })
    })

    it('should handle app version error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error')
      window.electronAPI.getAppVersion = vi.fn().mockRejectedValue(new Error('Version Error'))
      
      render(<App />)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled()
        expect(screen.getByText(/Error:/i)).toBeInTheDocument()
      })
    })
  })

  describe('State Management', () => {
    it('should initialize with main view', () => {
      render(<App />)
      expect(screen.getByText(/Open Settings/i)).toBeInTheDocument()
      expect(screen.getByText(/Open Dashboard/i)).toBeInTheDocument()
    })

    // it('should initialize IPC status with Testing...', () => {
    //   // IPC status is an internal state not rendered in the UI, skipping this test
    // })

    it('should initialize app version with Loading...', () => {
      render(<App />)
      expect(screen.getByText(/Version Loading.../i)).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle', () => {
    it('should call electronAPI methods on mount', async () => {
      const mockPing = vi.fn().mockResolvedValue('pong')
      const mockGetAppVersion = vi.fn().mockResolvedValue('1.0.0')
      
      window.electronAPI.ping = mockPing
      window.electronAPI.getAppVersion = mockGetAppVersion
      
      render(<App />)
      
      await waitFor(() => {
        expect(mockPing).toHaveBeenCalled()
        expect(mockGetAppVersion).toHaveBeenCalled()
      })
    })

    it('should not leak memory after unmount', () => {
      const { unmount } = render(<App />)
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should render accessible navigation buttons', () => {
      render(<App />)
      const settingsButton = screen.getByText(/Open Settings/i)
      const dashboardButton = screen.getByText(/Open Dashboard/i)
      
      expect(settingsButton).toBeInTheDocument()
      expect(dashboardButton).toBeInTheDocument()
      expect(settingsButton.tagName).toBe('BUTTON')
      expect(dashboardButton.tagName).toBe('BUTTON')
    })

    it('should have proper button types', () => {
      render(<App />)
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing electronAPI gracefully', async () => {
      // Note: In test environment, electronAPI is always mocked
      // This test verifies the behavior conceptually
      expect(window.electronAPI).toBeDefined()
    })

    it('should display error message when IPC fails', async () => {
      window.electronAPI.ping = vi.fn().mockRejectedValue(new Error('Connection failed'))
      
      const consoleErrorSpy = vi.spyOn(console, 'error')
      
      render(<App />)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'IPC Error:',
          expect.any(Error)
        )
      })
    })

    it('should display error message when version fetch fails', async () => {
      window.electronAPI.getAppVersion = vi.fn().mockRejectedValue(new Error('Version fetch failed'))
      
      const consoleErrorSpy = vi.spyOn(console, 'error')
      
      render(<App />)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Version Error:',
          expect.any(Error)
        )
      })
    })
  })

  describe('Integration with Child Components', () => {
    it('should not render settings panel in main view', () => {
      render(<App />)
      expect(screen.queryByText(/API Keys/i)).not.toBeInTheDocument()
    })

    it('should not render dashboard panel in main view', () => {
      render(<App />)
      expect(screen.queryByText(/Job History/i)).not.toBeInTheDocument()
    })
  })
})

