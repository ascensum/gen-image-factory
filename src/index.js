/**
 * CLI Entry Point - Standalone image generation pipeline.
 *
 * Story 5.3: Rewritten to use modular services (ImagePipelineService)
 * instead of deleted producePictureModule monolith.
 *
 * Usage: node src/index.js --keywordsFile keywords.txt --count 5
 */
require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const ExcelJS = require('exceljs');
const { paramsGeneratorModule } = require("./paramsGeneratorModule");
const { logDebug } = require('./utils/logDebug');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const csv = require('csv-parser');

const ImageGeneratorService = require('./services/ImageGeneratorService');
const ImageRemoverService = require('./services/ImageRemoverService');
const ImageProcessorService = require('./services/ImageProcessorService');
const ImagePipelineService = require('./services/ImagePipelineService');

async function readTextFile(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return data.split('\n').filter(line => line.trim() !== '');
}

function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    require('fs').createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('keywordsFile', { alias: 'k', type: 'string', description: 'Path to keywords file' })
    .option('mjSystemPrompt', { alias: 's', type: 'string', description: 'Path to system prompt file' })
    .option('qualityCheckPromptFile', { alias: 'q', type: 'string', description: 'Path to QC prompt file' })
    .option('metadataSystemPrompt', { type: 'string', default: null })
    .option('count', { alias: 'c', type: 'number', default: 1 })
    .option('removeBg', { type: 'boolean' })
    .option('imageConvert', { type: 'boolean' })
    .option('imageEnhancement', { type: 'boolean' })
    .option('sharpening', { type: 'number', default: 5 })
    .option('saturation', { type: 'number', default: 1.4 })
    .option('convertToJpg', { type: 'boolean' })
    .option('keywordRandom', { type: 'boolean' })
    .option('trimTransparentBackground', { type: 'boolean' })
    .option('pollingTimeout', { alias: 'pt', type: 'number', default: null })
    .option('removeBgSize', { alias: 'rs', type: 'string', default: null })
    .option('jpgQuality', { alias: 'jq', type: 'number', default: null })
    .option('pngQuality', { alias: 'pq', type: 'number', default: null })
    .option('jpgBackground', { alias: 'jb', type: 'string', choices: ['white', 'black'] })
    .option('runQualityCheck', { type: 'boolean', default: null })
    .option('runMetadataGen', { type: 'boolean', default: null })
    .help().alias('help', 'h').argv;

  let keytar;
  try { keytar = require('keytar'); } catch { keytar = null; }
  const { JobConfiguration } = require('./database/models/JobConfiguration');
  const SecurityService = require('./services/SecurityService');
  const jobConfig = new JobConfiguration();
  const securityService = new SecurityService(keytar, jobConfig);

  const openaiKeyRes = await securityService.getSecret('openai');
  const runwareKeyRes = await securityService.getSecret('runware');
  const removeBgKeyRes = await securityService.getSecret('removebg');

  const openaiApiKey = openaiKeyRes.success ? openaiKeyRes.apiKey : null;
  const runwareApiKey = runwareKeyRes.success ? runwareKeyRes.apiKey : null;
  const removeBgApiKey = removeBgKeyRes.success ? removeBgKeyRes.apiKey : null;

  if (!openaiApiKey) console.warn('Warning: OpenAI API key not found in secure storage.');

  const config = {
    removeBg: argv.removeBg ?? (process.env.REMOVE_BG === 'true'),
    imageConvert: argv.imageConvert ?? (process.env.IMAGE_CONVERT === 'true'),
    imageEnhancement: argv.imageEnhancement ?? (process.env.IMAGE_ENHANCEMENT === 'true'),
    sharpening: argv.sharpening ?? (parseFloat(process.env.SHARPENING) || 5),
    saturation: argv.saturation ?? (parseFloat(process.env.SATURATION) || 1.4),
    convertToJpg: argv.convertToJpg ?? (process.env.CONVERT_TO_JPG === 'true'),
    keywordRandom: argv.keywordRandom ?? (process.env.KEYWORD_RANDOM === 'true'),
    trimTransparentBackground: argv.trimTransparentBackground ?? (process.env.TRIM_TRANSPARENT_BACKGROUND === 'true'),
    pollingTimeout: argv.pollingTimeout ?? (process.env.POLLING_TIMEOUT || 10),
    jpgBackground: argv.jpgBackground || process.env.JPG_BACKGROUND || 'white',
    removeBgSize: argv.removeBgSize || process.env.REMOVE_BG_SIZE || 'auto',
    jpgQuality: argv.jpgQuality || parseInt(process.env.JPG_QUALITY, 10) || 100,
    pngQuality: argv.pngQuality || parseInt(process.env.PNG_QUALITY, 10) || 100,
    runQualityCheck: argv.runQualityCheck ?? (process.env.RUN_QUALITY_CHECK !== 'false'),
    runMetadataGen: argv.runMetadataGen ?? (process.env.RUN_METADATA_GEN !== 'false'),
    openaiApiKey, runwareApiKey, removeBgApiKey,
    apiKeys: { openai: openaiApiKey, runware: runwareApiKey, removeBg: removeBgApiKey }
  };

  process.env.DEBUG_MODE = String(argv.debugMode ?? process.env.DEBUG_MODE ?? 'false');

  const pipeline = new ImagePipelineService({
    imageGeneratorService: new ImageGeneratorService(runwareApiKey || '', { logDebug }),
    imageRemoverService: new ImageRemoverService(removeBgApiKey || '', { logDebug }),
    imageProcessorService: new ImageProcessorService({ logDebug })
  });

  let keywordsData = [];
  if (argv.keywordsFile) {
    const ext = path.extname(argv.keywordsFile).toLowerCase();
    keywordsData = ext === '.csv' ? await readCsvFile(argv.keywordsFile) : await readTextFile(argv.keywordsFile);
    if (!keywordsData.length) throw new Error("Keyword file is empty.");
  } else {
    const { KEYWORDS } = require('./constant/keywords_food');
    keywordsData = KEYWORDS.character;
  }

  let customSystemPrompt = argv.mjSystemPrompt ? await fs.readFile(argv.mjSystemPrompt, 'utf8') : null;
  let customMetadataSystemPrompt = argv.metadataSystemPrompt ? await fs.readFile(argv.metadataSystemPrompt, 'utf8') : null;

  try {
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = today.toTimeString().slice(0, 8).replace(/:/g, '');
    const uploadDir = path.resolve(config.outputDirectory || './pictures/toupload');
    await fs.mkdir(uploadDir, { recursive: true });

    const processedImages = [];
    for (let i = 0; i < argv.count; i++) {
      logDebug(`Starting item ${i + 1} of ${argv.count}`);
      try {
        let currentKeywords;
        if (Array.isArray(keywordsData) && keywordsData.length > 0 && typeof keywordsData[0] === 'object') {
          currentKeywords = config.keywordRandom ? keywordsData[Math.floor(Math.random() * keywordsData.length)] : keywordsData[i % keywordsData.length];
        } else {
          currentKeywords = config.keywordRandom ? [keywordsData[Math.floor(Math.random() * keywordsData.length)]] : [keywordsData[i % keywordsData.length]];
        }

        const rawParams = await paramsGeneratorModule(currentKeywords, customSystemPrompt, argv.keywordsFile || '', config);
        const imgNameBase = `${formattedDate}_${timeStr}_${i + 1}`;
        const results = await pipeline.producePictures(rawParams, imgNameBase, customMetadataSystemPrompt, config);
        const images = results?.processedImages || [];
        for (const result of images) processedImages.push(result);
      } catch (error) {
        console.error(`Error processing item ${i + 1}: ${error.message}`);
      }
    }

    if (processedImages.length > 0) {
      console.log(`Successfully generated ${processedImages.length} images.`);
      if (config.runMetadataGen) {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Upload Data');
        ws.columns = [
          { header: 'Image Path', key: 'imagePath', width: 30 },
          { header: 'Title', key: 'title', width: 40 },
          { header: 'Description', key: 'description', width: 60 },
          { header: 'Tags', key: 'tags', width: 40 }
        ];
        ws.addRows(processedImages.map(item => ({
          imagePath: path.basename(item.outputPath),
          title: item.settings?.title?.title?.en || '',
          description: item.settings?.title?.description?.en || '',
          tags: item.settings?.uploadTags?.en || ''
        })));
        const excelPath = path.join(uploadDir, `redbubble_upload_data_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}.xlsx`);
        await workbook.xlsx.writeFile(excelPath);
        console.log(`Excel file created at ${excelPath}`);
      }
    } else {
      logDebug('No valid items generated.');
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  } finally {
    console.log('Script finished.');
  }
})();
