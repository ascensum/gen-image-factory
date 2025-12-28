import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import CookieConsent from 'react-cookie-consent';

// Declare gtag function for TypeScript
declare global {
  interface Window {
    dataLayer: unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
    gtag: (...args: any[]) => void;
  }
}

export default function Root({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  // Get dynamic version from GitHub Releases (same as hero page)
  // Falls back to package.json version if GitHub API is unavailable
  const appVersion = (siteConfig.customFields?.appVersion as string) || '1.0.0';

  useEffect(() => {
    // Initialize dataLayer if it doesn't exist
    if (!window.dataLayer) {
      window.dataLayer = [];
    }

    // Define gtag function if it doesn't exist
    if (!window.gtag) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.gtag = function(...args: any[]) {
        window.dataLayer.push(args);
      };
    }

    // Consent Mode v2: Default Deny - Set before any other scripts
    // This must run before GA4 loads
    // Use dataLayer.push for immediate execution
    window.dataLayer.push({
      'event': 'consent',
      'consent': {
        'analytics_storage': 'denied',
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
      }
    });

    // Also set via gtag if available
    if (window.gtag) {
      window.gtag('consent', 'default', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
      });
    }
  }, []);

  const handleAccept = () => {
    // Update consent to granted when user accepts
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
      });
    }
  };

  return (
    <>
      {children}
      <CookieConsent
        location="bottom"
        buttonText="Accept"
        declineButtonText="Decline"
        enableDeclineButton
        cookieName="gen-image-factory-consent"
        style={{
          background: '#0d0d0d',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
          fontSize: '14px',
          padding: '1rem 1.5rem',
          zIndex: 9999,
        }}
        buttonStyle={{
          background: '#3b82f6',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        declineButtonStyle={{
          background: 'transparent',
          color: '#a3a3a3',
          fontSize: '14px',
          fontWeight: 500,
          padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onAccept={handleAccept}
        expires={365}
      >
        Gen Image Factory [ v{appVersion} ] uses cookies to improve the orchestration engine and provide better analytics. By accepting, you agree to our use of cookies.
      </CookieConsent>
    </>
  );
}

