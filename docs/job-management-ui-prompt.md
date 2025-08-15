# Gen Image Factory Job Management - AI UI Generation Prompt

## Project Context
Create a comprehensive Job Management system for an Electron desktop application called "Gen Image Factory" that provides advanced job oversight, batch operations, and detailed job analysis. This system must integrate with real backend methods, maintain visual consistency with the existing Dashboard and Settings UI components, and leverage Electron's desktop capabilities for optimal user experience.

## Design System Requirements

### Color Palette (Consistent with Dashboard & Settings UI)
- **Primary Blue:** #3B82F6 (Blue-500) - Main actions, links, active states
- **Success Green:** #10B981 (Emerald-500) - Success states, completed jobs
- **Warning Orange:** #F59E0B (Amber-500) - Warnings, pending jobs
- **Error Red:** #EF4444 (Red-500) - Errors, failed jobs, destructive actions
- **Neutral Gray:** #6B7280 (Gray-500) - Secondary text, borders, inactive states
- **Background:** #F9FAFB (Gray-50) - Page background
- **Surface:** #FFFFFF (White) - Card backgrounds, table rows
- **Accent Purple:** #8B5CF6 (Violet-500) - Job management specific actions

### Typography (Consistent with Dashboard & Settings UI)
- **Primary Font:** System default (San Francisco on macOS, Segoe UI on Windows)
- **Heading Sizes:** 
  - H1: 28px, font-weight: 700 (Page titles)
  - H2: 24px, font-weight: 600 (Section headers)
  - H3: 20px, font-weight: 600 (Subsection headers)
  - H4: 18px, font-weight: 500 (Card titles)
- **Body Text:** 14px, line-height: 1.6
- **Caption Text:** 12px, color: Gray-500
- **Table Text:** 13px, line-height: 1.4

### Layout Specifications
- **Page Width:** 1200px maximum (wider than Dashboard for table views)
- **Padding:** 32px on all sides
- **Section Spacing:** 40px between major sections
- **Card Background:** White with subtle shadow (shadow-sm)
- **Border Radius:** 8px for cards, 6px for inputs, 4px for tables
- **Table Row Height:** 56px for better readability

## Job Management Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Job Management Header                                                  │
│ [← Back to Dashboard] [Job Management] [Refresh] [Help]              │
├─────────────────────────────────────────────────────────────────────────┤
│ Statistics Overview Bar                                                │
│ [Total Jobs: 156] [Completed: 142] [Failed: 8] [Running: 1] [Pending: 5] │
├─────────────────────────────────────────────────────────────────────────┤
│ Advanced Filters & Search Bar                                          │
│ [Status Filter] [Date Range] [Configuration] [Search Jobs...] [Clear] │
├─────────────────────────────────────────────────────────────────────────┤
│ Main Job Table with Multi-Select                                      │
│ [Select All] [Job ID] [Name/Label] [Status] [Date] [Duration] [Images] [Actions] │
│ [☑] [JOB-001] [Product Photos] [Completed] [2024-01-15] [2h 15m] [45] [⋮] │
│ [☑] [JOB-002] [Marketing Assets] [Failed] [2024-01-14] [0h 45m] [12] [⋮] │
├─────────────────────────────────────────────────────────────────────────┤
│ Batch Operations Toolbar                                               │
│ [5 jobs selected] [Rerun Selected] [Export Selected] [Delete Selected] [Clear Selection] │
├─────────────────────────────────────────────────────────────────────────┤
│ Pagination Controls                                                    │
│ [← Previous] [Page 1 of 8] [Next →] [Show 25 per page] [Total: 156 jobs] │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Job Management Header
- **Back Button**: Left-aligned, with arrow icon, returns to Dashboard
- **Page Title**: "Job Management" in large, bold text (H1)
- **Action Buttons**: Right-aligned Refresh button and Help button
- **Breadcrumb**: Optional breadcrumb showing Dashboard > Job Management
- **Status Indicator**: Small indicator showing current system status

