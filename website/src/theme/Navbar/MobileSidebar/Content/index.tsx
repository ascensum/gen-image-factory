import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import NavbarItem from '@theme/NavbarItem';

/**
 * MobileSidebar/Content - Override to always show only navbar items
 * This ensures consistent mobile navigation across all pages (Home, Static Pages, Docs)
 * Single Source of Truth: Always renders the primary navbar items from docusaurus.config.js
 */
export default function MobileSidebarContent(): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  
  // Get navbar items from config (primary menu items)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const themeConfig = siteConfig.themeConfig as any;
  const navbarItems = (themeConfig?.navbar?.items || []) as Array<Record<string, unknown>>;
  
  // Filter to only show items in the 'right' position (our main nav items)
  const rightItems = navbarItems.filter((item) => item.position === 'right');
  
  // Debug: Log to console to verify component is rendering
  // eslint-disable-next-line no-console
  console.log('[MobileSidebar] Rendering with', rightItems.length, 'items');
  
  // If no items, return empty to avoid rendering issues
  if (rightItems.length === 0) {
    return <ul className="navbar-sidebar__items" />;
  }
  
  return (
    <ul className="navbar-sidebar__items">
      <li className="navbar-sidebar__item">
        <ul className="menu__list">
          {rightItems.map((item, i) => (
            <li key={i} className="menu__list-item">
              <NavbarItem {...item} />
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
}
