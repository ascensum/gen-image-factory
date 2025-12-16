import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ExportHarness from './e2e/E2EHarness';
import PlatformHarness from './e2e/PlatformHarness';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
const renderE2E = () => {
  if (hash.startsWith('#/__e2e__/export')) return <ExportHarness />;
  if (hash.startsWith('#/__e2e__/platform')) return <PlatformHarness />;
  return null;
};

root.render(
  renderE2E() ?? <App />
); 