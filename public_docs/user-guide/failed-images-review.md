# Failed Images Review

The Failed Images Review panel helps you manage images that failed for any reason - including quality checks, processing failures, and retry attempts.

## Accessing Failed Images Review

1. From the Dashboard, click the menu button (hamburger icon) in the header
2. Select **"Failed Images Review"** from the menu
3. The Failed Images Review page opens as a separate dedicated view
4. This page is separate from the main Dashboard, which shows only success images

## Understanding Failed Images

The Failed Images Review panel shows images that failed for various reasons, not just quality check failures. Images can fail due to:

### Quality Check Failures

Images that fail AI quality checks show:
- **Failure Reason**: Specific reason provided by the AI model (e.g., copyright issues, text misspellings, content violations)
- **Original Prompt**: The prompt used to generate the image
- **Image Preview**: Thumbnail of the failed image

### Technical Processing Failures

Images can also fail during post-processing steps. These technical failures include:

- **Download Failed** - The system failed to download the image from the API
- **Background Removal Failed** - Background removal service (remove.bg) failed or timed out
- **Trim Failed** - The system couldn't trim transparent edges (image kept untrimmed)
- **Enhancement Failed** - Image enhancement operations failed
- **Conversion Failed** - The system couldn't encode to the target format (JPG/WEBP/PNG)
- **Save Failed** - The system failed to save the final image output
- **Metadata Failed** - The system failed to generate metadata for the image
- **QC Analysis Failed** - The system failed to receive QC analysis response

The Failed Images Review shows images that failed for different reasons, except for those that did not get generated at all.

### Retry Failures

Images that failed during retry attempts show:
- **Failure Reason**: Why the retry failed (same failure types as above)
- **Original Settings**: Configuration used for retry

## Reviewing Failed Images

### Image Cards

Each failed image is displayed as a card showing:
- Image thumbnail
- Failure reason
- Generation prompt
- Actions available

### Viewing Image Details

1. Click **"View"** on any image card
2. The review modal opens showing:
   - Full-size image
   - Complete metadata
   - Failure details
   - All available actions

## Managing Failed Images

### Approve Image

If an image failed but you want to use it:

1. Click **"Approve"** on the image card or in the modal
2. The image is manually approved
3. **The image automatically appears in the main Dashboard Panel as a 'Success' image**
4. It moves to your output directory
5. The image is removed from the failed images list

### Delete Image

To permanently remove a failed image:

1. Click **"Delete"** on the image card or in the modal
2. Confirm the deletion
3. The image is permanently removed

### Add to Retry Pool

Queue an image for retry:

1. Open the image in the review modal
2. Click **"Add to Retry Pool"**
3. The image is added to the retry queue
4. You can configure retry settings later

## Batch Operations

Process multiple failed images at once:

### Selecting Images

1. Check boxes next to images you want to process
2. Or use **"Select All"** to select all failed images
3. Selection count shows: "Select All (X/Y)"

### Batch Retry

Retry multiple images with consistent settings (all images in batch use identical settings):

1. Select images to retry
2. Click **"Retry Selected"**
3. The **Retry Processing Settings** modal opens
4. Choose retry method (you can only choose one option for the entire batch):
   - **Retry with Original Settings** - Use the original job's post-processing settings
     - Only available when all selected images are from the same job execution
     - Uses the exact settings from the original job
     - Fastest option, good when failure was likely temporary
   - **Retry with Modified Settings** - Apply new post-processing settings to all images in the batch
     - Available for any selection (single or multiple jobs)
     - Allows you to configure new processing options
5. Configure retry options:
   - **Metadata Regeneration** - Checkbox to regenerate AI metadata (titles, descriptions, tags) during retry
   - **Fail Retry Controls** (Modified Settings only):
     - Toggle to enable hard-fail mode for specific steps
     - When ON: Selected steps will hard-fail the retry if they error
     - When OFF: Defaults apply (Remove.bg soft, Trim hard, Convert/Save hard, Metadata soft, Enhancement soft)
     - Multi-select dropdown for steps: Remove Background, Trim Transparent, Enhancement, Convert/Save, Metadata
6. If using Modified Settings, configure processing options:
   - **Image Enhancement** - Enable sharpening and saturation effects
   - **Sharpening Level** (0-10) - Only shown when enhancement enabled
   - **Saturation Level** (0-2) - Only shown when enhancement enabled
   - **Image Convert** - Enable format conversion
   - **Convert Format** - Choose PNG, JPG, or WEBP (only shown when convert enabled)
   - **JPG Quality** (1-100) - Only shown when converting to JPG
   - **WebP Quality** (1-100) - Only shown when converting to WEBP
   - **Remove Background** - Enable background removal
   - **Remove.bg Size** - Choose Auto, Preview, Full, or 50MP (only shown when remove.bg enabled)
   - **Trim Transparent Background** - Only shown when remove.bg enabled
   - **JPG Background Color** - White or Black (only shown when remove.bg + convert to JPG)
7. Click **"Start Retry"** to queue the batch
8. Images are queued for retry processing
9. **Important**: Retry runs post-processing only (does NOT re-generate images or run quality checks)
10. Respects single job constraint (queued if another job is running)
11. Progress is shown in the Retry Queue Status section

### Batch Approve

Approve multiple images at once:

1. Select images to approve
2. Click **"Approve Selected"**
3. All selected images are approved and moved to output

### Batch Delete

Delete multiple images:

1. Select images to delete
2. Click **"Delete Selected"**
3. Confirm the deletion
4. All selected images are permanently removed

## Retry Processing Details

### What Retry Does

Retry processing **only runs post-processing steps** - it does NOT:
- Re-generate images from prompts
- Re-run quality checks
- Call the image generation API

Retry only processes existing images through:
- Background removal (if enabled)
- Image enhancement (if enabled)
- Format conversion (if enabled)
- Metadata generation (if enabled)

### Original Settings vs Modified Settings

**Original Settings:**
- Uses the exact same post-processing configuration as the original job
- Only available when all selected images are from the same job execution
- Fastest option - no configuration needed
- Good when failure was likely temporary (network timeout, service hiccup)

**Modified Settings:**
- Allows you to configure new post-processing settings
- Available for any selection (single or multiple jobs)
- Useful when original settings caused the failure
- You can adjust:
  - Image enhancement parameters
  - Format conversion settings
  - Background removal options
  - Metadata regeneration
  - Fail retry behavior for specific steps

## Filtering and Viewing Failed Images

### Status Tabs

The Failed Images Review panel has multiple tabs to help you organize and manage failed images:

- **Failed** - Images that failed quality checks or technical processing
- **Retry Pending** - Images queued for retry processing
- **Processing** - Images currently being retried
- **Retry Failed** - Images that failed during retry attempts

### Additional Filters

- **Job Filter** - Filter by source job (dropdown with search)
- **Search** - Search by prompt text or image ID
- **Sort** - Sort by newest, oldest, or name

### View Modes

- **Grid View** - Card layout with thumbnails (default)
- **List View** - Table format with columns for Status, Failure Reason, Job Label, etc.

## Best Practices

- **Review Failure Reasons** - Understand why images failed before retrying
- **Approve Selectively** - Only approve images that meet your quality standards
- **Retry with Modifications** - Adjust settings if original configuration caused failures
- **Clean Up Regularly** - Delete images you don't plan to use or retry

## Next Steps

- Learn about [Job Management](job-management.md) for managing job history
- See [Dashboard Usage](dashboard.md) for starting new jobs
- Check [Troubleshooting](/docs/troubleshooting/common-issues) for common issues

