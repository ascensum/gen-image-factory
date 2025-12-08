import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Mock axios - must be hoisted before module loading
const mockAxiosPost = vi.fn()
const mockAxiosGet = vi.fn()

// Use vi.mock to mock axios - this intercepts require('axios')
vi.mock('axios', () => {
  return {
    default: {
      post: mockAxiosPost,
      get: mockAxiosGet
    },
    post: mockAxiosPost,
    get: mockAxiosGet
  }
})

// Import after mocks are set up
let producePictureModule: any

beforeAll(() => {
  vi.resetModules()
  // Clear require cache to ensure fresh import
  const modulePath = path.resolve(__dirname, '../../src/producePictureModule.js')
  if (require.cache[modulePath]) {
    delete require.cache[modulePath]
  }
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('../../src/producePictureModule.js')
  producePictureModule = module.producePictureModule
  
  // Also spy on the axios instance that was loaded in the module
  // The module uses: const axios = require("axios")
  // So we need to ensure our mock is used
  const axiosModule = require('axios')
  if (axiosModule && axiosModule.default) {
    axiosModule.default.post = mockAxiosPost
    axiosModule.default.get = mockAxiosGet
  }
  if (axiosModule.post) axiosModule.post = mockAxiosPost
  if (axiosModule.get) axiosModule.get = mockAxiosGet
})

describe('producePictureModule success path (Runware)', () => {
  const tempDir = path.join(os.tmpdir(), 'gif-runware-test', 'generated')
  const outDir = path.join(os.tmpdir(), 'gif-runware-test', 'toupload')

  beforeEach(() => {
    vi.clearAllMocks()
    fs.mkdirSync(tempDir, { recursive: true })
    fs.mkdirSync(outDir, { recursive: true })
    
    // Reset axios mocks - set up proper responses
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
    const pngBuffer = Buffer.from(pngBase64, 'base64')
    
    // Mock Runware API post response (image generation)
    mockAxiosPost.mockResolvedValue({ 
      status: 200,
      data: { data: [ { imageURL: 'https://example.com/a.png' } ] } 
    })
    // Mock image download get response
    mockAxiosGet.mockResolvedValue({ 
      status: 200,
      data: pngBuffer 
    })
  })

  afterEach(() => {
    try { fs.rmSync(path.join(os.tmpdir(), 'gif-runware-test'), { recursive: true, force: true }) } catch {}
  })

  it('returns processed images when provider returns URLs', async () => {
    // Code checks process.env.RUNWARE_API_KEY, not settings.apiKeys.runware
    process.env.RUNWARE_API_KEY = 'test-runware-key'
    
    const settings = {
      prompt: 'a cat',
      promptContext: '',
      apiKeys: { runware: 'test', openai: 'test', removeBg: '' },
      parameters: { 
        runwareModel: 'runware:101@1', 
        runwareFormat: 'png',
        runwareDimensionsCsv: '1024,1024',
        variations: 1
      }
    }
    const config = {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      runQualityCheck: false,
      runMetadataGen: false,
      variations: 1
    }
    
    // Verify mocks are set up
    expect(mockAxiosPost).toBeDefined()
    expect(mockAxiosGet).toBeDefined()
    
    const result = await producePictureModule(settings, 'test_image', null, config)
    
    // Clean up
    delete process.env.RUNWARE_API_KEY
    
    // Verify mocks were called
    expect(mockAxiosPost).toHaveBeenCalled()
    expect(mockAxiosGet).toHaveBeenCalled()
    
    // Function returns { processedImages, failedItems } not an array
    expect(result).toBeDefined()
    expect(result).toHaveProperty('processedImages')
    expect(result).toHaveProperty('failedItems')
    expect(Array.isArray(result.processedImages)).toBe(true)
    expect(result.processedImages.length).toBeGreaterThan(0)
    expect(result.processedImages[0].outputPath).toBeTruthy()
  })
})