### 2. Statistics Overview Bar
- **Metric Cards**: Horizontal row of 5 metric cards showing:
  - Total Jobs (with trend indicator)
  - Completed Jobs (green, with success rate)
  - Failed Jobs (red, with failure rate)
  - Running Jobs (blue, with current count)
  - Pending Jobs (orange, with queue status)
- **Real-time Updates**: Metrics update automatically via IPC events
- **Clickable Cards**: Each metric card can filter the table by that status

### 3. Advanced Filters & Search Bar
- **Status Filter Dropdown**: Multi-select dropdown with status options
  - All, Completed, Failed, Running, Stopped, Pending
- **Date Range Picker**: From/To date inputs with calendar popup
- **Configuration Filter**: Dropdown showing available job configurations
- **Search Input**: Full-text search across job names, IDs, and descriptions
- **Clear Filters Button**: Resets all filters to default state
- **Filter Summary**: Shows active filter count and quick clear options

### 4. Main Job Table with Multi-Select
- **Selection Column**: Checkbox for each row, plus select-all checkbox in header
- **Job ID Column**: Monospace font, clickable to open Single Job View
- **Name/Label Column**: Editable inline text input for job labels
- **Status Column**: Color-coded badges with status text
- **Date Column**: Formatted date with time, sortable
- **Duration Column**: Human-readable duration (e.g., "2h 15m")
- **Image Count Column**: Number with small image icon
- **Actions Column**: Three-dot menu with View, Export, Rerun, Delete options

### 5. Batch Operations Toolbar
- **Selection Counter**: Shows "X jobs selected" with clear selection button
- **Batch Action Buttons**: 
  - Rerun Selected (blue, with queue indicator)
  - Export Selected (green, with Excel icon)
  - Delete Selected (red, with confirmation dialog)
- **Progress Indicators**: Show progress for long-running batch operations
- **Queue Status**: Display when rerun jobs are queued vs. running

### 6. Pagination Controls
- **Navigation**: Previous/Next buttons with page numbers
- **Page Size Selector**: Dropdown for 25, 50, 100 jobs per page
- **Total Count**: Shows "Total: X jobs" with current page info
- **Jump to Page**: Optional input field for direct page navigation

## Single Job View Modal Specifications

### Modal Layout
- **Size**: 900px width, 700px height (responsive)
- **Position**: Centered over the current page
- **Backdrop**: Semi-transparent dark overlay with click-to-close
- **Header**: Job title, close button, and action buttons

### Modal Content Structure
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Single Job View - [Job Name] [×]                                      │
│ [View Details] [Export] [Rerun] [Delete]                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Job Information Panel                                                  │
│ • Job ID: JOB-001                                                     │
│ • Status: Completed (with timestamp)                                  │
│ • Configuration: Product Photos v2.1                                  │
│ • Duration: 2 hours 15 minutes                                       │
│ • Images: 45 generated, 42 successful, 3 failed                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Generated Images Gallery                                               │
│ [Grid of 45 images with QC status indicators]                         │
│ [Filter by QC Status] [Sort by Date/Quality] [Export Selected]        │
├─────────────────────────────────────────────────────────────────────────┤
│ Job Logs & Timeline                                                    │
│ [Step-by-step execution timeline with timestamps]                     │
│ [Error details if any] [Processing parameters used]                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Real Backend Integration Points

### Job Management Methods
- **`job-execution:get-all`** - Get paginated list of all job executions
- **`job-execution:get-by-id`** - Get detailed information for single job
- **`job-execution:rename`** - Update job label/name
- **`job-execution:bulk-delete`** - Delete multiple selected jobs
- **`job-execution:bulk-export`** - Export multiple jobs to Excel
- **`job-execution:bulk-rerun`** - Queue multiple jobs for sequential execution

### Job Statistics Methods
- **`job-execution:statistics`** - Get aggregated job statistics
- **`job-execution:filter`** - Advanced filtering with search and date ranges
- **`job-execution:export`** - Export single job to Excel format

### Real-time Updates
- **`job-execution:status-update`** - Real-time status changes
- **`job-execution:progress-update`** - Progress updates for running jobs
- **`job-execution:completion`** - Job completion notifications

## Interactive Features

