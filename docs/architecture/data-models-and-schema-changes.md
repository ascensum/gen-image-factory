# Data Models and Schema Changes

A new local SQLite database will be introduced with three core models.

* **`JobConfiguration`**: Saves a user's complete set of settings for a generation task, including:
  - **API Keys**: openai, piapi, removeBg (securely stored)
  - **File Paths**: outputDirectory, tempDirectory, systemPromptFile, keywordsFile, qualityCheckPromptFile, metadataPromptFile
  - **Parameters**: processMode, aspectRatios, mjVersion, openaiModel, pollingTimeout, keywordRandom, count
  - **Processing**: removeBg, imageConvert, imageEnhancement, sharpening, saturation, convertToJpg, trimTransparentBackground, jpgBackground, jpgQuality, pngQuality, removeBgSize
  - **AI**: runQualityCheck, runMetadataGen
  - **Advanced**: debugMode

* **`JobExecution`**: Stores the historical record of a specific run of a `JobConfiguration`.

* **`GeneratedImage`**: Stores the results for each individual image, with the following key attributes:
    * `id`, `executionId`
    * `generationPrompt`: The final prompt sent to the image generation API.
    * `seed`: The seed number used for the generation.
    * `qcStatus`: ('Passed', 'Failed').
    * `qcReason`: The reason for failure.
    * `finalImagePath`: The path to the final image file.
    * `metadata`: A JSON object containing the AI-generated `title`, `description`, and `tags`.
    * `processingSettings`: JSON object containing the image processing settings applied:
      - `imageEnhancement`: boolean - Whether image enhancement was applied
      - `sharpening`: number - Sharpening intensity used (0-10)
      - `saturation`: number - Saturation level used (0-2)
      - `imageConvert`: boolean - Whether image conversion was applied
      - `convertToJpg`: boolean - Whether converted to JPG format
      - `jpgQuality`: number - JPG quality setting used (1-100)
      - `pngQuality`: number - PNG quality setting used (1-100)
      - `removeBg`: boolean - Whether background removal was applied
      - `removeBgSize`: string - Remove.bg size setting used
      - `trimTransparentBackground`: boolean - Whether transparent background trimming was applied
      - `jpgBackground`: string - JPG background color setting used

## Security Implementation (Story 1.11)

### API Key Storage Strategy
The application implements a three-tier security approach for API key storage:

#### **Tier 1: Native OS Keychain (Primary)**
- Uses `keytar` library for secure storage
- Stores API keys in native OS credential manager
- Maximum security for production environments
- Platform-specific: Keychain (macOS), Credential Manager (Windows), Secret Service (Linux)

#### **Tier 2: Encrypted Database (Fallback)**
- Encrypts API keys in SQLite database when keytar unavailable
- Uses Node.js `crypto` module for encryption
- Encryption key generated from system entropy
- Secure fallback for environments where keytar fails

#### **Tier 3: Plain Text Database (Development Only)**
- Current implementation for development/testing
- Will be replaced by encrypted database in Story 1.11
- Acceptable for development but not for production

### Security Schema Extensions
```sql
-- Security status tracking
security_storage_method VARCHAR(20) DEFAULT 'keytar',
security_encryption_status VARCHAR(20) DEFAULT 'available',
security_last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- Encrypted API keys (Story 1.11)
encrypted_api_keys TEXT,  -- JSON object with encrypted API keys
encryption_key_hash VARCHAR(64),  -- Hash of encryption key for validation
```

### Memory Protection
- API keys cleared from memory on application exit
- Sensitive data masked in logs and error messages
- Secure string handling for API key operations
- Memory clearing for sensitive data in transit

## New Image Enhancement Schema

### JobConfiguration Processing Fields
The `JobConfiguration` model now includes enhanced processing options with proper feature dependencies:

```sql
-- Processing section in JobConfiguration
processing_removeBg BOOLEAN DEFAULT FALSE,
processing_imageConvert BOOLEAN DEFAULT FALSE,
processing_imageEnhancement BOOLEAN DEFAULT FALSE,  -- NEW: Independent image enhancement toggle
processing_sharpening DECIMAL(3,1) DEFAULT 5.0,     -- NEW: Sharpening intensity (0-10)
processing_saturation DECIMAL(2,1) DEFAULT 1.4,     -- NEW: Saturation level (0-2)
processing_convertToJpg BOOLEAN DEFAULT FALSE,
processing_trimTransparentBackground BOOLEAN DEFAULT FALSE,
processing_jpgBackground VARCHAR(20) DEFAULT 'white',
processing_jpgQuality INTEGER DEFAULT 90,
processing_pngQuality INTEGER DEFAULT 90,
processing_removeBgSize VARCHAR(10) DEFAULT 'auto'
```

### Feature Dependency Logic
The database schema supports the following conditional logic:
- `trimTransparentBackground` requires `removeBg` to be true
- `jpgBackground` requires `removeBg` AND `imageConvert` AND `convertToJpg` to be true
- `imageEnhancement` is independent of `imageConvert` (can be enabled separately)
- Quality settings (`jpgQuality`, `pngQuality`) require `imageConvert` to be true 