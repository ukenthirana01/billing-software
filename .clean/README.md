# Relyce Book

## GitHub Update Setup (Offline App + Online Updates)
This app is offline-first. Internet is needed only for update check/download.

### One-time setup
1. Push this project to a GitHub repository.
2. Keep `latest.json` in the default branch (`main`).
3. In app Settings -> Updates, set manifest URL:
   - `https://raw.githubusercontent.com/ukenthirana01/Billing-software-/main/latest.json`

### Release workflow (regular updates)
1. Increase version in `package.json` (example: `1.0.1`).
2. Commit and push changes.
3. Create and push tag:
   - `git tag v1.0.1`
   - `git push origin v1.0.1`
4. GitHub Action `Build And Release Installer` will:
   - Build Windows installer
   - Create GitHub Release
   - Upload installer `.exe`
5. GitHub Action `Update Latest Manifest` will:
   - Read release details
   - Update `latest.json` automatically with new version + download URL

### Workflow files
- `.github/workflows/release-build.yml`
- `.github/workflows/update-manifest.yml`

### Notes
- Use semantic tags: `vMAJOR.MINOR.PATCH` (example: `v1.0.2`)
- Do not reuse an old tag/version number.
- Test one machine after every release using Settings -> Updates -> Check for Updates.
