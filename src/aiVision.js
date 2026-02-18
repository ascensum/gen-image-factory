const { OpenAI } = require("openai");
const fs = require('fs').promises;
const path = require('path');
const { logDebug } = require(path.join(__dirname, './utils/logDebug'));
const defaultMetadataPrompt = require(path.join(__dirname, './constant/defaultMetadataPrompt'));
const defaultQualityCheckPrompt = require(path.join(__dirname, './constant/defaultQualityCheckPrompt'));

/**
 * Checks the technical quality of an image using OpenAI's Vision API.
 * @param {string} imagePath - Path to the image file.
 * @param {string} openaiModel - The OpenAI model to use.
 * @returns {Promise<object>} - A promise that resolves to an object like { image_quality: 'pass'/'fail', reason: '...' }.
 */
async function runQualityCheck(imagePath, openaiModel = 'gpt-4o', customQualityCheckPrompt = null, apiKey = null) {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  logDebug('--- Starting Image Quality Check ---');
  
  try {
    const imageBase64 = await fs.readFile(imagePath, { encoding: 'base64' });

    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: 'system',
          content: customQualityCheckPrompt || defaultQualityCheckPrompt,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze the following image for technical quality:' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ],
        },
      ],
    });

    let analysis = response.choices?.[0]?.message?.content;
    
    // Guard against null/undefined content (OpenAI may return null on rate-limit, content filter, or model overload)
    if (!analysis) {
      logDebug('Quality Check: OpenAI returned null/empty content. Marking as failed.');
      return { passed: false, reason: 'OpenAI returned empty response for quality check (possible rate-limit or content filter)' };
    }
    
    analysis = analysis.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedAnalysis;
    try {
      parsedAnalysis = JSON.parse(analysis);
    } catch {
      logDebug('Error parsing JSON response. Attempting to extract information from raw response.');
      // If JSON parsing fails, try to extract pass/fail information from the text
      const lowerAnalysis = analysis.toLowerCase();
      const passed = lowerAnalysis.includes('passed: true') || lowerAnalysis.includes('"passed": true') || 
                    lowerAnalysis.includes('pass') || lowerAnalysis.includes('success');
      const failed = lowerAnalysis.includes('passed: false') || lowerAnalysis.includes('"passed": false') || 
                    lowerAnalysis.includes('fail') || lowerAnalysis.includes('failed') ||
                    lowerAnalysis.includes('unable to analyze') || lowerAnalysis.includes('cannot analyze');
      
      // If we can't determine, default to passed to avoid blocking jobs
      const isPassed = passed && !failed;
      
      parsedAnalysis = {
        passed: isPassed,
        reason: `Raw response analysis: ${analysis.substring(0, 200)}...`
      };
    }
    
    logDebug('Quality Check Result:', parsedAnalysis);
    return parsedAnalysis;
  } catch (error) {
    console.error('Error in runQualityCheck:', error);
    throw error;
  }
}

/**
 * Generates a title and tags for an image using OpenAI's Vision API.
 * @param {string} imagePath - Path to the image file.
 * @param {string} promptContext - The original keyword or context for the image.
 * @param {string} customMetadataPrompt - A custom system prompt for metadata generation.
 * @param {string} openaiModel - The OpenAI model to use.
 * @returns {Promise<object>} - A promise that resolves to an object with new_title and uploadTags.
 */
async function generateMetadata(imagePath, promptContext, customMetadataPrompt = null, openaiModel = 'gpt-4o', apiKey = null) {
  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  logDebug('--- Starting Metadata Generation ---');

  try {
    const imageBase64 = await fs.readFile(imagePath, { encoding: 'base64' });
    const systemPromptContent = customMetadataPrompt || defaultMetadataPrompt(promptContext);

    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: systemPromptContent },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and generate metadata based on your instructions.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
            { type: 'text', text: `Please return a single JSON object with the keys "new_title", "new_description", and "uploadTags".` },
          ],
        },
      ],
    });

    let analysis = response.choices?.[0]?.message?.content;
    
    // Guard against null/undefined content (OpenAI may return null on rate-limit, content filter, or model overload)
    if (!analysis) {
      throw new Error('OpenAI returned empty response for metadata generation (possible rate-limit or content filter)');
    }
    
    analysis = analysis.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedAnalysis = JSON.parse(analysis);
    
    // Log the metadata result properly
    console.log(' Metadata Generation Result structure keys:', Object.keys(parsedAnalysis));
    console.log(' Metadata Generation Result length:', JSON.stringify(parsedAnalysis).length, 'characters');
    // logDebug('Metadata Generation Result:', JSON.stringify(parsedAnalysis, null, 2));
    
    return parsedAnalysis;
  } catch (error) {
    console.error('Error in generateMetadata:', error);
    throw error;
  }
}

module.exports = { runQualityCheck, generateMetadata }; 