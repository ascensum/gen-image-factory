# Settings Configuration

The Settings panel is where you configure all aspects of Gen Image Factory before running jobs. Access it from the home screen by clicking "Open Settings".

## Settings Tabs

Settings are organized into six tabs:

- **API Keys** - Configure API credentials
- **File Paths** - Set directories and input files
- **Parameters** - Configure job parameters
- **Processing** - Image processing options
- **AI Features** - Quality check and metadata generation
- **Advanced** - Debug and logging options

## API Keys Tab

Configure API keys for external services:

### Required API Keys

- **OpenAI API Key** - Used for prompt generation, quality checks, and metadata generation
- **Runware API Key** - Used for image generation
- **Remove.bg API Key** - Used for background removal (optional)

### Configuring API Keys

1. Click the **API Keys** tab
2. Enter your API key in the secure input field
3. Use the eye icon to toggle password visibility
4. Keys are automatically saved when you click "Save"

**Security Note**: API keys are stored securely using a tiered approach:
- **Primary Storage**: Your operating system's credential manager (keytar) - most secure option
- **Fallback Storage**: If the credential manager is not available, keys are saved to the local database in encrypted form
- The application automatically uses the most secure storage method available on your system

## File Paths Tab

Configure directories and input files:

### Directories

- **Output Directory** - Where processed images are saved (default: `./pictures/toupload`)
- **Temp Directory** - Where temporary files are stored during processing (default: `./pictures/generated`)

### Input Files

- **System Prompt File** - Custom system prompt template for image generation
- **Keywords File** - Text or CSV file containing keywords for image generation
- **Quality Check Prompt File** - Custom prompt template for AI quality checks
- **Metadata Prompt File** - Custom prompt template for AI metadata generation

### Setting File Paths

1. Click the **File Paths** tab
2. Use the file browser button next to each field to select files or directories
3. Or type the path directly in the input field
4. Click "Save" to persist your settings

## Template Configuration

Gen Image Factory supports customizable templates for keywords, quality checks, and metadata generation. These templates allow you to customize how the AI generates prompts, performs quality checks, and creates metadata.

### Keywords File

The Keywords File provides the source material for image generation prompts. It supports two formats:

#### Text File (.txt)
- **Format**: One keyword per line
- **Usage**: Keywords are selected sequentially (or randomly if "Keyword Random" is enabled)
- **Example**:
  ```
  sunset over ocean
  mountain landscape
  urban cityscape
  ```

#### CSV File (.csv)
- **Format**: Comma-separated values with header row
- **Usage**: Enables advanced templating with variable substitution
- **Template Variables**: Use `${{ColumnName}}` in your System Prompt File to substitute CSV column values
- **Example CSV**:
  ```csv
  Subject,Setting,Style,Mood
  sunset,beach,photorealistic,peaceful
  mountain,forest,cinematic,dramatic
  city,urban,modern,busy
  ```
- **Selection**: 
  - Sequential: Uses rows in order (first row after header, then next, etc.)
  - Random: Picks a random row when "Keyword Random" is enabled

### System Prompt File

The System Prompt File is a custom template that defines how the AI generates image generation prompts.

#### For Text Keywords
- Use placeholders like `{keyword}`, `${keyword}`, or `${{Subject}}` to insert the selected keyword
- Example template:
  ```
  You are an assistant creating high-quality stock photo prompts. 
  Create a professional stock photo description for: {keyword}
  The image should be suitable for commercial use.
  ```

#### For CSV Keywords
- Use `${{ColumnName}}` placeholders to substitute CSV column values
- Example template:
  ```
  Create a professional stock photo of ${{Subject}} in a ${{Setting}} environment.
  Style: ${{Style}}, Mood: ${{Mood}}
  The image should be suitable for commercial stock photography.
  ```
- All CSV column headers can be used as variables in the template

**Note**: If no System Prompt File is provided, a default system prompt is used.

### Quality Check Prompt File

The Quality Check Prompt File customizes how the AI performs quality checks on generated images.

- **Purpose**: Defines the criteria and instructions for quality assessment
- **Usage**: When AI Quality Check is enabled, this template guides the AI's evaluation
- **Critical Requirement**: The prompt **must** instruct the model to return a JSON object with specific keys that the application can parse
- **AI Vision Capabilities**: AI vision models can detect:
  - Copyright or trademark violations (logos, brand names, recognizable characters)
  - Text misspellings or errors in visible text
  - Content policy violations

**Required JSON Format:**
The AI response must be a valid JSON object with these exact keys:
- `passed` - Boolean (true if no issues found, false if any issues detected)
- `reason` - String (explanation of the decision, must include specific details if failed)

