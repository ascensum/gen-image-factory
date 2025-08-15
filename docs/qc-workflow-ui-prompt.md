# Failed Images Review Workflow - AI UI Generation Prompt

## Project Context
Create a specialized **Failed Images Review Workflow** interface for an Electron React application that integrates seamlessly with an existing dashboard. This is a dedicated quality control interface for reviewing and managing failed AI-generated images.

## Design Requirements

### **Visual Style & Consistency**
- **Framework**: React with TypeScript, Tailwind CSS
- **Color Scheme**: Follow existing patterns: `bg-gray-50` background, `bg-white` panels, `border-gray-200` borders
- **Typography**: `text-xl font-semibold` for headers, `text-sm text-gray-700` for labels
- **Spacing**: Use existing patterns: `p-6`, `mb-4`, `gap-4`
- **Buttons**: `bg-blue-600 hover:bg-blue-700` for primary, `bg-red-600 hover:bg-red-700` for destructive

### **Layout Structure**
- **Header**: 48px height with navigation and status
- **Two-Panel Layout**: Left panel (40% width) for failed images list, Right panel (60% width) for review tools
- **Bottom Panel**: Full-width bulk operations and export
- **Responsive**: Desktop (default), tablet (stacked), mobile (single column)

## Component 1: QC Review Panel (Main Container)

### **Header Section (48px height)**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Back to Dashboard] Failed Images Review [Status: 23 Failed Images]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Back Button**: Left-aligned, `text-gray-500 hover:text-gray-700`
- **Title**: "Failed Images Review" - `text-xl font-semibold text-gray-900`
- **Status Badge**: Right-aligned, `bg-red-100 text-red-800` showing failed count

### **Statistics Bar (Below Header)**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Statistics: [🔴 Quality Check Failed: 15] [🟠 Processing Error: 8] [Total: 23] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Color-coded failure type breakdown
- Clickable filters for each failure type
- Total count display

## Component 2: Failed Images List (Left Panel - 40% width)

### **Filters & Search Bar**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Filter: [All Reasons ▼] Search: [________] Sort: [Newest ▼]              │
│ [Grid View] [List View] [Select All] [Bulk Actions]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Controls:**
- **Failure Reason Filter**: Dropdown with failure types
- **Search Field**: Text input for prompts and metadata
- **Sort Options**: Newest, oldest, failure type, job ID
- **View Toggle**: Grid/list view switch
- **Selection Controls**: Select all, bulk actions

