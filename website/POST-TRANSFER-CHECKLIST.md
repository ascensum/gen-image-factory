# Post-Repository-Transfer Checklist

This checklist contains all steps needed to complete Story 2.3 deployment after transferring the repository to the ShiftlineTools organization.

## Prerequisites
- ✅ Repository transferred to ShiftlineTools organization
- ✅ GitHub Actions workflow file created (`.github/workflows/deploy-site.yml`)
- ✅ CNAME file created (`website/static/CNAME`)
- ✅ Docusaurus config URL set to `https://genimage.shiftlinetools.com`

## Steps to Complete After Transfer

### 1. GitHub Pages Configuration

- [ ] Go to repository settings → Pages
- [ ] Under "Source", select "GitHub Actions" (not "Deploy from a branch")
- [ ] Save settings
- [ ] Wait for first deployment to complete (triggered automatically or manually)

### 2. DNS Configuration

- [ ] Log in to Cloudflare
- [ ] Select the `shiftlinetools.com` domain
- [ ] Go to DNS settings
- [ ] Add CNAME record:
  - **Name**: `genimage`
  - **Type**: CNAME
  - **Target**: `shiftlinetools.github.io`
  - **Proxy status**: Proxied (orange cloud) or DNS only (gray cloud)
- [ ] Save the record
- [ ] Wait for DNS propagation (usually 5-15 minutes)
- [ ] Verify DNS resolution: `dig genimage.shiftlinetools.com` or use online DNS checker

### 3. Custom Domain Verification

- [ ] Go to repository settings → Pages
- [ ] Under "Custom domain", enter: `genimage.shiftlinetools.com`
- [ ] Click "Save"
- [ ] GitHub will verify the domain (may take a few minutes)
- [ ] Wait for HTTPS certificate provisioning (automatic via Let's Encrypt)

### 4. Deployment Validation

- [ ] Verify site is accessible at `https://genimage.shiftlinetools.com`
- [ ] Check that all pages load correctly
- [ ] Test navigation and sidebar functionality
- [ ] Verify internal links work
- [ ] Check that assets (images, CSS, JS) load correctly
- [ ] Validate HTTPS certificate is valid
- [ ] Test on multiple devices/browsers

### 5. Privacy Firewall Validation

- [ ] Verify internal documentation (`docs/prd/`, `docs/stories/`, etc.) is NOT accessible
- [ ] Confirm only content from `public_docs/` is included in build
- [ ] Check that no internal references leak into public site

### 6. Automated Deployment Test

- [ ] Make a small change to a file in `public_docs/` (e.g., add a comment)
- [ ] Commit and push to `main` branch
- [ ] Verify GitHub Actions workflow triggers automatically
- [ ] Check that deployment completes successfully
- [ ] Verify changes appear on the live site after deployment

### 7. Documentation Updates

- [ ] Update `website/DEPLOYMENT.md` with actual deployment URL if needed
- [ ] Document any issues encountered and their solutions
- [ ] Update Story 2.3 with completion status

## Troubleshooting

### Workflow fails to deploy

- Check GitHub Actions logs for errors
- Verify Node.js version matches (should be 20)
- Ensure `website/package-lock.json` is committed
- Check that Pages permissions are set correctly in repository settings

### Custom domain not working

- Verify DNS CNAME record points to `shiftlinetools.github.io`
- Check DNS propagation status
- Verify CNAME file exists in `website/static/CNAME`
- Check GitHub Pages settings for custom domain verification status

### HTTPS not working

- GitHub Pages automatically provisions SSL certificates
- May take 10-30 minutes after domain verification
- Ensure DNS is properly configured before verification
- Check certificate status in repository Pages settings

### Site shows 404 errors

- Verify baseUrl in `docusaurus.config.js` is `/`
- Check that all internal links use absolute paths starting with `/`
- Ensure build output includes all assets
- Check GitHub Actions build logs for warnings

## Notes

- The workflow is configured to deploy on push to `main` branch when files in `website/` or `public_docs/` change
- Manual deployment can be triggered via "workflow_dispatch" in GitHub Actions
- The workflow uses official GitHub Actions (`actions/deploy-pages`) for deployment
- Node.js version is set to 20 to match project requirements

