# Gen Image Factory Dashboard - AI UI Generation Prompt

## Project Context
Create a modern, professional dashboard component for an Electron desktop application called "Gen Image Factory" that serves as the main control center for image generation pipeline management. The dashboard must integrate with real backend methods and follow established design patterns from the existing Settings UI.

## Design System Requirements

### Color Palette (Consistent with Settings UI)
- **Primary Blue:** #3B82F6 (Blue-500) - Main actions, links
- **Success Green:** #10B981 (Emerald-500) - Success states, validations
- **Warning Orange:** #F59E0B (Amber-500) - Warnings, cost indicators
- **Error Red:** #EF4444 (Red-500) - Errors, destructive actions
- **Neutral Gray:** #6B7280 (Gray-500) - Secondary text, borders
- **Background:** #F9FAFB (Gray-50) - Page background
- **Surface:** #FFFFFF (White) - Card backgrounds

### Typography (Consistent with Settings UI)
- **Primary Font:** System default (San Francisco on macOS, Segoe UI on Windows)
- **Heading Sizes:** 
  - H1: 24px, font-weight: 600
  - H2: 20px, font-weight: 600
  - H3: 18px, font-weight: 500
- **Body Text:** 14px, line-height: 1.5
- **Caption Text:** 12px, color: Gray-500

### Layout Specifications
- **Width:** 800px maximum (consistent with Settings UI)
- **Padding:** 24px on all sides
- **Section Spacing:** 32px between sections
- **Card Background:** White with subtle shadow
- **Border Radius:** 8px for cards, 6px for inputs

## Dashboard Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Dashboard Header (Job Controls)                        │
│ [Start New Job] [Status: Ready/Running] [Settings]    │
├─────────────────────────────────────────────────────────┤
│ Job History (Left) │ Current Job Status (Right)       │
│ • Job Executions   │ • Active Job Progress            │
│ • Status Badges    │ • Real-time Logs                 │
│ • Job Statistics   │ • Step-by-step Timeline          │
│ • Quick Actions    │ • Control Buttons                │
├─────────────────────────────────────────────────────────┤
│ Results & History View (Bottom Panel)                 │
│ • Generated Images │ • QC Status Management           │
│ • Image Gallery    │ • Image Details                  │
└─────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Dashboard Header
- **"Start New Job" button**: Large primary blue button (48px height), **disabled when job is running**
- **Job Statistics Display**: Shows total jobs, success rate, average duration (from `job-execution:statistics`)
- **Current Status**: Shows "Ready" (green badge) or "Job Running" (blue badge) or "Error" (red badge)
- **Active Job Info**: When running, displays "Job #123 - Step 3/5 - 60% Complete"
- **Settings button**: Quick access to configuration panel
- **Security Status**: Small indicator showing security level (from architecture security integration)

### 2. Job History Panel (Left - 40% width)
- **Job Executions List**: Scrollable list from `job-execution:get-all` and `job-execution:history`
- **Job Cards**: Each shows Job ID, completion timestamp, status badge, thumbnail preview, duration
- **Status Badges**: "Completed" (green), "Running" (blue), "Failed" (red), "Stopped" (gray)
- **Job Statistics**: Success rate, average duration, total jobs (from `job-execution:statistics`)
- **Quick Actions**: "Rerun", "View Details", "Delete" buttons
- **Empty State**: "No completed jobs yet" when history is empty
- **Clear Indication**: "Only one job can run at a time" message

### 3. Current Job Panel (Right - 60% width)
- **Active Job Display**: Only visible when a job is running, otherwise shows "No active job"
- **Progress Indicator**: Circular progress ring (120px diameter) with percentage and current step name
- **Step Timeline**: Visual timeline showing completed, current, and pending pipeline steps
- **Real-time Logs**: Dual-mode log viewer with toggle between "Standard" and "Debug" modes
- **Control Buttons**: Stop, Pause, Resume buttons for the active job
- **Job Details**: Job ID, start time, estimated completion time

