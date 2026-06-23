# Quick Start Guide

## Loading the Extension

### Step 1: Open Chrome Extensions Page
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)

### Step 2: Load Unpacked Extension
1. Click **"Load unpacked"** button
2. Navigate to the `leetcode-to-github-sync` directory
3. Click **"Select Folder"**

The extension should now appear in your extensions list with a purple icon.

### Step 3: Verify Installation
1. Click the extension icon in your toolbar
2. You should see the onboarding popup

## Initial Configuration

### Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name like "LeetCode Sync"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)

### Configure the Extension

1. Click the extension icon
2. Enter a **Master PIN** (4-32 characters, e.g., `MySecurePin123`)
3. Paste your **GitHub token**
4. Click **"Authenticate"**
5. Search for and select your target repository
6. Click **"Save Repository"**

## Test the Setup

### Create a Test Submission

1. Go to https://leetcode.com/problems/two-sum/
2. Submit any solution (even a wrong one first)
3. Once accepted, the extension will automatically sync it

### Verify the Sync

1. Go to your GitHub repository
2. You should see a new directory: `0001_two-sum/`
3. Inside: `solution.py` (or your language) and `README.md`

## Troubleshooting

### Extension Icon Not Showing
- Refresh the page: `Ctrl+R` (or `Cmd+R` on Mac)
- Reload the extension: Go to `chrome://extensions/` and click the refresh icon

### "Invalid Token" Error
- Verify the token was copied completely
- Check that the token hasn't expired
- Ensure it has `repo` scope permissions

### Submissions Not Syncing
- Verify the extension is enabled on LeetCode
- Check the popup for queue status
- Try solving a new problem
- Check browser console for errors (F12)

### Repository Not Found
- Ensure you have write access to the repository
- Try creating a new test repository
- Verify the repository name in the popup

## File Locations

- **Extension Directory**: `/home/ubuntu/leetcode-to-github-sync/`
- **Manifest**: `manifest.json`
- **Source Code**: `src/` directory
- **Documentation**: `README.md`, `FILE_MANIFEST.md`

## Next Steps

1. **Solve LeetCode Problems**: The extension will automatically sync accepted solutions
2. **Monitor Queue**: Check the popup to see sync status
3. **Customize Repository**: Add additional configuration as needed
4. **Review Generated READMEs**: Each problem gets an auto-generated README

## Security Notes

- Your Master PIN is **never stored** - only used for encryption
- Your GitHub token is **encrypted locally** with AES-GCM
- All data stays **on your computer** - no external servers
- The extension **cannot access** other websites or your GitHub account directly

## Support

For issues or questions:
1. Check the `README.md` for detailed documentation
2. Review the `FILE_MANIFEST.md` for code structure
3. Check browser console (F12) for error messages
4. Verify all configuration steps above

---

**Version**: 1.0.0  
**Last Updated**: June 22, 2026
