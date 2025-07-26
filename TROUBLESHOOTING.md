# Troubleshooting Opera Extension Issues

## Issue: Infinite Refresh Loop on New Tab

### Problem Description:
When opening a new tab in Opera, the page constantly refreshes and doesn't load properly.

### Root Cause:
This happens when both the background script and content scripts try to redirect the new tab simultaneously, creating a conflict where:
1. Background script detects new tab → redirects to extension page
2. Content script detects the redirect → tries to redirect again  
3. This creates an infinite loop

### Solution Applied:
1. **Removed content script approach** - Only using background script now
2. **Added tab tracking** - Prevents redirecting the same tab multiple times
3. **Better detection logic** - Only redirects actual browser new tabs, not extension pages
4. **Cleanup mechanism** - Removes tracking after 5 seconds and when tabs close

### Key Changes Made:

**Background Script (`background-opera.js`):**
- Added `redirectedTabs` Set to track processed tabs
- Only redirects browser new tabs (`chrome://newtab/`, `opera://startpage/`)
- Ignores extension URLs to prevent loops
- Automatic cleanup of tracking data

**Manifest (`manifest-opera.json`):**
- Removed `content_scripts` section completely
- Removed `newtab-override.js` from web accessible resources

### Testing Steps:
1. Reload the extension in Opera (`opera://extensions/`)
2. Open a new tab (Ctrl+T)
3. Should redirect once to extension page without refreshing
4. Check browser console for "[📦]" messages to verify behavior

### If Issues Persist:

**Option 1: Manual New Tab**
- Bookmark: `chrome-extension://[your-extension-id]/newtab.html`
- Use bookmark instead of Ctrl+T

**Option 2: Disable New Tab Override**
- Comment out the `chrome.tabs.onCreated.addListener` in background script
- Use extension popup only

**Option 3: Switch Back to Chrome Version**
```bash
./switch-browser.sh chrome
```

### Debug Information:
- Check `opera://extensions/` → Extension details → Inspect service worker
- Look for console messages starting with "[📦]"
- Verify no errors in the console

### Expected Behavior:
- New tab opens → Shows Opera's default briefly → Redirects to extension page → Stays stable
- No constant refreshing or flashing
- Extension page loads and functions normally
