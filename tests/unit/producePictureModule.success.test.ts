import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

vi.mock('axios', async () => {
  const actual: any = await vi.importActual('axios')
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
  const pngBuffer = Buffer.from(pngBase64, 'base64')
  return {
    default: {
      post: vi.fn(async () => ({ data: { data: [ { imageURL: 'https://example.com/a.png' } ] } })),
      get: vi.fn(async () => ({ data: pngBuffer }))
    }
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { producePictureModule } = require('../../src/producePictureModule.js')

describe('producePictureModule success path (Runware)', () => {
  const tempDir = path.join(os.tmpdir(), 'gif-runware-test', 'generated')
  const outDir = path.join(os.tmpdir(), 'gif-runware-test', 'toupload')

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true })
    fs.mkdirSync(outDir, { recursive: true })
  })

  afterEach(() => {
    try { fs.rmSync(path.join(os.tmpdir(), 'gif-runware-test'), { recursive: true, force: true }) } catch {}
  })

  it('returns processed images when provider returns URLs', async () => {
    const settings = {
      prompt: 'a cat',
      promptContext: '',
      apiKeys: { runware: 'test', openai: 'test', removeBg: '' },
      parameters: { runwareModel: 'runware:101@1', runwareFormat: 'png' }
    }
    const config = {
      tempDirectory: tempDir,
      outputDirectory: outDir,
      runQualityCheck: false,
      runMetadataGen: false,
      aspectRatios: ['1:1']
    }
    const result = await producePictureModule(settings, 'test_image', null, config)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].outputPath).toBeTruthy()
  })
})


