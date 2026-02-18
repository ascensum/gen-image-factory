import React from 'react';

interface HeaderMenuProps {
  onOpenFailedImagesReview?: () => void;
  onOpenSettings?: () => void;
  onOpenJobs?: () => void;
}

const HeaderMenu: React.FC<HeaderMenuProps> = ({ onOpenFailedImagesReview, onOpenSettings, onOpenJobs }) => {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const PANEL_WIDTH = 320; // px (~20rem)

  return (
    <div className="relative">
      <button
        aria-label="Open menu"
        title="Menu"
        ref={buttonRef}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            const top = rect.bottom + 8;
            const idealLeft = rect.right - PANEL_WIDTH;
            const maxLeft = window.innerWidth - PANEL_WIDTH - 8;
            const left = Math.max(8, Math.min(idealLeft, maxLeft));
            setMenuPos({ top, left });
          }
          setOpen((v) => !v);
        }}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div
          className="fixed min-w-[20rem] bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px`, width: `${PANEL_WIDTH}px` }}
        >
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Navigate</div>
            <button
              onClick={() => {
                setOpen(false);
                onOpenFailedImagesReview && onOpenFailedImagesReview();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <span>Failed Images Review</span>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onOpenSettings && onOpenSettings();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              <span>Settings</span>
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onOpenJobs && onOpenJobs();
              }}
              className="w-full py-2 text-sm text-gray-700 hover:bg-gray-50 grid place-items-center grid-flow-col auto-cols-max gap-2"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h13M9 7h13M5 7h.01M5 17h.01M5 12h.01" /></svg>
              <span>Job Management</span>
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
};

export default HeaderMenu;
