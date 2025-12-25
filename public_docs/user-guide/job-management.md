# Job Management

The Job Management panel provides advanced tools for managing your job history, rerunning jobs, and performing bulk operations.

## Accessing Job Management

1. From the Dashboard, click the menu button (hamburger icon) in the header
2. Select **"Job Management"** from the menu
3. The Job Management page opens as a dedicated full-page view
4. This page provides advanced job management with full history, filtering, and bulk operations

## Job Management Features

### Job Table

The job table shows a full, paginated list of all job executions:
- **Checkbox** - Select jobs for bulk operations (selection persists across pagination)
- **Job Label/ID** - Name or identifier (rerun jobs show as "Parent Label (Rerun execIdShort)")
- **Status** - Completed, Failed, or Running (consistent status labels across all views)
- **Start Time** - When the job started
- **Duration** - How long the job took
- **Image Count** - Number of images generated
- **Actions** - Rerun, view, delete buttons

**Pagination**: The table is paginated for performance. Large job histories are split across multiple pages.

### Filters

Filter jobs by:
- **Status** - All, Completed, Failed, Running
- **Date Range** - Filter by start date
- **Search** - Search by job label or ID

### Sorting

Sort jobs by:
- **Newest First** (default)
- **Oldest First**
- **Name** (alphabetical)

## Rerunning Jobs

You can rerun jobs from multiple locations:

### From Job Management Panel

1. Find the job in the table
2. Click the **Rerun** button (rerun icon)
3. The job starts with the same configuration

### From Dashboard Job History

1. In the Dashboard, scroll to Job History
2. Click the **Rerun** button on any job card
3. The job starts immediately

### From Single Job View

1. Click on a job to open Single Job View
2. Click the **Rerun** button
3. Configure any changes if needed
4. Start the rerun

## Bulk Operations

Perform actions on multiple jobs at once:

### Selecting Jobs

1. Check the boxes next to jobs you want to select
2. Or use **"Select All"** to select all visible jobs
3. The selection count shows: "Select All (X/Y)"

### Bulk Rerun

1. Select two or more jobs
2. Click **"Rerun Selected"**
3. Jobs are queued and run **sequentially** (one at a time, respecting single job constraint)
4. Each job uses its original configuration
5. A queue indicator shows when reruns are scheduled
6. Rerun jobs are labeled as "Parent Label (Rerun execIdShort)" across all views

### Bulk Delete

1. Select jobs to delete
2. Click **"Delete Selected"**
3. Confirm the deletion
4. Jobs and their associated images are removed

### Bulk Export

1. Select jobs to export
2. Click **"Export Selected"**
3. Choose export destination:
   - **Default Exports Folder** - Uses auto-generated unique filename (includes timestamp, so duplicates are not possible)
   - **Custom Location** - Choose a specific folder and optionally customize the filename
4. If using custom location with a custom filename, choose duplicate policy:
   - **Append Number** - Adds a number if file exists (e.g., `bulk_export-1.zip`)
   - **Overwrite** - Replaces existing file
5. A single ZIP file is generated containing:
   - One Excel file (.xlsx) per selected job with all job metadata
   - A summary text file listing all exported jobs
6. The ZIP file is generated and saved
7. The last custom location is remembered for future exports

## Single Job View

Click on any job to see detailed information:

### Job Details

- **Full Configuration** - All settings used
- **Execution Logs** - Complete log history
- **Generated Images** - All images from this job
- **Statistics** - Success rate, duration, etc.

### Configuration Snapshots

Each job execution stores a **configuration snapshot** that captures the exact settings that were used when the job was running. This snapshot:

- **Shows "As-Run" Settings** - The Overview tab displays the configuration snapshot, showing exactly which settings were active when the job executed
- **Excludes API Keys** - For security, API keys are not stored in snapshots
- **Preserves Historical Accuracy** - Even if you edit the job configuration later, the snapshot shows what was actually used during execution
- **Used in Image Modals** - When viewing individual images, the "Processing" tab shows the snapshot settings (or per-image processing settings if a retry with custom settings was used)

