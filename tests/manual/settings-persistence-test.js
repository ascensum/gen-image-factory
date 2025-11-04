#!/usr/bin/env node

/**
 * Manual Test: Settings Persistence
 * 
 * This script tests that settings are being saved to the database correctly.
 * Run this to verify the backend integration is working.
 */

const { BackendAdapter } = require('../../src/adapter/backendAdapter');

async function testSettingsPersistence() {
  console.log(' Testing Settings Persistence...\n');
  
  const backendAdapter = new BackendAdapter();
  
  try {
    // Test 1: Load default settings
    console.log('1️⃣ Loading default settings...');
    const defaultResult = await backendAdapter.getSettings();
    console.log(' Default settings loaded:', defaultResult.success);
    console.log('   - API Keys:', Object.keys(defaultResult.settings.apiKeys));
    console.log('   - File Paths:', Object.keys(defaultResult.settings.filePaths));
    console.log('   - Parameters:', Object.keys(defaultResult.settings.parameters));
    console.log('   - Processing:', Object.keys(defaultResult.settings.processing));
    console.log('   - AI:', Object.keys(defaultResult.settings.ai));
    console.log('   - Advanced:', Object.keys(defaultResult.settings.advanced));
    
    // Test 2: Save test settings
    console.log('\n2️⃣ Saving test settings...');
    const testSettings = {
      apiKeys: {
        openai: 'test-openai-key-123',
        piapi: 'test-piapi-key-456',
        removeBg: 'test-removebg-key-789'
      },
      filePaths: {
        outputDirectory: './test-output',
        tempDirectory: './test-temp',
        systemPromptFile: './test-system-prompt.txt',
        keywordsFile: './test-keywords.txt',
        qualityCheckPromptFile: './test-quality-check.txt',
        metadataPromptFile: './test-metadata.txt'
      },
      parameters: {
        processMode: 'relax',
        aspectRatios: '1:1,16:9',
        mjVersion: '6.1',
        openaiModel: 'gpt-4o',
        pollingTimeout: 20,
        enablePollingTimeout: true,
        keywordRandom: true,
        count: 5
      },
      processing: {
        removeBg: true,
        imageConvert: true,
        imageEnhancement: true,
        sharpening: 7,
        saturation: 1.2,
        convertToJpg: true,
        trimTransparentBackground: true,
        jpgBackground: 'black',
        jpgQuality: 90,
        pngQuality: 95,
        removeBgSize: '4k'
      },
      ai: {
        runQualityCheck: true,
        runMetadataGen: false
      },
      advanced: {
        debugMode: true
      }
    };
    
    const saveResult = await backendAdapter.saveSettings(testSettings);
    console.log(' Test settings saved:', saveResult.success);
    
    // Test 3: Load settings back
    console.log('\n3️⃣ Loading saved settings...');
    const loadResult = await backendAdapter.getSettings();
    console.log(' Settings loaded:', loadResult.success);
    
    // Test 4: Verify key fields were saved
    const loadedSettings = loadResult.settings;
    console.log('\n4️⃣ Verifying saved settings...');
    
    const checks = [
      { field: 'API Keys - OpenAI', expected: 'test-openai-key-123', actual: loadedSettings.apiKeys.openai },
      { field: 'File Paths - Output Directory', expected: './test-output', actual: loadedSettings.filePaths.outputDirectory },
      { field: 'Parameters - Polling Timeout', expected: 20, actual: loadedSettings.parameters.pollingTimeout },
      { field: 'Parameters - Enable Polling Timeout', expected: true, actual: loadedSettings.parameters.enablePollingTimeout },
      { field: 'Parameters - Count', expected: 5, actual: loadedSettings.parameters.count },
      { field: 'Processing - Remove Background', expected: true, actual: loadedSettings.processing.removeBg },
      { field: 'Processing - Image Enhancement', expected: true, actual: loadedSettings.processing.imageEnhancement },
      { field: 'Processing - Sharpening', expected: 7, actual: loadedSettings.processing.sharpening },
      { field: 'Processing - Saturation', expected: 1.2, actual: loadedSettings.processing.saturation },
      { field: 'AI - Run Quality Check', expected: true, actual: loadedSettings.ai.runQualityCheck },
      { field: 'AI - Run Metadata Gen', expected: false, actual: loadedSettings.ai.runMetadataGen },
      { field: 'Advanced - Debug Mode', expected: true, actual: loadedSettings.advanced.debugMode }
    ];
    
    let allPassed = true;
    checks.forEach(check => {
      const passed = check.actual === check.expected;
      console.log(`   ${passed ? '' : ''} ${check.field}: ${check.actual} ${passed ? '' : `(expected: ${check.expected})`}`);
      if (!passed) allPassed = false;
    });
    
    // Test 5: Test API key storage (with fallback)
    console.log('\n5️⃣ Testing API key storage...');
    const setKeyResult = await backendAdapter.setApiKey('openai', 'test-key-123');
    console.log(' API key set:', setKeyResult.success);
    
    const getKeyResult = await backendAdapter.getApiKey('openai');
    console.log(' API key retrieved:', getKeyResult.success);
    console.log('   - Key value:', getKeyResult.apiKey ? '***' + getKeyResult.apiKey.slice(-3) : '(empty)');
    
    // Summary
    console.log('\n Test Summary:');
    console.log(`   - Settings Save: ${saveResult.success ? ' PASS' : ' FAIL'}`);
    console.log(`   - Settings Load: ${loadResult.success ? ' PASS' : ' FAIL'}`);
    console.log(`   - Data Persistence: ${allPassed ? ' PASS' : ' FAIL'}`);
    console.log(`   - API Key Storage: ${setKeyResult.success && getKeyResult.success ? ' PASS' : '️  PARTIAL (keychain may be disabled)'}`);
    
    if (allPassed && saveResult.success && loadResult.success) {
      console.log('\n ALL TESTS PASSED! Settings persistence is working correctly.');
      console.log('\n Next steps:');
      console.log('   1. Open the Electron app');
      console.log('   2. Go to Settings');
      console.log('   3. Make changes and click Save');
      console.log('   4. Restart the app to verify persistence');
    } else {
      console.log('\n️  Some tests failed. Check the console for details.');
    }
    
  } catch (error) {
    console.error(' Test failed:', error);
  } finally {
    // Clean up
    if (backendAdapter) {
      backendAdapter.forceStopAll();
    }
  }
}

// Run the test
testSettingsPersistence();
