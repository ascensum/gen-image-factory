import { render, screen } from '@testing-library/react'
import SingleJobView from '../../Jobs/SingleJobView'

vi.stubGlobal('window', {
  electronAPI: {
    jobManagement: {
      getJobExecution: vi.fn().mockResolvedValue({ success: true, execution: { id: 1, label: 'My UI Label', status: 'completed' } })
    },
    generatedImages: {
      getGeneratedImagesByExecution: vi.fn().mockResolvedValue({ success: true, images: [] })
    },
    getJobConfigurationById: vi.fn().mockResolvedValue({ success: true, configuration: { settings: {} } }),
    jobManagementLogs: vi.fn(),
    calculateJobExecutionStatistics: vi.fn().mockResolvedValue({ success: true, statistics: { totalImages: 0, successfulImages: 0, failedImages: 0, approvedImages: 0, qcFailedImages: 0 } })
  }
} as any)

describe('Job label display', () => {
  it('shows label if present', async () => {
    render(<SingleJobView jobId={1} onBack={() => {}} onExport={() => {}} onRerun={() => {}} onDelete={() => {}} />)
    const title = await screen.findByText('My UI Label')
    expect(title).toBeInTheDocument()
  })
})


