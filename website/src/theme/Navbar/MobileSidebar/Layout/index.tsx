import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import type {Props} from '@theme/Navbar/MobileSidebar/Layout';

/**
 * MobileSidebar/Layout - Force primary menu only, ignore secondary menu
 * This prevents Docusaurus from swapping to contextual sidebar on docs pages
 */
export default function NavbarMobileSidebarLayout({
  header,
  primaryMenu,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  secondaryMenu, // Intentionally unused - we force primary menu only
}: Props): ReactNode {
  const {shown} = useNavbarMobileSidebar();
  return (
    <div
      className={clsx('navbar-sidebar', {
        'navbar-sidebar--show': shown,
      })}>
      {header}
      <div
        className={clsx('navbar-sidebar__items', {
          'navbar-sidebar__items--show-secondary': false, // FORCE PRIMARY ONLY
        })}>
        <div className="navbar-sidebar__item menu">{primaryMenu}</div>
        {/* We explicitly ignore secondaryMenu here to prevent the empty doc sidebar bug */}
      </div>
    </div>
  );
}