**Example Template File:**
```
You are a Quality Assurance system for evaluating generated images.

Your response MUST be a single, clean JSON object with two keys: "passed" and "reason". Do not include any markdown formatting like ```json.

Evaluate the image for:
- Copyright or trademark violations (logos, brand names, recognizable characters)
- Text misspellings or errors in visible text
- Content policy violations

Decision Rules:
- Pass: Image meets quality standards, no copyright risk, no text errors
- Fail: Image has copyright issues, text errors, or content policy violations

Example JSON output:
{
  "passed": false,
  "reason": "Contains misspelled text 'Nike' on a t-shirt, which is a trademarked brand name."
}

{
  "passed": true,
  "reason": "Clean image with no problematic text, recognizable people, brands, or copyright issues. Safe for commercial use."
}
```

**Important Notes:**
- The JSON must be parseable (no markdown code blocks)
- `passed` must be a boolean (true/false)
- `reason` must be a descriptive string explaining the decision
- If the format is incorrect, quality check may fail
- The application will strip markdown code blocks automatically, but the JSON structure must be valid

**Note**: If no Quality Check Prompt File is provided, a default quality check prompt is used.

### Metadata Prompt File

The Metadata Prompt File customizes how the AI generates metadata (titles, descriptions, tags) for images.

- **Purpose**: Defines the format and style for generated metadata
- **Usage**: When AI Metadata Generation is enabled, this template guides the AI's metadata creation
- **Critical Requirement**: The prompt **must** instruct the model to return a JSON object with specific keys that the application can parse

**Required JSON Format:**
The AI response must be a valid JSON object with these exact keys:
- `new_title` - The image title (string)
- `new_description` - The image description (string)
- `uploadTags` - Tags as a comma-separated string or array

**Example Template File:**
```
You are an AI assistant tasked with analyzing an image and generating a suitable title, description, and tags for stock photography and/or print platforms.

Your response MUST be a single, clean JSON object with three keys: "new_title", "new_description", and "uploadTags". Do not include any markdown formatting like ```json.

Here are your instructions:
1.  **Analyze the Image:** Look at the subject, setting, colors, and mood of the image.
2.  **Use Context:** The image was generated using the following prompt: "${promptContext}". Use this to understand the core idea and what the image should represent.
3.  **Generate Title:** Create a descriptive and appealing title for the image, approximately 8-12 words long.
4.  **Generate Description:** Write a brief, engaging description of the image, between 150 and 250 characters.
5.  **Generate Tags:** Create a list of exactly 15 relevant tags. These should be a mix of single words and short 2-3 word phrases, separated by commas.

Example JSON output:
{
  "new_title": "Vibrant Abstract Painting with Swirling Colors",
  "new_description": "A dynamic and expressive abstract artwork featuring a whirlwind of vibrant colors. The fluid strokes and rich textures create a sense of movement and energy, making it a perfect piece for modern decor.",
  "uploadTags": "abstract art, colorful, vibrant, painting, swirling colors, modern art, contemporary, texture, dynamic, artistic, creative expression, multi-colored, fluid art, expressive strokes, gallery piece"
}
```

**Note:** The `${promptContext}` variable is automatically replaced with the full generation prompt that was used to create the image (not just the keyword). This provides complete context about how the image was generated, which helps the AI generate more accurate metadata.

**Why This Matters:** The vision model may not always accurately identify specific subjects in images (e.g., exotic fruits, specialized objects, or abstract concepts). By including the original generation prompt in the metadata template, the AI has the context it needs to generate accurate titles, descriptions, and tags even when visual identification alone might be uncertain. For example, if an image shows an exotic fruit like "dragon fruit" or "rambutan", the prompt context ensures the metadata correctly identifies it even if the vision model might struggle with the identification.

**Important Notes:**
- The JSON must be parseable (no markdown code blocks)
- `uploadTags` can be a comma-separated string or an array
- If the format is incorrect, metadata generation may fail
- The application will strip markdown code blocks automatically, but the JSON structure must be valid

**Note**: If no Metadata Prompt File is provided, a default metadata generation prompt is used.

### Template Best Practices

1. **Test Templates**: Start with simple templates and refine based on results
2. **Variable Names**: When using CSV files, ensure column headers match template variables exactly (case-sensitive)
3. **File Format**: 
   - **Keywords File**: Plain text (.txt) or CSV (.csv) format
   - **System Prompt File**: Plain text (.txt) format only
   - **Quality Check Prompt File**: Plain text (.txt) format only
   - **Metadata Prompt File**: Plain text (.txt) format only
4. **Encoding**: Use UTF-8 encoding for template files to support special characters
5. **Line Breaks**: Templates preserve line breaks, so format your prompts for readability
6. **Keyword Selection**: Use "Keyword Random" toggle to vary keyword selection, or leave it off for sequential processing

