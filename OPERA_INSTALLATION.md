# Eclipse Shield - Opera Browser Installation Guide

## The Problem
Opera browser has stricter policies and doesn't allow most extensions to use `chrome_url_overrides` to override the new tab page. This causes two main issues:

1. **Error**: `'chrome_url_overrides' is not allowed for specified extension ID`
2. **Error**: `You cannot create new tabs while in locked fullscreen mode`

## The Solution

We've created Opera-specific files to work around these limitations:

### Files Created:
- `manifest-opera.json` - Opera-compatible manifest without chrome_url_overrides
- `background-opera.js` - Opera-specific background script with safer tab handling
- `newtab-override.js` - Content script for new tab detection

### Installation Steps for Opera:

1. **Backup your current extension files**:
   ```bash
   cp manifest.json manifest-chrome.json
   cp background.js background-chrome.js
   ```

2. **Replace with Opera-compatible versions**:
   ```bash
   cp manifest-opera.json manifest.json
   cp background-opera.js background.js
   ```

3. **Load the extension in Opera**:
   - Open Opera browser
   - Go to `opera://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select your extension folder

### Key Changes Made:

1. **Removed `chrome_url_overrides`**: Opera doesn't allow this for most extensions
2. **Added safer tab handling**: Prevents fullscreen mode errors
3. **Used content scripts**: Alternative method to detect and redirect new tabs
4. **Added error handling**: Graceful fallbacks when tab operations fail

### Alternative Approach:

If the new tab override still doesn't work in Opera, users can:
1. Manually navigate to the extension's new tab page: `chrome-extension://[extension-id]/newtab.html`
2. Bookmark this URL for easy access
3. Use the extension popup instead of new tab override

### Testing:

1. Install the Opera version
2. Open a new tab - it should redirect to your custom page
3. Check the console for any remaining errors
4. Test the extension's other features (blocking, popup, etc.)

### Reverting to Chrome/Edge Version:

If you need to go back to the Chrome-compatible version:
```bash
cp manifest-chrome.json manifest.json
cp background-chrome.js background.js
```

## Updated Blocking Behavior

### 🛡️ **Default State: BLOCK EVERYTHING**

When no block session is active, Eclipse Shield now blocks ALL browsing activity:

- **All websites are blocked** and redirected to `block.html`
- **Address bar navigation is blocked** 
- **Existing tabs are blocked** when extension starts
- **New tabs redirect** to the extension's new tab page

### ✅ **Exempt URLs (Never Blocked)**

- `chrome://` and `opera://` internal pages
- `chrome-extension://` extension pages  
- `about:` protocol pages
- `file://` local files
- `localhost:5000` (development server)
- Extension's own `block.html` page

### 🔓 **How to Allow Browsing**

Users must explicitly start a focused work session via the extension popup:
1. Click the Eclipse Shield extension icon
2. Choose work context (school/work/personal)
3. Start a focused session
4. Only then will browsing be allowed based on session rules

### 🔒 **Session End Behavior**

When a session ends:
- All open tabs are immediately blocked
- Future navigation attempts are blocked
- User must start a new session to browse again

### 🧪 **Testing the Blocking**

Use the test page: `file:///workspaces/Eclipse-Shield/test-blocking.html`

1. **Without session**: All external links should redirect to block page
2. **With session**: Behavior follows your session rules
3. **Clear session**: All tabs immediately get blocked

## Notes:
- Opera's extension policies are more restrictive than Chrome
- The new tab override may not work as smoothly as in Chrome
- All other extension features should work normally
- Consider offering Opera users an alternative workflow if new tab override fails
