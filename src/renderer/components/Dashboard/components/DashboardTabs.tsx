import React from 'react';

interface DashboardTabsProps {
  activeTab: 'overview' | 'image-gallery';
  onTabChange: (tab: 'overview' | 'image-gallery') => void;
}

const DashboardTabs: React.FC<DashboardTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tab-navigation">
      <button 
        className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => onTabChange('overview')}
      >
        Overview
      </button>
      <button 
        className={`tab-button ${activeTab === 'image-gallery' ? 'active' : ''}`}
        onClick={() => onTabChange('image-gallery')}
      >
        Image Gallery
      </button>
    </div>
  );
};

export default DashboardTabs;
