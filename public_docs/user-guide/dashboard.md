# Dashboard Overview

The Dashboard is the main control center for Gen Image Factory. From here you can start jobs, monitor progress, view results, and manage your job history.

## Accessing the Dashboard

1. From the home screen, click **"Open Dashboard"**
2. The dashboard displays:
   - Current Job section (when a job is running)
   - Job History section
   - Generated Images gallery

## Starting a Job

### Basic Job Start

1. Click the **"Start Job"** button in the dashboard header
2. The button changes to "Starting..." while the job initializes
3. Once running, the button changes to **"Stop Job"**

### Job Configuration

Jobs use the configuration from your Settings panel. Make sure you've configured:
- API keys (OpenAI, Runware)
- File paths (keywords file, output directory)
- Processing parameters

## Monitoring Job Progress

While a job is running, you'll see:

### Progress Indicator

The progress indicator shows generation progress:
- **Single Generation (1 image)**: Shows 0% while running, 100% on completion
- **Multiple Generations (N images)**: Progress = (images completed / total images) × 100%
- **With Quality Check Enabled**: Progress caps at 95% until QC completes, then reaches 100%

- **Current Step** - Shows which step is active (e.g., "Step 1/2: Initialization")
- **Progress Percentage** - Visual progress bar with generation count
- **Status Badge** - Shows "Job Running" with a spinner

### Real-time Logs

The log viewer displays:
- **Standard Mode** - User-friendly messages like "Step 1/2: Initialization"
- **Debug Mode** - Detailed technical logs (enable in Settings → Advanced)

Switch between modes using the toggle in the log viewer.

### Job Information

- **Job ID** - Unique identifier for this job
- **Job Label** - Name you assigned (if set in Settings)
- **Started At** - When the job began
- **Current Step** - What the job is currently doing

## Stopping a Job

### Normal Stop

1. Click the **"Stop Job"** button
2. The job will finish its current step and then stop gracefully
3. The "Start Job" button becomes enabled again

### Force Stop

If a job is stuck or unresponsive:

1. Click the **"Force Stop"** button (in the menu or header)
2. Confirm the action in the dialog
3. All processes are immediately terminated

**Warning**: Force stop may leave incomplete work. Use only when necessary.

## Single Job Constraint

**Important**: Only one job can run at a time. When a job is running:
- The "Start Job" button is disabled
- You cannot start a new job until the current one completes or is stopped

This ensures system stability and prevents resource conflicts.

## Job History

The Job History section shows a recent overview of your job executions (approximately the last 20 runs):

### Viewing Job History

- Jobs are listed with most recent first
- Each job shows:
  - Job label or ID (rerun jobs show as "Parent Label (Rerun execIdShort)")
  - Status (Completed, Failed, Running)
  - Start time
  - Duration
  - Number of images generated

### Job History Actions

From the job history overview, you can:
- **View Details** - Click on a job to open Single Job View with full details
- **Rerun** - Start a new job with the same configuration (rerun icon button)
- **Export** - Export job results to Excel
- **Delete** - Remove a job from history

**Note**: The Dashboard Job History is an overview only. For full job management, bulk operations, and advanced filtering, use the Job Management page (accessible from the menu).

## Generated Images Gallery

View successfully generated images (approved images that passed quality checks):

### Gallery Features

- **Grid View** - Thumbnail grid of all success images
- **List View** - Detailed list with metadata
- **Filter by QC Status** - Filter by Approved, QC Failed, Processing, Retry Pending, Retry Failed
- **Filter by Job** - Show images from a specific job
- **Search** - Search by prompt, title, description, or tags
- **Date Range** - Filter by creation date
- **Sort** - Sort by newest, oldest, or name

### Image Count Indicators

The gallery shows image counts:
- **Total** - Total number of images
- **Pass** (green) - Images that passed QC
- **Fail** (red) - Images that failed QC
- **Pending** (yellow) - Images pending QC

### Image Actions

- **View** - Click an image to see full size and metadata in a detailed modal
- **Export ZIP** - Export selected images as ZIP with Excel metadata
- **Bulk Actions** - Select multiple images for batch operations
- **Delete** - Remove images from the gallery

**Note**: Failed images are managed in the separate Failed Images Review page (accessible from the menu).

## Navigation Menu

Access additional features from the dashboard menu (hamburger icon):

- **Job Management** - Advanced job management and bulk operations
- **Failed Images Review** - Review and manage images that failed for any reason (quality checks, technical processing failures, retry failures)
- **Settings** - Return to settings configuration

## Job Statistics

The dashboard displays overall statistics:
- **Total Jobs** - Number of jobs executed
- **Success Rate** - Percentage of successful completions
- **Average Duration** - Typical time for job completion
- **Total Images** - Total images generated across all jobs

Statistics update automatically as you run more jobs.

## Next Steps

- Learn about [Job Management](job-management.md) for advanced features
- See [Failed Images Review](failed-images-review.md) for managing failed images (QC failures, technical processing failures, retry failures)
- Check [Troubleshooting](../../troubleshooting/common-issues.md) if you encounter issues