## Parameters Tab

Configure job execution parameters for image generation:

### Job Configuration

- **Job Label** - Optional name for your job (helps identify jobs in history and job management)
  - If not specified, a default label will be automatically generated in the format: `job_YYYYMMDD_HHMMSS` (e.g., `job_20250115_143022`)
  - The default label is based on the timestamp when the job starts
- **Runware Model** - AI model for image generation (default: `runware:101@1`)
  - Runware is an aggregator that provides access to various image generation models
  - External vendor models include OpenAI, Google, X, Midjourney, and other leading Gen Image vendors
  - Different models may have different capabilities and styles
  - **Note**: External vendor models (OpenAI, Google, X, Midjourney, etc.) usually do not support Runware Advanced settings. LoRA models are supported by open-source image generation models (like SD, Flux dev, Qwen, Wan, SDXL), not by external vendor models.
- **Runware Dimensions** - Comma-separated dimensions for image size (e.g., `1024x1024,1280x720`)
  - Multiple dimensions can be specified, separated by commas
  - Format: `WIDTHxHEIGHT` (e.g., `1024x1024` for square, `1280x720` for landscape)
  - **Multiple Generations**: When multiple generations are enabled (Count > 1), each generation uses one dimension sequentially
  - Example: If dimensions are `1024x1024,1280x720` and Count is 2 with 1 variation, the first image will be `1024x1024` and the second image will be `1280x720`
  - If there are more generations than dimensions, dimensions cycle back to the beginning
- **Runware Format** - Output format: PNG, JPG, or WEBP
  - PNG: Lossless format, supports transparency
  - JPG: Compressed format, smaller file size
  - WEBP: Modern format with good compression and quality
- **OpenAI Model** - Model for prompt generation, quality checks, and metadata generation (default: `gpt-4o`)
  - Can use any OpenAI vision-capable model that supports chat completions (e.g., `gpt-4o`, `gpt-4o-mini`, or other OpenAI vision-capable models)
  - Used for generating image prompts from keywords
  - Also used for AI Quality Check and AI Metadata Generation features
  - **Note**: The model must be an OpenAI vision-capable model for quality checks and metadata generation to work properly

### LoRA Models

- **LoRA Models Toggle** - Enable/disable LoRA (Low-Rank Adaptation) model support
- **LoRA List** - List of LoRA models with optional weights (one per line)
  - Format: `model:weight` (e.g., `flux-lora:0.8`)
  - Weight defaults to 1 if not specified
  - Multiple models can be listed, one per line
  - Example:
    ```
    flux-lora:0.8
    artist-style:1.2
    custom-model
    ```
- **Note**: LoRA models are supported by open-source image generation models (like SD, Flux dev, Qwen, Wan, SDXL), not by external vendor models (OpenAI, Google, X, Midjourney, etc.).

### Runware Advanced Settings

- **Runware Advanced Toggle** - Enable/disable advanced Runware parameters
- When enabled, the following advanced options become available:
  - **CFG Scale** - Classifier-Free Guidance scale (controls how closely the model follows the prompt)
  - **Steps** - Number of diffusion steps (more steps = higher quality but slower)
  - **Scheduler** - Sampling scheduler algorithm
  - **NSFW Toggle** - Enable/disable NSFW content filtering
  - **LoRA Models** - Advanced LoRA configuration (note: LoRA can also be configured independently via the LoRA Models section above)

**Important Notes**: 
- When Runware Advanced is disabled, advanced parameters are not sent to the API, even if values are set.
- **Model Compatibility**: Runware Advanced settings are typically supported by open-source diffusion architecture models (SD, Flux dev, Qwen, Wan, SDXL, etc.). External vendor models (OpenAI, Google, X, Midjourney, etc.) usually do not support these advanced parameters. Note that LoRA models work similarly - they are also supported by open-source models, not by external vendor models.

### Execution Settings

- **Generation Timeout** - Maximum time to wait for image generation (in minutes)
  - **Enable Polling Timeout Toggle** - Enable/disable timeout enforcement
  - **Timeout Value** - Adjust slider when enabled (default: 15 minutes)
  - When enabled, generation will timeout if not completed within the specified time
  - When disabled, uses a default 30-second timeout for network operations
- **Polling Interval** - How often to check for generation completion (in seconds, default: 1 second)
- **Keyword Random** - Toggle to pick keywords randomly instead of sequentially
  - When enabled: Randomly selects from available keywords
  - When disabled: Uses keywords in order from the file
- **Generations Count** - Number of generations to create (1-2500, default: 1)
  - Each generation creates one set of images based on the variations setting
  - Up to 2500 generations per job
