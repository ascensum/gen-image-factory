import React, {type ReactNode} from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarItem, {type Props as NavbarItemConfig} from '@theme/NavbarItem';

// Local implementation of useNavbarItems (matches Docusaurus internal pattern)
function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

/**
 * MobileSidebar/Content - Override to always show only navbar items
 * This ensures consistent mobile navigation across all pages (Home, Static Pages, Docs)
 * Based on Docusaurus PrimaryMenu pattern but simplified to ignore contextual sidebars
 * 
 * Note: This component is not currently used - PrimaryMenu is used instead
 */
export default function NavbarMobileSidebarContent(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  
  // Get all navbar items - this ensures we get global items on all pages
  const items = useNavbarItems();

  return (
    <ul className="menu__list">
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => mobileSidebar.toggle()}
          key={i}
        />
      ))}
    </ul>
  );
}
