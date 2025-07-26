// This is an Opera-specific background script that handles new tab detection
// without using chrome_url_overrides which Opera doesn't allow for most extensions

// Add a wrapper function for runtime.sendMessage to handle missing receivers gracefully
function sendMessageSafely(message) {
    try {
        chrome.runtime.sendMessage(message, response => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                // This will happen normally when popup isn't open - don't treat as an error
                console.log('Expected messaging error (receiver likely not active):', lastError.message);
            }
            return response;
        });
    } catch (e) {
        console.log('Failed to send message:', e);
    }
}

// Track analyzing state
let isAnalyzing = false;
let activeUrls = new Set();

// Initialize storage
chrome.storage.local.get(['blockedUrls', 'allowedUrls'], async (data) => {
    if (!data.blockedUrls || !data.allowedUrls) {
        await chrome.storage.local.set({
            blockedUrls: {},
            allowedUrls: {}
        });
        console.log('Initialized URL tracking storage.');
    }
});

// Opera-specific new tab handling - simplified to prevent loops
let redirectedTabs = new Set(); // Track tabs we've already redirected

chrome.tabs.onCreated.addListener((tab) => {
    console.log("[📦] New tab created:", tab);
    
    // Only process if we haven't already redirected this tab
    if (redirectedTabs.has(tab.id)) {
        return;
    }
    
    // Check if this is a browser new tab page (not our extension)
    const isBrowserNewTab = !tab.url || 
                           tab.url === 'chrome://newtab/' || 
                           tab.url === 'opera://startpage/' ||
                           tab.url === 'about:newtab';
    
    // Make sure it's not already our extension page
    const isOurExtension = tab.url && tab.url.startsWith(chrome.runtime.getURL(''));
    
    if (isBrowserNewTab && !isOurExtension) {
        console.log("[📦] Detected browser new tab, redirecting to extension page");
        
        // Mark this tab as redirected to prevent loops
        redirectedTabs.add(tab.id);
        
        // Clean up tracking after a delay
        setTimeout(() => redirectedTabs.delete(tab.id), 5000);
        
        // Redirect to our new tab page
        setTimeout(() => {
            try {
                const newTabURL = chrome.runtime.getURL('newtab.html');
                chrome.tabs.update(tab.id, { url: newTabURL }, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                        console.log("[📦] Could not redirect tab:", chrome.runtime.lastError.message);
                        redirectedTabs.delete(tab.id); // Remove from tracking if failed
                    } else {
                        console.log("[📦] Successfully redirected to custom new tab page");
                    }
                });
            } catch (error) {
                console.log("[📦] Error redirecting tab:", error);
                redirectedTabs.delete(tab.id); // Remove from tracking if failed
            }
        }, 100);
    }
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
    redirectedTabs.delete(tabId);
});

// === CORE BLOCKING FUNCTIONALITY ===
// Block all browsing when no session is active

// Helper function to normalize URLs for consistent checking
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
    } catch (e) {
        return url;
    }
}

// Helper function to check if URL is a block page
function isBlockPage(url) {
    return url && url.includes(chrome.runtime.getURL('block.html'));
}

// Helper function to check if URL should be exempt from blocking
function isExemptUrl(url) {
    return url.startsWith('chrome://') || 
           url.startsWith('chrome-extension://') || 
           url.startsWith('opera://') ||
           url.startsWith('about:') ||
           url.startsWith('file://') ||
           url === 'about:blank' ||
           url.includes('localhost:5000') ||
           isBlockPage(url);
}

