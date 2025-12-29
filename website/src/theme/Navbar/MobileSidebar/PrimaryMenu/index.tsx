import React from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import NavbarItem from '@theme/NavbarItem';

// Local implementation of useNavbarItems (useNavbarItems doesn't exist as export in @docusaurus/theme-common)
function useNavbarItems() {
  return useThemeConfig().navbar.items;
}

/**
 * MobileSidebar/PrimaryMenu - Force global navbar items, ignore contextual sidebars
 * This ensures consistent mobile navigation across all pages (Home, Static Pages, Docs)
 */
export default function NavbarMobilePrimaryMenu() {
  const items = useNavbarItems();
  const mobileSidebar = useNavbarMobileSidebar();

  return (
    <ul className="menu__list">
      {items.map((item, i) => (
        <NavbarItem
          mobile
          {...item}
          onClick={() => {
            // Close sidebar when link is clicked
            if (mobileSidebar.shown) {
              mobileSidebar.toggle();
            }
          }}
          key={i}
        />
      ))}
    </ul>
  );
}