**Current Settings vs Snapshot:**
- **Current Settings** - The job configuration that will be used for future reruns (can be edited via Edit Settings)
- **Snapshot Settings** - The exact settings that were used when this specific execution ran (read-only, historical record)

### Single Job Actions

- **Rename** - Edit the job label through the Edit Settings modal (see Settings Editing section below); changes persist to database and reflect across all views
- **Rerun** - Start a new job with same config (queued if another job is running)
- **Export** - Export job results to Excel (.xlsx) with destination selection and duplicate policy
- **Delete** - Remove this job and all associated images (with confirmation)
- **Edit Settings** - Modify job configuration settings, including the job label/name (see Settings Editing section below)

## Settings Editing in Single Job View

You can edit job settings directly from the Single Job View. This is different from the retry flow in Failed Images Review.

### Accessing Settings Edit

1. Open a job in Single Job View
2. Navigate to the **Overview** tab
3. Scroll to the **Settings** section
4. Click the **"Edit"** button (top-right of Settings section)
5. The Settings Edit modal opens

**Note**: You can also rename the job through this Edit modal. The job label/name field is included in the settings that can be edited.

### What You Can Edit

The Edit modal allows you to modify **all job configuration settings**:

#### API Keys Section
- OpenAI API Key
- PI API Key
- Remove.bg API Key

#### File Paths Section
- **Note**: File paths are read-only (reference-only)
- To change file contents, edit the files on disk
- Paths shown here are for reference only

#### Parameters Section
- Process Mode (Relax, Fast, Turbo)
- Aspect Ratios
- MJ Version
- OpenAI Model
- Polling Timeout and Interval
- Enable Polling Timeout toggle
- Random Keywords toggle
- LoRA Models toggle and list
- Runware Advanced settings (when enabled):
  - CFG Scale
  - Steps
  - Scheduler
  - NSFW toggle
  - LoRA models

#### Image Processing Section
- Remove Background toggle
- Remove.bg Size (when remove.bg enabled)
- On remove.bg failure mode (Mark Failed / Approve)
- Image Convert toggle
- Convert Format (PNG/JPG/WEBP when convert enabled)
- JPG Quality (1-100, when converting to JPG)
- WebP Quality (1-100, when converting to WEBP)
- JPG Background Color (when remove.bg + convert to JPG)
- Trim Transparent Background (when remove.bg enabled)
- Image Enhancement toggle
- Sharpening Level (0-10, when enhancement enabled)
- Saturation Level (0-2, when enhancement enabled)

#### AI Features Section
- AI Quality Check toggle
- AI Metadata Generation toggle

#### Advanced Section
- Debug Mode toggle

### Saving Settings

1. Make your changes in the Edit modal
2. Click **"Save Settings"** button
3. Settings are saved to the job configuration
4. The modal closes and Overview tab refreshes
5. **Note**: Saved settings affect future reruns of this job, but do NOT affect already-generated images

### Settings Edit vs Retry Flow

**Settings Edit (Single Job View):**
- Edits the job configuration permanently
- Affects future reruns of the job
- Can edit ALL settings (API keys, parameters, processing, AI features)
- File paths are read-only (reference-only)
- Changes persist to database

**Retry Flow (Failed Images Review):**
- Only configures post-processing settings for retry
- Does NOT change the job configuration
- Only affects the selected images being retried
- Limited to processing settings (enhancement, conversion, remove.bg, metadata)
- Does NOT include API keys, parameters, or file paths
- Settings are applied transiently during retry only

## Job Statistics

View overall statistics:
- **Total Jobs** - All jobs executed
- **Completed** - Successfully finished
- **Failed** - Jobs that encountered errors
- **Average Duration** - Typical execution time
- **Success Rate** - Percentage of successful jobs

## Best Practices

- **Use Job Labels** - Name your jobs in Settings to easily identify them
- **Review Before Rerun** - Check job details before rerunning
- **Clean Up Old Jobs** - Periodically delete old jobs to free up space
- **Export Important Jobs** - Export results before deleting jobs

## Next Steps

- Learn about [Failed Images Review](failed-images-review.md) for managing QC failures
- See [Export Guide](export.md) for exporting results
- Review [Dashboard Usage](dashboard.md) for starting new jobs

