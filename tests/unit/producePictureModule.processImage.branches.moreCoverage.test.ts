import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockAxiosPost = vi.fn();

vi.mock('axios', () => {
  return {
    default: { post: mockAxiosPost },
    post: mockAxiosPost,
  };
});

describe('producePictureModule.processImage branch scenarios', () => {
  let tmpRoot: string;

  const tinyPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'base64',
  );

  const loadSut = () => {
    vi.resetModules();
    const modulePath = path.resolve(__dirname, '../../src/producePictureModule.js');
    if (require.cache[modulePath]) delete require.cache[modulePath];
    return require('../../src/producePictureModule.js') as { processImage: Function };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pprocess-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
    delete process.env.REMOVE_BG_API_KEY;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('converts to WEBP when imageConvert=true and convertToWebp=true (preserveInput keeps source)', async () => {
    const { processImage } = loadSut();

    const inPath = path.join(tmpRoot, 'in.png');
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(inPath, tinyPngBuffer);

    const outPath = await processImage(inPath, 'img1', {
      outputDirectory: outDir,
      tempDirectory: tmpRoot,
      preserveInput: true,
      removeBg: false,
      imageConvert: true,
      convertToWebp: true,
      webpQuality: 80,
    });

    expect(outPath).toMatch(/\.webp$/i);
    expect(fs.existsSync(outPath)).toBe(true);
    expect(fs.existsSync(inPath)).toBe(true);
  });

  it('remove.bg failure soft-falls back when failureMode=approve (continues processing and saves output)', async () => {
    // Make retry delays instant to avoid long sleeps
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: any) => {
      try { cb(); } catch {}
      return 0 as any;
    });

    const { processImage } = loadSut();

    const inPath = path.join(tmpRoot, 'in.png');
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(inPath, tinyPngBuffer);

    process.env.REMOVE_BG_API_KEY = 'k';

    const err: any = new Error('removebg 500');
    err.response = { status: 500, statusText: 'Server Error', data: 'oops' };
    mockAxiosPost.mockRejectedValue(err);

    const outPath = await processImage(inPath, 'img2', {
      outputDirectory: outDir,
      tempDirectory: tmpRoot,
      removeBg: true,
      removeBgFailureMode: 'approve',
      removeBgSize: 'preview',
      // conversion on to exercise extension decision
      imageConvert: true,
      convertToJpg: true,
      jpgQuality: 80,
      jpgBackground: 'white',
    });

    expect(outPath).toMatch(/\.jpg$/i);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('remove.bg failure hard-fails when failureMode=mark_failed (throws processing_failed:remove_bg with stage)', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: any) => {
      try { cb(); } catch {}
      return 0 as any;
    });

    const { processImage } = loadSut();

    const inPath = path.join(tmpRoot, 'in.png');
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(inPath, tinyPngBuffer);

    process.env.REMOVE_BG_API_KEY = 'k';

    const err: any = new Error('removebg 429');
    err.response = { status: 429, statusText: 'Too Many Requests', data: 'rate limit' };
    mockAxiosPost.mockRejectedValue(err);

    const p = processImage(inPath, 'img3', {
      outputDirectory: outDir,
      tempDirectory: tmpRoot,
      removeBg: true,
      removeBgFailureMode: 'mark_failed',
      imageConvert: false,
    });

    await expect(p).rejects.toMatchObject({ message: expect.stringContaining('processing_failed:remove_bg'), stage: 'remove_bg' });
  });

  it('skips trim when trimTransparentBackground=true but removeBg=false', async () => {
    const { processImage } = loadSut();

    const inPath = path.join(tmpRoot, 'in.jpeg');
    const outDir = path.join(tmpRoot, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(inPath, tinyPngBuffer);

    const outPath = await processImage(inPath, 'img4.jpeg', {
      outputDirectory: outDir,
      tempDirectory: tmpRoot,
      removeBg: false,
      trimTransparentBackground: true,
      imageConvert: false,
      preserveInput: false,
    });

    // When imageConvert=false, extension is preserved from input (.jpeg -> .jpg)
    expect(outPath).toMatch(/\.jpg$/i);
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
