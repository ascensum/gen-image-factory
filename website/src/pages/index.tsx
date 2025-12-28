import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  Download,
  BookOpen,
  Store,
  BrainCircuit,
  ShieldCheck,
  Zap,
  Database,
  Monitor,
} from 'lucide-react';
import styles from './index.module.css';

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const appVersion = (siteConfig.customFields?.appVersion as string) || '1.0.0';

  useEffect(() => {
    // Intersection Observer for scroll-triggered animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    // eslint-disable-next-line no-undef
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.animateIn);
        }
      });
    }, observerOptions);

    // Observe all elements with fadeInUp class
    const animatedElements = document.querySelectorAll(`.${styles.fadeInUp}`);
    animatedElements.forEach((el) => observer.observe(el));

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <main>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          {/* Technical Grid Background */}
          <div className={styles.heroGrid} aria-hidden="true" />
          
          <div className={styles.heroContent}>
            {/* Logo Placeholder */}
            <div
              className={`${styles.logoPlaceholder} ${styles.fadeInUp} ${styles.pulseSubtle}`}
              aria-label="Gen Image Factory Logo"
            >
              GIF
            </div>

            {/* Main Heading */}
            <h1 className={`${styles.heroTitle} ${styles.fadeInUp} ${styles.delay1}`}>
              Gen Image Factory
            </h1>

            {/* Version Badge - Under Heading */}
            <div className={`${styles.versionBadge} ${styles.fadeInUp} ${styles.delay1}`}>
              [ {appVersion} ]
            </div>

            {/* Subtitle */}
            <p className={`${styles.heroSubtitle} ${styles.fadeInUp} ${styles.delay2}`}>
              AI-powered image generation and processing by{' '}
              <a
                href="https://github.com/ShiftlineTools"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.brandLink}
              >
                Shiftline Tools
              </a>
            </p>

            {/* Call-to-Action Buttons */}
            <div className={`${styles.ctaButtons} ${styles.fadeInUp} ${styles.delay3}`}>
              <a href="#download" className={`${styles.btn} ${styles.btnPrimary}`} aria-label="Download Gen Image Factory">
                <Download className={styles.ctaIcon} /> Download
              </a>
              <Link to="/getting-started/installation" className={`${styles.btn} ${styles.btnSecondary}`} aria-label="View Documentation">
                <BookOpen className={styles.ctaIcon} /> Documentation
              </Link>
              <a href="#microsoft-store" className={`${styles.btn} ${styles.btnSecondary}`} aria-label="Get from Microsoft Store">
                <Store className={styles.ctaIcon} /> Microsoft Store
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.featuresSection}>
          <div className={styles.container}>
            <h2 className={`${styles.sectionTitle} ${styles.fadeInUp}`}>
              Powerful Features
            </h2>

            <div className={styles.featuresGrid}>
              <div className={`${styles.featureCard} ${styles.fadeInUp}`} tabIndex={0}>
                <BrainCircuit className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>AI-Powered Generation</h3>
                <p className={styles.featureDescription}>
                  Leverage advanced AI models for high-quality image creation with intelligent processing capabilities.
                </p>
              </div>

              <div className={`${styles.featureCard} ${styles.fadeInUp} ${styles.delay1}`} tabIndex={0}>
                <ShieldCheck className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>Quality Control</h3>
                <p className={styles.featureDescription}>
                  Automated quality assessment using AI to ensure consistent, professional-grade image output.
                </p>
              </div>

              <div className={`${styles.featureCard} ${styles.fadeInUp} ${styles.delay2}`} tabIndex={0}>
                <Zap className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>Batch Processing</h3>
                <p className={styles.featureDescription}>
                  Process multiple images efficiently with optimized workflows and sequential job execution.
                </p>
              </div>

              <div className={`${styles.featureCard} ${styles.fadeInUp} ${styles.delay3}`} tabIndex={0}>
                <Database className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>Metadata Generation</h3>
                <p className={styles.featureDescription}>
                  Automatic metadata creation for generated images with comprehensive tagging and organization.
                </p>
              </div>

              <div className={`${styles.featureCard} ${styles.fadeInUp} ${styles.delay1}`} tabIndex={0}>
                <Monitor className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>Cross-Platform</h3>
                <p className={styles.featureDescription}>
                  Available for Windows, macOS, and Linux with native performance and platform integration.
                </p>
              </div>

              <div className={`${styles.featureCard} ${styles.fadeInUp} ${styles.delay2}`} tabIndex={0}>
                <Store className={styles.featureIcon} aria-hidden="true" />
                <h3 className={styles.featureTitle}>Microsoft Store</h3>
                <p className={styles.featureDescription}>
                  Available on Windows through Microsoft Store for easy installation and automatic updates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Product Showcase */}
        <section className={styles.productShowcase}>
          <div className={styles.container}>
            <h2 className={`${styles.sectionTitle} ${styles.fadeInUp}`}>
              See It In Action
            </h2>

            <div className={`${styles.screenshotPlaceholder} ${styles.fadeInUp} ${styles.delay1}`}>
              <div>
                <p style={{ marginBottom: '1rem', fontWeight: 600 }}>Product Screenshot Placeholder</p>
                <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                  Gen Image Factory Interface Preview<br />
                  (Replace with actual app screenshots)
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </Layout>
  );
}

