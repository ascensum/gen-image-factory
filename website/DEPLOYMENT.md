# Deployment Guide

This guide covers deploying the Gen Image Factory documentation site to GitHub Pages with a custom subdomain.

## Custom Subdomain Configuration

The site is configured to be served at `genimage.shiftlinetools.com`.

### Two CNAME Records Required

1. **CNAME File in Repository** (`/website/static/CNAME`):
   - Contains: `genimage.shiftlinetools.com`
   - Tells GitHub Pages which domain to serve the site on
   - This file is automatically included in the build output

2. **DNS CNAME Record in Cloudflare**:
   - **Name**: `genimage` (or `genimage.shiftlinetools.com`)
   - **Type**: CNAME
   - **Target**: `shiftlinetools.github.io` (GitHub Pages server - lowercase, no space)
   - **Note**: Organization handle is "ShiftlineTools" (no space), display name is "Shiftline Tools" (with space)
   - **Purpose**: Points the subdomain to GitHub's Pages infrastructure

### DNS Configuration Steps

1. Log in to Cloudflare
2. Select the `shiftlinetools.com` domain
3. Go to DNS settings
4. Add a new CNAME record:
   - Name: `genimage`
   - Target: `shiftlinetools.github.io` (GitHub Pages server - lowercase, no space)
   - **Note**: Organization handle is "ShiftlineTools" (no space), display name is "Shiftline Tools" (with space)
   - Proxy status: Proxied (orange cloud) or DNS only (gray cloud) - both work
5. Save the record

**Note**: After transferring the repository to the ShiftlineTools organization, the DNS CNAME target will be `shiftlinetools.github.io`.

### GitHub Pages Configuration

After the first deployment:

1. Go to repository settings → Pages
2. Under "Custom domain", enter: `genimage.shiftlinetools.com`
3. GitHub will verify the domain
4. Once verified, HTTPS will be automatically enabled via Let's Encrypt

### Verification

After DNS propagation (usually 5-15 minutes):

1. Check DNS resolution: `dig genimage.shiftlinetools.com` or use online DNS checker
2. Verify the site loads at `https://genimage.shiftlinetools.com`
3. Check HTTPS certificate is valid (should be automatic)

## Deployment Workflow

The deployment is automated via GitHub Actions (to be configured in Story 2.3):

1. Push to `main` branch triggers deployment
2. GitHub Actions builds the Docusaurus site from `/website`
3. Site is deployed to GitHub Pages
4. CNAME file ensures GitHub serves the site at the custom domain
5. DNS CNAME record routes traffic from Cloudflare to GitHub

## Troubleshooting

### Site not loading at custom domain

- Verify DNS CNAME record points to `shiftlinetools.github.io` (after repo transfer to ShiftlineTools org)
- Check DNS propagation: `dig genimage.shiftlinetools.com`
- Verify CNAME file exists in `/website/static/CNAME`
- Check GitHub Pages settings for custom domain verification

### HTTPS not working

- GitHub Pages automatically provisions SSL certificates via Let's Encrypt
- May take a few minutes after domain verification
- Ensure DNS is properly configured before verification

### 404 errors

- Verify baseUrl in `docusaurus.config.js` is `/`
- Check that all internal links use absolute paths starting with `/`
- Ensure build output includes all assets

## References

- [GitHub Pages Custom Domain Documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)