// Handle all navigation attempts - block if no active session
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Ignore subframe navigation and non-http(s) protocols
    if (details.frameId !== 0 || !details.url.startsWith('http')) {
        return;
    }

    try {
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData', 'blockedUrls', 'allowedUrls'], resolve);
        });

        console.log('[🛡️] Navigation attempt:', details.url);
        console.log('[🛡️] Session data:', data.sessionData);

        // Check for active session FIRST
        if (!data.sessionData || data.sessionData.state !== 'active') {
            // No active session, block ALL sites except exempt URLs
            if (!isExemptUrl(details.url)) {
                console.log('[🛡️] No active session, blocking navigation:', details.url);
                chrome.tabs.update(details.tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(details.url)}` +
                        `&original_url=${encodeURIComponent(details.url)}`
                });
                return;
            }
        }

        // If there's an active session, let normal blocking logic handle it
        // (You can add more sophisticated blocking logic here if needed)
        
    } catch (error) {
        console.error('[🛡️] Error in navigation handler:', error);
        // On error, default to blocking for safety
        if (!isExemptUrl(details.url)) {
            chrome.tabs.update(details.tabId, {
                url: chrome.runtime.getURL('block.html') + 
                    '?reason=error' +
                    `&url=${encodeURIComponent(details.url)}`
            });
        }
    }
});

// Handle tab updates (when user types in address bar or page redirects)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process URL changes
    if (!changeInfo.url || !changeInfo.url.startsWith('http')) {
        return;
    }

    try {
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData'], resolve);
        });

        console.log('[🛡️] Tab updated to:', changeInfo.url);

        // Check for active session
        if (!data.sessionData || data.sessionData.state !== 'active') {
            // No active session, block ALL sites except exempt URLs
            if (!isExemptUrl(changeInfo.url)) {
                console.log('[🛡️] No active session, blocking tab update:', changeInfo.url);
                chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(changeInfo.url)}` +
                        `&original_url=${encodeURIComponent(changeInfo.url)}`
                });
                return;
            }
        }
        
    } catch (error) {
        console.error('[🛡️] Error in tab update handler:', error);
        // On error, default to blocking for safety
        if (!isExemptUrl(changeInfo.url)) {
            chrome.tabs.update(tabId, {
                url: chrome.runtime.getURL('block.html') + 
                    '?reason=error' +
                    `&url=${encodeURIComponent(changeInfo.url)}`
            });
        }
    }
});

// Function to block all currently open tabs when session ends
function blockAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url && !isExemptUrl(tab.url)) {
                console.log('[🛡️] Blocking existing tab:', tab.url);
                chrome.tabs.update(tab.id, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=session-ended' +
                        `&url=${encodeURIComponent(tab.url)}`
                });
            }
        });
    });
}

// Listen for session state changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.sessionData) {
        const oldSession = changes.sessionData.oldValue;
        const newSession = changes.sessionData.newValue;
        
        console.log('[🛡️] Session state changed:', { oldSession, newSession });
        
        // If session ended or became inactive, block all tabs
        if (oldSession && oldSession.state === 'active' && 
            (!newSession || newSession.state !== 'active')) {
            console.log('[🛡️] Session ended, blocking all tabs');
            blockAllTabs();
        }
    }
});

// On extension startup, check if we should block existing tabs
chrome.runtime.onStartup.addListener(async () => {
    const data = await new Promise(resolve => {
        chrome.storage.local.get(['sessionData'], resolve);
    });
    
    if (!data.sessionData || data.sessionData.state !== 'active') {
        console.log('[🛡️] Extension startup with no active session, blocking all tabs');
        blockAllTabs();
    }
});

// Also check on extension install/enable
chrome.runtime.onInstalled.addListener(async () => {
    const data = await new Promise(resolve => {
        chrome.storage.local.get(['sessionData'], resolve);
    });
    
    if (!data.sessionData || data.sessionData.state !== 'active') {
        console.log('[🛡️] Extension installed/enabled with no active session, blocking all tabs');
        blockAllTabs();
    }
});

// === END BLOCKING FUNCTIONALITY ===

// Add complete cleanup function
function cleanupAllData() {
    chrome.storage.local.clear(() => {
        console.log('All extension data has been cleared');
        // After clearing data, block all tabs since there's no active session
        blockAllTabs();
    });
    sessionStorage.clear();
    localStorage.clear();
}

console.log("[📦] Eclipse Shield background script loaded (Opera version)");
