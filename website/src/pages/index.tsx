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
  ExternalLink,
  FileText,
} from 'lucide-react';
import styles from './index.module.css';
import { PARTNER_DATA } from '../data/ecosystem';
import clsx from 'clsx';

interface FeatureItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  className?: string;
  openInNewTab?: boolean;
}

function Feature({title, description, icon, link, className, openInNewTab}: FeatureItem) {
  const isExternal = link.startsWith('http') || openInNewTab;
  return (
    <Link 
      to={link} 
      className={clsx(styles.featureCard, className)}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      style={{ display: 'block', height: '100%', color: 'inherit', cursor: 'pointer', textDecoration: 'none' }}
    >
      {icon}
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDescription}>{description}</p>
    </Link>
  );
}

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
              <Link to="/docs/getting-started/installation" className={`${styles.btn} ${styles.btnSecondary}`} aria-label="View Documentation">
                <BookOpen className={styles.ctaIcon} /> Documentation
              </Link>
              <a href="#microsoft-store" className={`${styles.btn} ${styles.btnSecondary}`} aria-label="Get from Microsoft Store">
                <Store className={styles.ctaIcon} /> Microsoft Store
              </a>
            </div>
          </div>
        </section>

        {/* Integrated Platforms/APIs Section */}
        <section className={styles.integratedApisSection}>
          <div className={styles.container}>
            <h2 className={`${styles.sectionTitle} ${styles.fadeInUp}`}>
              INTEGRATION PLATFORMS / APIs
            </h2>
            <div className={`${styles.apiLinks} ${styles.fadeInUp} ${styles.delay1}`}>
              {PARTNER_DATA.integratedApis.map((api, index) => (
                <a
                  key={index}
                  href={api.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.apiLink}
                >
                  {api.name} <ExternalLink size={16} />
                </a>
              ))}
            </div>
          </div>
          <p className={`${styles.apiDisclosure} ${styles.fadeInUp} ${styles.delay2}`}>
            *Optional API integrations for professional workflows.
          </p>
        </section>

        {/* Features Section */}
        <section className={styles.featuresSection}>
          <div className={styles.container}>
            <h2 className={`${styles.sectionTitle} ${styles.fadeInUp}`}>
              Powerful Features
            </h2>

            <div className={styles.featuresGrid}>
              {([
                {
                  title: 'Keyword & Template Lab',
                  description: 'Integrate external .txt prompt templates and .csv keyword libraries for automated image orchestration and metadata control.',
                  icon: <FileText className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/user-guide/settings#template-configuration',
                  className: `${styles.fadeInUp}`,
                },
                {
                  title: 'AI-Powered Generation',
                  description: 'Leverage advanced AI models for high-quality image creation with intelligent processing capabilities.',
                  icon: <BrainCircuit className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/user-guide/settings#required-api-keys',
                  className: `${styles.fadeInUp} ${styles.delay1}`,
                },
                {
                  title: 'Quality Control',
                  description: 'Automated quality assessment using AI to ensure consistent, professional-grade image output.',
                  icon: <ShieldCheck className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/user-guide/failed-images-review',
                  className: `${styles.fadeInUp} ${styles.delay2}`,
                },
                {
                  title: 'Batch Processing',
                  description: 'Process multiple images efficiently with optimized workflows and sequential job execution.',
                  icon: <Zap className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/user-guide/settings#job-configuration',
                  className: `${styles.fadeInUp} ${styles.delay3}`,
                },
                {
                  title: 'Metadata Generation',
                  description: 'Automatic metadata creation for generated images with comprehensive tagging and organization.',
                  icon: <Database className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/user-guide/settings#job-configuration',
                  className: `${styles.fadeInUp} ${styles.delay1}`,
                },
                {
                  title: 'Cross-Platform',
                  description: 'Available for Windows, macOS, and Linux with native performance and platform integration.',
                  icon: <Monitor className={styles.featureIcon} aria-hidden="true" />,
                  link: '/docs/getting-started/installation',
                  className: `${styles.fadeInUp} ${styles.delay2}`,
                },
              ] as FeatureItem[]).map((feature, index) => (
                <Feature
                  key={index}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  link={feature.link}
                  className={feature.className}
                  openInNewTab={feature.openInNewTab}
                />
              ))}
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

        {/* Recommended Apps Section */}
        <section className={styles.recommendedAppsSection}>
          <div className={styles.container}>
            <h2 className={`${styles.sectionTitle} ${styles.fadeInUp}`}>
              Recommended Apps
            </h2>

            <div className={styles.recommendedApps}>
              {PARTNER_DATA.recommendedApps.map((app) => (
                <div key={app.id} className={`${styles.recommendedAppCard} ${styles.fadeInUp}`}>
                  <h3 className={styles.recommendedAppTitle}>{app.name}</h3>
                  <p className={styles.recommendedAppDescription}>{app.description}</p>
                  <a
                    href={app.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.recommendedAppButton}
                  >
                    LEARN MORE →
                  </a>
                </div>
              ))}
            </div>

            <p className={styles.recommendedAppsDisclosure}>
              *Shiftline Tools recommends software used in our internal pro workflows.
            </p>
          </div>
        </section>

      </main>
    </Layout>
  );
}