### 4. Results & History View (Bottom - Full width)
- **Generated Images Gallery**: Grid layout showing generated images from `generated-image:get-all`
- **QC Status Management**: Filter by QC status (from `generated-image:get-by-qc-status`)
- **Image Details**: Click to view full details, update QC status (calls `generated-image:update-qc-status`)
- **Execution Filtering**: Filter images by job execution ID (from `generated-image:get-by-execution`)
- **Image Statistics**: Total images, QC status breakdown, success rate

### 5. Pipeline Controls (Bottom Panel)
- **"Start New Job"**: Large primary button, **disabled when job is running**, opens job configuration modal
- **"Stop Current Job"**: Secondary button, **only enabled when job is running**
- **"Force Stop"**: Emergency red button with confirmation dialog for unresponsive jobs
- **Log Mode Toggle**: Switch between Standard (user-friendly) and Debug (technical) logging modes

## Real Backend Integration Points

### Job Control Methods
- **`job:start`** - Start new job with configuration
- **`job:stop`** - Graceful job shutdown
- **`job:force-stop`** - Emergency process termination

### Job History Methods
- **`job-execution:get-all`** - Get all job executions
- **`job-execution:history`** - Get limited job history
- **`job-execution:statistics`** - Get job statistics
- **`job-execution:delete`** - Delete job execution

### Image Management Methods
- **`generated-image:get-all`** - Get all generated images
- **`generated-image:get-by-execution`** - Get images by job execution
- **`generated-image:update-qc-status`** - Update image QC status
- **`generated-image:delete`** - Delete generated image

### Quick Actions Methods
- **`deleteJobExecution`** - Delete job and associated images
- **`exportToExcel`** - Export job results to Excel
- **`manualApproveImage`** - Manual approval for failed images
- **`getJobResults`** - Get detailed job results

## Interactive Elements

### Job Management
- **Start Job Button**: Disabled when job running, opens configuration modal
- **Stop Job Button**: Only enabled when job is running, calls `job:stop`
- **Force Stop Button**: Emergency stop, calls `job:force-stop` with confirmation
- **Job History Cards**: Click to view details, right-click for context menu (rerun, delete)

### Image Management
- **Image Gallery**: Grid layout with thumbnails, click to view full size
- **QC Status Filter**: Dropdown to filter by QC status (pass/fail/pending)
- **QC Status Update**: Click on image to update QC status via `generated-image:update-qc-status`
- **Execution Filter**: Filter images by specific job execution ID

### Statistics Display
- **Job Statistics**: Total jobs, success rate, average duration from `job-execution:statistics`
- **Image Statistics**: Total images, QC status breakdown from `generated-image:get-all`
- **Real-time Updates**: Statistics update when new jobs complete or images are generated

## State Management

### Job States
- **Idle**: No job running, "Start New Job" enabled, job history visible
- **Running**: Job in progress, "Start New Job" disabled, progress visible, job execution being updated
- **Completed**: Job finished, results visible, "Start New Job" re-enabled
- **Error**: Job failed, error message displayed, "Start New Job" re-enabled
- **Stopping**: Job being stopped, loading indicator, stop buttons disabled

### Data Loading States
- **Job History Loading**: Skeleton loader while calling `job-execution:get-all`
- **Statistics Loading**: Skeleton loader while calling `job-execution:statistics`
- **Images Loading**: Skeleton loader while calling `generated-image:get-all`
- **Job Configuration Loading**: Load settings via `get-settings` for configuration modal

## Error Handling

### Job Control Errors
- **Job Already Running**: Error from `job:start` when job already running
- **Job Stop Failed**: Error from `job:stop` when job cannot be stopped
- **Force Stop Required**: When graceful stop fails, suggest force stop

### Data Loading Errors
- **Job History Load Failed**: Error when `job-execution:get-all` fails
- **Statistics Load Failed**: Error when `job-execution:statistics` fails
- **Images Load Failed**: Error when `generated-image:get-all` fails

