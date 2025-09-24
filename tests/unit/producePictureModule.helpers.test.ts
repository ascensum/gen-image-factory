import { describe, it, expect } from 'vitest'
// Import helper functions from CommonJS module via require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helpers = require('../../src/producePictureModule.js')

describe('producePictureModule helpers', () => {
  it('getRunwareDimensionsForGeneration parses valid CSV', () => {
    const { getRunwareDimensionsForGeneration } = helpers
    expect(getRunwareDimensionsForGeneration('1024x1024', 0)).toEqual({ width: 1024, height: 1024 })
    expect(getRunwareDimensionsForGeneration('1024x1024,1280x720', 1)).toEqual({ width: 1280, height: 720 })
    expect(getRunwareDimensionsForGeneration('1024x1024,1280x720', 2)).toEqual({ width: 1024, height: 1024 })
  })

  it('getRunwareDimensionsForGeneration returns null for invalid entries', () => {
    const { getRunwareDimensionsForGeneration } = helpers
    expect(getRunwareDimensionsForGeneration('', 0)).toBeNull()
    expect(getRunwareDimensionsForGeneration('foo', 0)).toBeNull()
    expect(getRunwareDimensionsForGeneration('0x100', 0)).toBeNull()
  })

  it('extractRunwareImageUrls returns valid http(s) URLs', () => {
    const { extractRunwareImageUrls } = helpers
    const urls = extractRunwareImageUrls({ data: [ { imageURL: 'https://a/b.png' }, { imageURL: 'http://c/d.jpg' }, { imageURL: 'x' } ] })
    expect(urls).toEqual(['https://a/b.png', 'http://c/d.jpg'])
    expect(extractRunwareImageUrls(null)).toEqual([])
    expect(extractRunwareImageUrls({ data: [] })).toEqual([])
  })
})


