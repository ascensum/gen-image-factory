# Exporting Results

Gen Image Factory provides several ways to export your job results and generated images.

## Export Options

### Excel Export

Export job metadata to Excel (.xlsx) format for analysis.

**What's Included:**
- Image file paths
- Generated titles and descriptions
- Tags and metadata
- Quality check status
- Job information

**How to Export:**

1. **From Single Job View:**
   - Open a job's details (click on a job from Dashboard or Job Management)
   - Click **"Export to Excel"**
   - Choose export destination:
     - **Default Exports Folder** - Saves to default location with auto-generated unique filename (includes timestamp and job ID)
     - **Custom Location** - Choose a specific folder and optionally customize the filename
   - If using custom location with a custom filename, choose duplicate policy (append number or overwrite)
   - File is generated and saved
   - On success, the file location is revealed in Finder/Explorer

2. **From Job Management (Bulk Export):**
   - Select one or more jobs
   - Click **"Export Selected"**
   - Choose export destination:
     - **Default Exports Folder** - Uses auto-generated unique filename (includes timestamp, so duplicates are not possible)
     - **Custom Location** - Choose a specific folder and optionally customize the filename
   - If using custom location with a custom filename, choose duplicate policy (append number or overwrite)
   - A single ZIP file is generated containing:
     - One Excel file (.xlsx) per selected job with all job metadata
     - A summary text file (`export_summary.txt`) listing all exported jobs
   - ZIP file is generated and saved

### ZIP Export

Export images and metadata as a ZIP archive.

**What's Included:**
- All generated images from selected jobs/images
- Excel file with metadata
- Job configuration summary

**How to Export:**

1. **From Dashboard Image Gallery:**
   - Select images to export (checkbox selection)
   - Click **"Export ZIP"** button
   - Choose export destination:
     - **Default Exports Folder** - Saves to default location
     - **Custom Location** - Choose a specific folder
   - Choose whether to include Excel metadata (checkbox)
   - Choose duplicate policy (append number or overwrite)
   - Wait for export to complete (progress shown: gathering files → creating excel → zipping)
   - On success, ZIP location is revealed in Finder/Explorer

**ZIP Structure:**
```
exported-images-YYYY-MM-DD-HHMMSS.zip
├── images/
│   ├── image1.jpg
│   ├── image2.png
│   └── ...
└── metadata.xlsx (if included)
```

## Export Workflow

### Single Job Export (Excel)

1. Open the job in Single Job View (click on a job from Dashboard or Job Management)
2. Click **"Export to Excel"** button
3. Choose export destination:
   - **Default Exports Folder** - Uses auto-generated unique filename (includes timestamp and job ID, so duplicates are not possible)
   - **Custom Location** - Choose a specific folder and optionally customize the filename
4. If using custom location with a custom filename, choose duplicate policy (append number or overwrite)
5. A single Excel file (.xlsx) is generated with job metadata, images data, and settings in multiple columns
6. File location is revealed in Finder/Explorer on success
7. Last custom location is remembered for future exports

### Bulk Job Export (ZIP)

1. In Job Management, select multiple jobs (checkboxes)
2. Click **"Export Selected"** button
3. Choose export destination:
   - **Default Exports Folder** - Uses auto-generated unique filename (includes timestamp, so duplicates are not possible)
   - **Custom Location** - Choose a specific folder and optionally customize the filename
4. If using custom location with a custom filename, choose duplicate policy (append number or overwrite)
5. A single ZIP file is generated containing:
   - One Excel file (.xlsx) per selected job with all job metadata
   - A summary text file listing all exported jobs
6. ZIP file is generated and saved
7. Last custom location is remembered

### Image Gallery Export (ZIP)

1. In Dashboard Image Gallery, select images to export
2. Click **"Export ZIP"** button
3. Choose export destination
4. Choose whether to include Excel metadata
5. Choose duplicate policy
6. Wait for export progress (gathering files → creating excel → zipping)
7. ZIP file is created with images and optional metadata.xlsx
8. File location is revealed on success

## Export Progress

During ZIP exports, you'll see progress indicators:
- **Gathering Files** - Collecting images and metadata
- **Creating Excel** - Generating metadata spreadsheet
- **Zipping** - Compressing files into archive

## Using Exported Data

### Excel Files

Open in spreadsheet applications:
- **Microsoft Excel**
- **Google Sheets**
- **LibreOffice Calc**

Use for:
- Analyzing image metadata
- Creating reports
- Sharing results with team members
- Tracking quality metrics

**Photo Stock Uploads:**
Excel (.xlsx) files can be easily converted to CSV format for direct upload to photo stock platforms:
- **Adobe Stock** - Convert Excel to CSV and upload with metadata
- **Other Stock Platforms** - Most platforms accept CSV format for bulk uploads
- **Conversion**: Open the Excel file in any spreadsheet application and save as CSV format

### ZIP Archives

Extract to access:
- Image files in organized folders
- Excel metadata file
- Job configuration details

Use for:
- Creating backups
- Sharing complete job results
- Archiving old jobs
- Moving images to other systems

## Export Best Practices

- **Export Regularly** - Export important jobs before deleting
- **Use Descriptive Names** - Name exports with job labels or dates
- **Selective Export** - Export only what you need to save space
- **Verify Exports** - Check that exports contain expected data

## Export Limitations

- Exports are limited to completed jobs
- Large exports may take time to generate
- Ensure sufficient disk space for exports
- ZIP exports include all images, which can be large

## Troubleshooting Exports

### Export Fails

1. Check disk space
2. Verify job is completed
3. Check file permissions
4. Review application logs

### Missing Images in Export

1. Verify images exist in the gallery
2. Check image filters aren't hiding images
3. Ensure images weren't deleted
4. Try exporting individual jobs

### Large Export Times

1. Export jobs individually instead of bulk
2. Filter to export only needed images
3. Export to faster storage (SSD)
4. Close other applications to free resources

## Next Steps

- Learn about [Job Management](job-management.md) for managing jobs
- See [Dashboard Usage](dashboard.md) for viewing results
- Check [Troubleshooting](../../troubleshooting/common-issues.md) for help