### Inline Editing
- **Job Labels**: Click to edit, Enter to save, Escape to cancel
- **Optimistic Updates**: Show changes immediately, rollback on error
- **Validation**: Prevent empty labels, show error messages

### Multi-Selection
- **Keyboard Navigation**: Arrow keys, Shift+Click for ranges
- **Select All**: Checkbox in header, respects current filters
- **Selection Persistence**: Maintains selection across pagination
- **Bulk Actions**: Disable when no selection, show confirmation dialogs

### Advanced Filtering
- **Combined Filters**: Multiple filters work together
- **Search Highlighting**: Highlight search terms in results
- **Filter Presets**: Save and restore common filter combinations
- **Export Filters**: Include current filters in export operations

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard support for all operations
- **Screen Reader**: Proper ARIA labels and roles
- **Color Contrast**: Meet minimum contrast requirements
- **Focus Management**: Clear focus indicators and logical tab order

### Desktop Design
- **Desktop First**: Optimized for 1200px+ screens
- **Window Resizing**: Flexible layouts for different desktop resolutions
- **Desktop Interactions**: Mouse, keyboard, and trackpad optimized

## Performance Considerations

### Large Dataset Handling
- **Virtualization**: Virtual scrolling for tables with 1000+ rows
- **Pagination**: Server-side pagination with configurable page sizes
- **Lazy Loading**: Load job details on demand
- **Debounced Search**: Prevent excessive API calls during typing

### Real-time Updates
- **WebSocket/IPC**: Efficient real-time communication
- **Batch Updates**: Group multiple updates to reduce re-renders
- **Optimistic UI**: Show changes immediately, sync with server
- **Error Handling**: Graceful degradation when updates fail

## Electron-Specific Features

### Desktop Integration
- **Native OS Integration**: Leverage platform-specific UI patterns (Windows, macOS, Linux)
- **Window Management**: Integrate with OS window controls and resizing
- **System Menus**: Use native context menus and keyboard shortcuts
- **File System Access**: Direct file operations without web restrictions

### Desktop Interactions
- **Mouse Optimization**: Hover states, right-click context menus, drag-and-drop
- **Keyboard Shortcuts**: Desktop-standard keyboard navigation and shortcuts
- **Trackpad Support**: Smooth scrolling and gesture support for trackpad users
- **Multi-window**: Support for opening multiple job management windows

## Integration with Existing Components

### Dashboard Integration
- **Navigation**: Seamless transition from Dashboard to Job Management
- **State Sharing**: Share job status and progress information
- **Consistent Styling**: Match Dashboard component appearance
- **Unified Actions**: Consistent job action behavior across views

### Settings Integration
- **Configuration Access**: Link to job configuration settings
- **Export Preferences**: Use Settings export configuration
- **Security Integration**: Respect security and permission settings

## Testing Considerations

### Component Testing
- **Unit Tests**: Test individual component functionality
- **Integration Tests**: Test component interactions
- **Accessibility Tests**: Verify WCAG compliance
- **Performance Tests**: Measure rendering and update performance

### E2E Testing
- **User Workflows**: Test complete job management workflows
- **Batch Operations**: Verify multi-selection and batch actions
- **Error Scenarios**: Test error handling and recovery
- **Cross-platform**: Ensure compatibility across Windows, macOS, and Linux
- **Electron Integration**: Test IPC communication and native OS features

## Success Metrics

### User Experience
- **Task Completion**: Users can complete job management tasks efficiently
- **Error Rate**: Minimal errors during batch operations
- **Performance**: Fast loading and responsive interactions
- **Accessibility**: Meets WCAG 2.1 AA standards

### Technical Performance
- **Render Performance**: Smooth scrolling and updates
- **Memory Usage**: Efficient handling of large datasets
- **API Efficiency**: Minimal unnecessary backend calls
- **Error Recovery**: Graceful handling of failures

This design maintains visual consistency with your existing Dashboard while providing the advanced functionality needed for comprehensive job management. The modal-based Single Job View ensures users can quickly access detailed information without losing context, while the dedicated page provides the space needed for complex batch operations and advanced filtering.