### **Image Cards Grid/List**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [✓] [🔴 QC Failed] [⚙️ ⋯]                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │                                                                     │ │ │
│ │ │                    Failed Image                                     │ │ │
│ │ │                                                                     │ │ │
│ │ │                                                                     │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ [🔴 Quality Check Failed] [Job #1234] [Dec 19, 2024]                  │ │
│ │                                                                         │ │
│ │ Generation Prompt (truncated to 2 lines)                               │ │
│ │                                                                         │ │
│ │ [✨ Enhanced] [🖼️ No BG] [📄 JPG] [🔍 Sharp]                        │ │
│ │                                                                         │ │
│ │ [🎲 Seed: 12345] [📅 2 hours ago]                                    │ │
│ │                                                                         │ │
│ │ [✓ Approve] [🔄 Retry] [🗑️ Delete]                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Card Features:**
- **Selection Checkbox**: `rounded border-gray-300 text-blue-600`
- **QC Status Badge**: Color-coded failure indicators
- **Image Thumbnail**: `aspect-square object-cover` with failure overlay
- **Failure Information**: Reason, job ID, creation date
- **Generation Prompt**: Truncated with tooltip for full text
- **Processing Settings**: Small badges for enhancements
- **Metadata**: Seed number and relative time
- **Action Buttons**: Approve, retry, delete

## Component 3: Review Tools Panel (Right Panel - 60% width)

### **Header Section**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Selected Image: [Image Card 1] - Quality Check Failed                     │
│ [← Previous] [Next →] [Close]                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Selected Image Info**: `text-lg font-semibold text-gray-900`
- **Navigation Arrows**: Browse through selected images
- **Close Button**: Return to list view

### **Image Comparison View**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Image Comparison View                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ┌─────────────┐ ┌─────────────┐                                        │ │
│ │ │ Failed      │ │ Successful  │                                        │ │
│ │ │ Image       │ │ Reference   │                                        │ │
│ │ │ (Current)   │ │ (Similar)   │                                        │ │
│ │ │             │ │             │                                        │ │
│ │ │ [Zoom +]    │ │ [Zoom +]    │                                        │ │
│ │ │ [Pan]       │ │ [Pan]       │                                        │ │
│ │ └─────────────┘ └─────────────┘                                        │ │
│ │                                                                         │ │
│ │ [Swap Views] [Side by Side] [Overlay] [Reset View]                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Side-by-Side Display**: Two images with equal sizing
- **Zoom Controls**: +/- buttons for each image (1.0x to 4.0x)
- **Pan Controls**: Click and drag to move around zoomed images
- **View Modes**: Toggle between side-by-side, overlay, and swap
- **Synchronized Controls**: Both images zoom/pan together

### **Failure Analysis Section**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Failure Analysis                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 Quality Check Failed                                                │ │
│ │                                                                         │ │
│ │ • Reason: Image resolution below minimum threshold                     │ │
│ │ • Details: Current: 800x600, Required: 1920x1080                      │ │
│ │ • Impact: Image too small for intended use case                        │ │
│ │ • Suggested Fix: Increase resolution to 1920x1080 or higher            │ │
│ │ • Confidence: 95% - High confidence in diagnosis                       │ │
│ │                                                                         │ │
│ │ [View Full Report] [Export Analysis] [Mark as Reviewed]                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Failure Badge**: Color-coded status indicator
- **Reason**: Clear explanation of why image failed
- **Details**: Specific technical details with numbers
- **Impact**: Business/user impact explanation
- **Suggested Fix**: Actionable recommendation
- **Confidence**: AI confidence level in diagnosis
- **Action Buttons**: Additional analysis tools

### **Parameter Editor Section**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Parameter Editor                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Resolution: [1920x1080 ▼] [Apply Changes]                             │ │
│ │                                                                         │ │
│ │ Image Enhancement: [✓] Enable [Settings ▼]                             │ │
│ │ • Sharpening: [0.5] [0.0 ───────── 1.0] [Reset]                      │ │
│ │ • Saturation: [1.2] [0.5 ───────── 2.0] [Reset]                      │ │
│ │ • Contrast: [1.1] [0.5 ───────── 2.0] [Reset]                        │ │
│ │                                                                         │ │
│ │ Background Processing: [✓] Remove Background [Size: 1024 ▼]            │ │
│ │ • Remove BG: [✓] Enable [Quality: High ▼] [Reset]                     │ │
│ │ • Trim Transparent: [✓] Enable [Tolerance: 0.1] [Reset]               │ │
│ │                                                                         │ │
│ │ [Use Original Parameters] [Save as Preset] [Reset All]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Controls:**
- **Resolution Dropdown**: Common resolutions with custom input
- **Slider Controls**: Visual sliders for numerical parameters
- **Toggle Switches**: Checkboxes for boolean settings
- **Reset Buttons**: Individual and global reset options
- **Preset Management**: Save and load parameter combinations

### **Approval Workflow Section**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Approval Workflow                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Current Status: [Rejected ▼] [Change to Approved]                     │ │
│ │                                                                         │ │
│ │ Approval Notes: [________________________________________________]      │ │
│ │ Placeholder: "Explain why this image should be approved..."            │ │
│ │                                                                         │ │
│ │ Approval Reason: [Quality Issue Resolved ▼] [Custom: ________]         │ │
│ │ • Quality Issue Resolved                                               │ │
│ │ • False Positive                                                       │ │
│ │ • Business Exception                                                   │ │
│ │ • Custom Reason                                                        │ │
│ │                                                                         │ │
│ │ [Approve Image] [Reject Image] [Save Draft]                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- **Status Dropdown**: Current QC status with change options
- **Notes Field**: Multi-line text input for approval reasoning
- **Reason Selection**: Predefined reasons with custom option
- **Action Buttons**: Primary workflow actions
- **Draft Saving**: Save progress without committing

## Component 4: Bulk Operations Panel (Bottom - Full Width)

### **Selection Management**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [3 Selected] [Select All] [Clear Selection] [Invert Selection]            │
│                                                                             │
│ Selection Summary:                                                          │
│ • Quality Check Failed: 2 images                                           │
│ • Processing Error: 1 image                                                │
│ • Total Size: 15.2 MB                                                     │
│ • Estimated Processing Time: 2-3 minutes                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Selection Count**: `text-lg font-semibold text-blue-600` badge
- **Selection Actions**: Buttons for managing selection
- **Summary Info**: Breakdown of selected images by failure type
- **Resource Estimates**: File size and processing time

### **Bulk Operations**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Bulk Approve] [Bulk Retry] [Export Report] [Delete All]                  │
│                                                                             │
│ Approval Notes: [________________________________________________] [Apply] │
│ Retry Config: [Use Modified Parameters] [Use Original] [Custom Settings]  │
│                                                                             │
│ [Progress Bar: 2 of 3 images processed] [Cancel Operation]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Operations:**
- **Bulk Approve**: `bg-green-600 hover:bg-green-700` with notes and reasons
- **Bulk Retry**: `bg-blue-600 hover:bg-blue-700` with parameter options
- **Export Report**: `bg-purple-600 hover:bg-purple-700` with format options
- **Bulk Delete**: `bg-red-600 hover:bg-red-700` with safety confirmations

## Interactive Features

### **Image Comparison Tools**
- **Zoom**: Mouse wheel or +/- buttons (1.0x to 4.0x)
- **Pan**: Click and drag to move around zoomed images
- **View Modes**: Toggle between different comparison layouts
- **Synchronized Controls**: Both images zoom/pan together

### **Parameter Editing**
- **Real-time Preview**: See changes applied to failed image
- **Validation**: Prevent invalid parameter combinations
- **Undo/Redo**: Track parameter change history
- **Preset System**: Save and load parameter combinations

### **Workflow Management**
- **Auto-save**: Automatically save draft changes
- **Validation**: Ensure required fields are completed
- **Confirmation**: Confirm destructive actions
- **Progress Tracking**: Show workflow completion status

### **Bulk Operations**
- **Preview Mode**: Show changes before applying
- **Undo Support**: Revert bulk operations within time limit
- **Batch Processing**: Process images in optimal batches
- **Error Handling**: Continue processing on individual failures

## Responsive Behavior

### **Desktop (Default)**
- Full two-panel layout with all sections visible
- Side-by-side image comparison
- Full parameter editor controls
- Hover effects and detailed tooltips

### **Tablet**
- Stacked panels with collapsible sections
- Compact image comparison
- Simplified parameter controls
- Touch-friendly button sizes

### **Mobile**
- Single column layout
- Tabbed interface for different sections
- Touch-optimized controls and gestures
- Swipe gestures for quick actions

## Loading States

### **Initial Load**
- Skeleton placeholders for images and content
- Loading spinner with "Loading failed images..." text
- Progressive loading with blur-to-sharp transition

### **Operation Processing**
- Progress bars for bulk operations
- Individual image status indicators
- Estimated time remaining display
- Loading indicators for parameter changes

### **Export Operations**
- Download progress indicator
- Processing status for report generation
- Success/error feedback for completed operations

## Error Handling

### **No Failed Images**
- Empty state with helpful message
- Suggestions for checking other QC statuses
- Link back to main dashboard

### **API Errors**
- User-friendly error messages with retry options
- Fallback to cached data when available
- Alternative operation methods

### **Validation Errors**
- Inline validation with helpful hints
- Required field indicators
- Conflict resolution for incompatible settings

### **Network Issues**
- Offline indicator with sync when available
- Local storage for draft changes
- Queue operations for when connection returns

## Performance Requirements

### **Image Loading**
- Lazy loading for comparison images
- Progressive JPEG loading
- Memory management for large images
- Load failed images within 2 seconds

### **Parameter Updates**
- Debounced parameter changes
- Batch updates for multiple changes
- Optimistic UI updates
- Maintain 60fps interactions

### **Bulk Operations**
- Optimal batch sizes for different operations
- Parallel processing where possible
- Memory cleanup after operations
- Background processing for heavy operations

## Integration Requirements

### **Navigation**
- Add as new tab in existing dashboard
- Seamless transition between dashboard and QC review
- Maintain dashboard state when switching tabs

### **Data Flow**
- Use existing image data and handlers
- Extend current IPC communication patterns
- Integrate with existing error handling

### **State Management**
- Follow existing React patterns
- Maintain consistency with dashboard state
- Handle loading and error states consistently

## Accessibility Features

### **Screen Reader Support**
- Proper ARIA labels for all interactive elements
- Descriptive text for images and actions
- Status announcements for operations

### **Keyboard Navigation**
- Tab order follows visual layout
- Arrow keys for image navigation
- Keyboard shortcuts for common actions
- Clear focus indicators

### **Color & Contrast**
- Meet WCAG AA standards
- High contrast mode support
- Color-independent status indicators
- Alternative text for all images

This interface should feel like a natural extension of your existing dashboard while providing the specialized tools needed for efficient failed image review and management. The design should maintain visual consistency with your current components while adding powerful QC workflow capabilities.