- **Variations per Generation** - Number of variations to generate per generation (1-20, default: 1)
  - Each generation will produce this many variations
  - Up to 20 variations per generation
  - **Note**: Variation limits vary per vendor/model. Different models may support different maximum variation counts. Users should validate model settings limitations from the Runware site to ensure compatibility with their chosen model.
- **Total Images Calculation**: Total images = Generations × Variations (capped at 10,000 images)
  - Example: 5 generations × 4 variations = 20 total images
  - If the total exceeds 10,000, the system will automatically adjust the values to stay within the limit

## Processing Tab

Configure image processing options for post-generation editing:

### Background Removal

- **Remove Background** - Toggle to enable background removal using remove.bg service
  - Requires Remove.bg API Key to be configured
  - Removes background from generated images
  - **Important Note**: Background removal is not always capable of accurately distinguishing foreground from background and may fail to remove the background. It works best with certain types of generations where the background is clearly separated from the foreground, such as:
    - T-shirt or sticker designs
    - Graphical assets on solid backgrounds
    - Images with distinct subject-background separation
- **Remove.bg Size** - Output size option (appears when Remove Background is enabled)
  - Options: `auto`, `preview`, `full`, `50MP`
  - `auto`: Automatically determines best size
  - `preview`: Smaller, faster processing
  - `full`: Full resolution
  - `50MP`: Maximum quality (50 megapixels)
- **On remove.bg failure** - Behavior when background removal fails
  - **Mark Failed (technical fail)**: Image is marked as failed if remove.bg fails
  - **Approve (soft fail)**: Image continues processing even if remove.bg fails
- **Trim Transparent Background** - Toggle to automatically trim excess transparent areas (appears when Remove Background is enabled)
  - Removes excess transparent background around the subject
  - Only applies to PNG and WEBP formats (JPG doesn't support transparency)

### Image Conversion

- **Image Convert** - Master toggle for image format conversion
  - When enabled, images are converted to the specified format
  - When disabled, images keep their original format
- **Convert Format** - Target format for conversion (appears when Image Convert is enabled)
  - Options: PNG, JPG, WEBP
  - PNG: Lossless format, supports transparency
  - JPG: Compressed format, smaller file size, no transparency
  - WEBP: Modern format with good compression and quality
- **JPG Quality** - Quality setting for JPG output (1-100, appears when converting to JPG)
  - Default: 85
  - Higher values = better quality but larger file size
  - Lower values = smaller file size but lower quality
- **WebP Quality** - Quality setting for WEBP output (1-100, appears when converting to WEBP)
  - Default: 85
  - Higher values = better quality but larger file size
  - Lower values = smaller file size but lower quality
- **JPG Background Color** - Background color for JPG conversion (appears when Remove Background + Convert to JPG are both enabled)
  - Options: White, Black
  - Used when converting transparent images (PNG/WEBP) to JPG format
  - JPG doesn't support transparency, so a background color is needed

**Note**: PNG conversion is always lossless (no quality control). PNG Quality setting is not available.

### Image Enhancement

- **Image Enhancement** - Independent toggle for image enhancement effects
  - Can be enabled regardless of image conversion settings
  - Applies sharpening and saturation adjustments
- **Sharpening Level** - Intensity level for sharpening (0-10, appears when Image Enhancement is enabled)
  - Default: 5
  - 0 = No sharpening
  - 10 = Maximum sharpening
  - Adjusts image clarity and detail
- **Saturation Level** - Saturation level for color intensity (0-2, appears when Image Enhancement is enabled)
  - Default: 1.4
  - 0 = Grayscale (no color)
  - 1 = Normal saturation
  - 2 = Maximum saturation (very vibrant colors)

**Note**: Image enhancement is independent of image conversion. You can enable enhancement even if image conversion is disabled, providing flexible image processing options.

## AI Features Tab

Configure AI-powered features:

- **AI Quality Check** - Toggle to automatically check image quality
- **AI Metadata Generation** - Toggle to generate titles, descriptions, and tags

**Note**: These features use OpenAI API and incur costs per image. You can enable or disable them independently based on your needs.

## Advanced Tab

Configure advanced options:

- **Debug Mode** - Toggle to enable detailed logging for troubleshooting

## Saving and Resetting

### Save Settings

1. Make your configuration changes
2. Click the **"Save"** button at the bottom of the settings panel
3. Settings are persisted immediately

### Reset Settings

1. Click the **"Reset"** button
2. Confirm the reset in the dialog
3. All settings return to defaults

## Keyboard Navigation

You can navigate between tabs using:
- Click tabs with mouse
- Tab key to move between fields
- Enter to activate buttons

## Next Steps

After configuring settings:
- See [Dashboard Usage](dashboard.md) to start your first job
- Review [Job Management](job-management.md) for advanced workflows

