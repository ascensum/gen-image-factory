/**
 * Constants for ApiKeysSection (Story 3.4 Phase 5c.9).
 * .tsx for icon components in SERVICE_TEMPLATES.
 */
import React from 'react';
import type { ApiService, ServiceTemplate } from './apiKeysSectionTypes';

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    icon: ({ className }) => <div className={`${className} bg-green-500 rounded`} />,
    keyPattern: /^sk-[a-zA-Z0-9]{48}$/,
    testEndpoint: 'https://api.openai.com/v1/models',
    documentationUrl: 'https://platform.openai.com/docs/api-reference',
    placeholder: 'sk-...'
  },
  {
    name: 'midjourney',
    displayName: 'Midjourney',
    icon: ({ className }) => <div className={`${className} bg-purple-500 rounded`} />,
    keyPattern: /^mj-[a-zA-Z0-9\-_]{32,}$/,
    documentationUrl: 'https://docs.midjourney.com/',
    placeholder: 'mj-...'
  },
  {
    name: 'stable-diffusion',
    displayName: 'Stable Diffusion',
    icon: ({ className }) => <div className={`${className} bg-blue-500 rounded`} />,
    keyPattern: /^sd-[a-zA-Z0-9\-_]{32,}$/,
    documentationUrl: 'https://stability.ai/docs',
    placeholder: 'sd-...'
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    icon: ({ className }) => <div className={`${className} bg-orange-500 rounded`} />,
    keyPattern: /^sk-ant-[a-zA-Z0-9\-_]{95}$/,
    testEndpoint: 'https://api.anthropic.com/v1/messages',
    documentationUrl: 'https://docs.anthropic.com/',
    placeholder: 'sk-ant-...'
  },
  {
    name: 'custom',
    displayName: 'Custom Service',
    icon: ({ className }) => <div className={`${className} bg-gray-500 rounded`} />,
    keyPattern: /^[a-zA-Z0-9\-_]{10,}$/,
    placeholder: 'Enter custom API key...'
  }
];

export const DEFAULT_SERVICES: ApiService[] = [
  {
    name: 'openai',
    apiKey: '',
    isValid: false,
    isTested: false,
    secureStorageAvailable: false,
    connectionStatus: 'idle'
  }
];