### Network/System Errors
- **Backend Connection Lost**: Error when IPC communication fails
- **Database Errors**: Error when database operations fail
- **File System Errors**: Error when image files cannot be accessed

## Visual Polish

### Job Status Indicators
- **Completed Jobs**: Green badge with checkmark, shows completion time
- **Running Jobs**: Blue badge with spinner, shows start time and duration
- **Failed Jobs**: Red badge with X, shows error message
- **Stopped Jobs**: Gray badge with pause icon, shows stop time

### Image Status Indicators
- **QC Pass**: Green border, checkmark icon
- **QC Fail**: Red border, X icon
- **QC Pending**: Yellow border, clock icon
- **No QC**: Gray border, no icon

### Progress Visualization
- **Step Progress**: Visual timeline showing pipeline steps
- **Percentage Complete**: Circular progress indicator
- **Time Remaining**: Estimated completion time based on progress
- **Current Step**: Highlighted step name and description

## Accessibility Compliance

### WCAG 2.1 AA Standards
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Keyboard Navigation**: Full keyboard accessibility for all controls
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Management**: Clear focus indicators and logical tab order
- **Error Handling**: Clear error messages and validation feedback

### Keyboard Shortcuts
- **Tab**: Navigate between dashboard sections
- **Space/Enter**: Activate buttons and controls
- **Arrow Keys**: Navigate job history and image gallery
- **Escape**: Close modals and cancel actions
- **Ctrl+S**: Quick save/export functionality

## Performance Considerations

### Real-time Updates
- Efficient polling and event-based updates
- Throttled UI updates to prevent excessive re-renders
- Optimized image loading with lazy loading
- Data caching for job history and statistics

### Memory Management
- Cleanup of event listeners on component unmount
- Efficient state management to minimize re-renders
- Optimized rendering with React.memo for expensive components
- Proper cleanup of timers and intervals

## Security Implementation

### Action Confirmation
- Confirmation dialogs for destructive actions (delete job, delete image)
- Clear warning messages for force stop operations
- Proper error handling without exposing sensitive information
- Input validation for all user interactions

### Data Validation
- Validate all backend responses
- Sanitize user inputs
- Handle network errors gracefully
- Provide clear error messages for users

## Single Job Execution Constraint

### UI Communication Requirements
- Clear visual indicators when job is running vs. idle
- Disabled "Start New Job" button when job is running
- Prominent messaging about single job constraint
- Error handling for job conflict attempts
- Real-time status updates with constraint explanation

### Backend Integration
- Leverage existing single job enforcement from Story 1.2
- Clear error messages for job conflicts
- Real-time status synchronization
- Proper state management for job transitions

## Quick Actions Implementation

### Job Quick Actions
- **View Details**: Modal with detailed job results
- **Export to Excel**: Download Excel file with job data
- **Delete Job**: Confirmation dialog with job details
- **Rerun Job**: Start new job with same configuration

### Image Quick Actions
- **Update QC Status**: Dropdown with Pass/Fail/Pending
- **Delete Image**: Confirmation dialog with image details
- **Manual Approve**: Only for failed images
- **View Metadata**: Modal with detailed image information

## Style Reference
Match the existing Settings panel design with clean, professional appearance, consistent spacing, and intuitive user experience. Use the same component patterns (toggles, buttons, cards) and color scheme for visual consistency.

## Technical Requirements
- **React Components**: TypeScript with proper prop interfaces
- **State Management**: Centralized dashboard state with real-time updates
- **Backend Integration**: All actions connect to real backend methods
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Responsive Design**: Works across different screen sizes and orientations
- **Accessibility**: WCAG 2.1 AA compliance for all dashboard components

## Implementation Notes
- All components should follow the established patterns from the Settings UI
- Real-time updates should be efficient and not block the UI
- Error handling should provide clear, user-friendly messages
- The single job execution constraint must be clearly communicated
- All quick actions should connect to real backend methods
- The design should be responsive and accessible
- Performance should be optimized for real-time updates and large datasets
