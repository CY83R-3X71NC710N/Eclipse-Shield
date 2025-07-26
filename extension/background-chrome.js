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

// Verify storage is working
chrome.storage.local.get(null, (data) => {
    console.log('Current storage state:', data);
});

// Add complete cleanup function
function cleanupAllData() {
    chrome.storage.local.clear(() => {
        console.log('All extension data has been cleared');
    });
    sessionStorage.clear();
    localStorage.clear();
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (isBlockPage(tab.url)) {
                chrome.tabs.update(tab.id, { url: 'chrome://newtab' });
            }
        });
    });
}

// Add session timeout checker
function checkSessionTimeout() {
    chrome.storage.local.get(['sessionData'], (data) => {
        if (data.sessionData && data.sessionData.endTime) {
            const timeRemaining = data.sessionData.endTime - Date.now();
            
            if (timeRemaining <= 0) {
                console.log('Session has expired, cleaning up data');
                cleanupAllData();
            } else {
                console.log(`Session active, ${timeRemaining / 1000}s remaining`);
            }
        }
    });
}

// Check session timeout every minute
setInterval(checkSessionTimeout, 60000);

// === BROWSER RESTART HANDLERS ===
// Handle browser startup/restart to restore session state properly

chrome.runtime.onStartup.addListener(async () => {
    console.log('🔄 Browser restarted, checking session state...');
    
    try {
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData'], resolve);
        });
        
        if (data.sessionData && data.sessionData.state === 'active') {
            // Check if session is still valid (not expired)
            if (data.sessionData.endTime && data.sessionData.endTime > Date.now()) {
                console.log('✅ Active session restored after browser restart');
                // Session is still valid, refresh new tab pages to show DuckDuckGo
                refreshNewTabPages();
            } else {
                console.log('⏰ Session expired during browser restart, cleaning up');
                cleanupAllData();
                refreshNewTabPages(); // Refresh to show block pages
            }
        } else {
            console.log('🚫 No active session found after browser restart, blocking all tabs');
            blockAllTabs();
            refreshNewTabPages(); // Refresh new tab pages to show block pages
        }
    } catch (error) {
        console.error('Error handling browser startup:', error);
        // On error, default to blocking for safety
        blockAllTabs();
        refreshNewTabPages();
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    console.log('🔧 Extension installed/reloaded, checking session state...');
    
    try {
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData'], resolve);
        });
        
        if (data.sessionData && data.sessionData.state === 'active') {
            // Check if session is still valid (not expired)
            if (data.sessionData.endTime && data.sessionData.endTime > Date.now()) {
                console.log('✅ Active session found after extension reload');
                // Session is still valid, refresh new tab pages to show DuckDuckGo
                setTimeout(() => refreshNewTabPages(), 1000); // Delay to ensure tabs are ready
            } else {
                console.log('⏰ Session expired, cleaning up and blocking tabs');
                cleanupAllData();
                setTimeout(() => {
                    blockAllTabs();
                    refreshNewTabPages();
                }, 1000);
            }
        } else {
            console.log('🚫 No active session found after extension reload, blocking all tabs');
            setTimeout(() => {
                blockAllTabs();
                refreshNewTabPages(); // This will refresh existing new tab pages to show block page
            }, 1000); // Delay to ensure extension is fully loaded
        }
    } catch (error) {
        console.error('Error handling extension installation:', error);
        // On error, default to blocking for safety
        setTimeout(() => {
            blockAllTabs();
            refreshNewTabPages();
        }, 1000);
    }
});

// Function to block all currently open tabs
function blockAllTabs() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.url && !isExemptUrl(tab.url)) {
                console.log('🚫 Blocking existing tab after restart:', tab.url);
                chrome.tabs.update(tab.id, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(tab.url)}`
                });
            }
        });
    });
}

// Function to refresh new tab pages when session state changes
function refreshNewTabPages() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            // Check if this is a new tab page (either our extension, browser new tab, or startpage)
            const isNewTabPage = tab.url && (
                tab.url.includes(chrome.runtime.getURL('newtab.html')) ||
                tab.url === 'chrome://newtab/' ||
                tab.url === 'about:newtab' ||
                tab.url.includes('newtab') ||
                tab.url.includes('startpage.com') ||
                tab.url === 'chrome://new-tab-page/' ||
                tab.url === 'edge://newtab/' ||
                tab.url === 'about:home' ||
                tab.url === 'about:blank' ||
                (tab.title && (tab.title.includes('New Tab') || tab.title === ''))
            );
            
            if (isNewTabPage) {
                console.log('🔄 Refreshing new tab page:', tab.url, 'title:', tab.title);
                
                // Force reload the tab to trigger our new tab override
                chrome.tabs.reload(tab.id, { bypassCache: true }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('Tab reload failed (tab may have been closed):', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Successfully refreshed tab:', tab.id);
                    }
                });
            }
        });
    });
}

// === TAB-BASED BLOCKING MECHANISM ===
// Use tabs.onUpdated for blocking (webRequest blocking requires special permissions)

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



// Helper function to normalize URLs for consistent checking
function normalizeUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.toLowerCase() + parsed.pathname;
    } catch (e) {
        return url.toLowerCase();
    }
}

// Helper function to check if URL is a block page
function isBlockPage(url) {
    return url && url.includes(chrome.runtime.getURL('block.html'));
}

// Add immediate check when extension loads
checkSessionTimeout();

// === IMMEDIATE NEW TAB REFRESH ON EXTENSION LOAD ===
// Force refresh existing new tab pages when extension is loaded/reloaded
setTimeout(() => {
    console.log('🔄 Extension loaded - force refreshing all new tab pages...');
    refreshNewTabPages();
}, 500); // Small delay to ensure extension is fully initialized

// Also try a more aggressive approach - redirect existing new tabs to our override
setTimeout(() => {
    console.log('🔄 Secondary pass - redirecting new tabs to Eclipse Shield...');
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            // More aggressive detection of new tab pages
            const isDefaultNewTab = tab.url && (
                tab.url === 'chrome://newtab/' ||
                tab.url === 'about:newtab' ||
                tab.url === 'chrome://new-tab-page/' ||
                tab.url === 'edge://newtab/' ||
                tab.url === 'about:home' ||
                (tab.url.includes('startpage') && !tab.url.includes('blocked'))
            );
            
            if (isDefaultNewTab) {
                console.log('🔄 Redirecting default new tab to Eclipse Shield:', tab.url);
                chrome.tabs.update(tab.id, {
                    url: chrome.runtime.getURL('newtab.html')
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log('Tab redirect failed:', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Successfully redirected tab to Eclipse Shield');
                    }
                });
            }
        });
    });
}, 1500); // Longer delay for this more aggressive approach

// === SESSION CHANGE MONITORING ===
// Listen for storage changes to detect session state changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.sessionData) {
        const oldValue = changes.sessionData.oldValue;
        const newValue = changes.sessionData.newValue;
        
        console.log('📊 Session state changed:', {
            old: oldValue?.state,
            new: newValue?.state
        });
        
        // Check if session became active or inactive
        const sessionBecameActive = (!oldValue || oldValue.state !== 'active') && 
                                   (newValue && newValue.state === 'active');
        const sessionBecameInactive = (oldValue && oldValue.state === 'active') && 
                                     (!newValue || newValue.state !== 'active');
        
        if (sessionBecameActive) {
            console.log('✅ Session activated - refreshing new tab pages');
            refreshNewTabPages();
        } else if (sessionBecameInactive) {
            console.log('🚫 Session deactivated - refreshing new tab pages');
            refreshNewTabPages();
        }
    }
});

function getBlockPageReason(url) {
    try {
        const params = new URLSearchParams(new URL(url).search);
        return params.get('reason');
    } catch (e) {
        return null;
    }
}

// Update URL monitoring
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
        // Skip internal browser URLs and the extension pages
        if (tab.url.startsWith('chrome') || 
            tab.url.startsWith('chrome-extension') || 
            tab.url.startsWith('about') || 
            tab.url.startsWith('edge') ||
            tab.url.includes('localhost:5000')) {
            console.log('Skipping internal/dev URL:', tab.url);
            return;
        }
        
        // Check for active session FIRST
        const { sessionData } = await chrome.storage.local.get('sessionData');
        if (!sessionData || sessionData.state !== 'active') {
            // No active session, block the site if it's not already the block page
            if (!isBlockPage(tab.url)) {
                console.log('No active session, blocking URL:', tab.url);
                await chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(tab.url)}` + // Pass the blocked URL
                        `&original_url=${encodeURIComponent(tab.url)}` // Pass original URL
                });
            }
            return; // Stop further processing if no active session
        }

        // --- Active Session Logic ---
        // Process URLs that aren't our block page
        if (!isBlockPage(tab.url)) {
            const normalizedUrl = normalizeUrl(tab.url);
            const { blockedUrls, allowedUrls } = await chrome.storage.local.get(['blockedUrls', 'allowedUrls']);
            
            // Check if URL has already been analyzed
            const urlKey = normalizedUrl;
            if (blockedUrls && blockedUrls[urlKey]) {
                console.log('URL is blocked:', tab.url);
                
                // Send update to popup
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: tab.url,
                    action: 'blocked',
                    reason: blockedUrls[urlKey].reason
                });
                
                // Redirect to block page if not already there with the correct reason
                if (getBlockPageReason(tab.url) !== 'blocked') {
                    await chrome.tabs.update(tabId, {
                        url: chrome.runtime.getURL('block.html') + 
                            '?reason=blocked' +
                            `&url=${encodeURIComponent(tab.url)}` +
                            `&original_url=${encodeURIComponent(tab.url)}` +
                            `&domain=${encodeURIComponent(sessionData.domain)}` +
                            `&explanation=${encodeURIComponent(blockedUrls[urlKey].reason)}`
                    });
                }
                return;
            }

            // Only analyze if URL isn't being processed and isn't already allowed
            if (!activeUrls.has(tab.url) && (!allowedUrls || !allowedUrls[urlKey])) {
                activeUrls.add(tab.url);
                console.log('Redirecting to analysis page for:', tab.url);
                await chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=analyzing' +
                        `&url=${encodeURIComponent(tab.url)}` +
                        `&original_url=${encodeURIComponent(tab.url)}` +
                        `&domain=${encodeURIComponent(sessionData.domain)}` +
                        `&context=${encodeURIComponent(JSON.stringify(sessionData.context || []))}`
                });
            } else if (allowedUrls && allowedUrls[urlKey]) {
                // URL is already allowed, just send update to popup
                console.log('URL already allowed:', tab.url);
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: tab.url,
                    action: 'allowed',
                    reason: allowedUrls[urlKey].reason || 'Content is productive'
                });
            }

        } else {
            // This is our block page - we're already handling this URL
            console.log('Block page detected:', tab.url);
            // Ensure the correct section is shown based on the reason
            const reason = getBlockPageReason(tab.url);
            if (reason === 'no-session' && sessionData && sessionData.state === 'active') {
                // If session became active while on no-session block page, redirect back
                const params = new URLSearchParams(new URL(tab.url).search);
                const originalUrl = params.get('original_url');
                if (originalUrl) {
                    console.log('Session now active, redirecting from no-session block page to:', originalUrl);
                    await chrome.tabs.update(tabId, { url: originalUrl });
                }
            }
        }

    } catch (error) {
        console.error('Error in tabs.onUpdated listener:', error);
    }
});

// DEPRECATED: The following webNavigation.onBeforeNavigate listener is commented out
// This prevents duplicate/conflicting blocking attempts
/*
// Handle direct navigation (typing URL, bookmarks, etc.)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Ignore subframe navigation and non-http(s) protocols
    if (details.frameId !== 0 || !details.url.startsWith('http')) {
        return;
    }

    try {
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData', 'blockedUrls', 'allowedUrls', 'directVisits'], resolve);
        });

        // Check for active session FIRST
        if (!data.sessionData || data.sessionData.state !== 'active') {
            // No active session, block the site if it's not the block page
            if (!isBlockPage(details.url)) {
                console.log('No active session, blocking direct navigation:', details.url);
                chrome.tabs.update(details.tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(details.url)}` +
                        `&original_url=${encodeURIComponent(details.url)}`
                });
            }
            return; // Stop further processing if no active session
        }

        // --- Active Session Logic ---
        const { sessionData, domain, context, blockedUrls = {}, allowedUrls = {}, directVisits = {} } = data;
        
        console.log(`Direct navigation detected: ${details.url}`);
        
        // Skip chrome:// URLs, chrome-extension:// URLs, and about: URLs
        if (details.url.startsWith('chrome://') || 
            details.url.startsWith('chrome-extension://') || 
            details.url.startsWith('about:') ||
            details.url.startsWith('file://') ||
            details.url === 'about:blank' ||
            details.url.includes('localhost:5000')) {
            console.log('Skipping internal/dev URL');
            return;
        }
        
        // Create a standardized key for checking
        const urlKey = normalizeUrl(details.url);
        
        // Skip if this URL has already been processed (allowed, blocked, or direct visit analyzed)
        if (allowedUrls[urlKey] || blockedUrls[urlKey] || directVisits[urlKey]) {
            console.log(`URL already processed: ${details.url}`);
            // Send update to popup if needed (e.g., for stats)
            let updateData = {};
            if (allowedUrls[urlKey]) updateData = { action: 'allowed', reason: allowedUrls[urlKey].reason };
            else if (blockedUrls[urlKey]) updateData = { action: 'blocked', reason: blockedUrls[urlKey].reason };
            else if (directVisits[urlKey]) updateData = { action: directVisits[urlKey].isProductive ? 'allowed' : 'blocked', reason: directVisits[urlKey].reason, directVisit: true };
            
            if (updateData.action) {
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: details.url,
                    ...updateData
                });
            }
            return;
        }
        
        // Create a session ID for consistent caching
        const sessionId = sessionData.startTime.toString();
        
        // Get the referrer which can help detect search engine clicks
        let referrer = '';
        try {
            const tabInfo = await new Promise(resolve => {
                chrome.tabs.get(details.tabId, resolve);
            });
            
            // Get opener tab info if available
            if (tabInfo.openerTabId) {
                const openerInfo = await new Promise(resolve => { 
                    chrome.tabs.get(tabInfo.openerTabId, info => resolve(info || {}));
                });
                referrer = openerInfo.url || '';
            } else {
                 // For direct navigation, referrer might be empty or less useful
                 // We might rely more on the absence of a typical referrer (like a search engine)
                 referrer = details.transitionQualifiers?.includes('from_address_bar') ? 'address_bar' : '';
            }
            console.log(`Referrer for ${details.url}: ${referrer}`);
        } catch (e) {
            console.error('Error getting referrer:', e);
        }

        // Check if it's likely a search engine result click
        const isLikelySearchClick = referrer && (
            referrer.includes('google.com/search') ||
            referrer.includes('bing.com/search') ||
            referrer.includes('duckduckgo.com') ||
            referrer.includes('brave.com/search') ||
            referrer.includes('startpage.com/sp/search') // Check for Startpage search URLs (if user navigates there manually)
        );

        if (isLikelySearchClick) {
            console.log('Likely search click, letting onUpdated handle analysis:', details.url);
            // Let the onUpdated listener handle analysis via the block page redirection
            // This ensures consistent analysis flow
            return; 
        }

        // If not a search click, treat as direct visit and analyze directly
        console.log('Analyzing direct visit:', details.url);
        const url = details.url;
        const timestamp = Date.now();

        // Call backend for analysis
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                domain: sessionData.domain,
                context: sessionData.context || [],
                session_id: sessionId,
                is_direct_visit: true // Indicate direct visit
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Direct visit analysis result:', result);

        // Store result in directVisits
        directVisits[urlKey] = {
            url: url,
            timestamp: timestamp,
            isProductive: result.isProductive,
            reason: result.explanation || (result.isProductive ? 'Direct visit allowed' : 'Direct visit blocked')
        };
        await new Promise(resolve => {
            chrome.storage.local.set({ directVisits }, resolve);
        });
        console.log('Added direct visit analysis result to storage:', urlKey);


        // Handle result: Allow or Block
        if (result.isProductive) {
            // For allowed URLs, add to allowedUrls as well for consistency?
            // Or keep separate? Keeping separate for now to distinguish direct visits.
            allowedUrls[urlKey] = { // Add to allowedUrls too for faster checks later
                 url: url,
                 timestamp: timestamp,
                 reason: result.explanation || 'Direct visit allowed'
            };
            await new Promise(resolve => {
                chrome.storage.local.set({ allowedUrls }, resolve);
            });
            console.log('Added direct visit to allowedUrls:', url);
            
            // Send update to popup
            try {
                // Method 1: Standard message
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: url,
                    action: 'allowed',
                    reason: result.explanation,
                    directVisit: true
                });
                
                // Method 2: Also send URL_ALLOWED message like from block.js
                sendMessageSafely({
                    type: 'URL_ALLOWED',
                    url: url,
                    reason: result.explanation
                });
            } catch (e) {
                console.log('Error sending messages to popup (this is normal if popup is not open):', e);
            }
        } else {
            // For blocked URLs, add to blockedUrls
            blockedUrls[urlKey] = {
                url: url,
                timestamp: timestamp,
                reason: result.explanation || 'Not relevant to current task'
            };
            
            await new Promise(resolve => {
                chrome.storage.local.set({ blockedUrls }, resolve);
            });
            console.log('Added direct visit to blockedUrls:', url);
            
            // Send update to popup
            try {
                // Method 1: Standard message
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: url,
                    action: 'blocked',
                    reason: result.explanation,
                    directVisit: true
                });
                
                // Method 2: Also send URL_BLOCKED message like from block.js
                sendMessageSafely({
                    type: 'URL_BLOCKED',
                    url: url,
                    reason: result.explanation
                });
            } catch (e) {
                console.log('Error sending messages to popup (this is normal if popup is not open):', e);
            }
            
            // If URL should be blocked, redirect to block page
            try {
                const tab = await new Promise(resolve => {
                    chrome.tabs.get(details.tabId, resolve);
                });
                // Check if the tab still exists and the URL hasn't changed
                if (tab && tab.url === url) {
                    const blockUrl = chrome.runtime.getURL('block.html') + 
                        `?reason=blocked` + // Use 'blocked' reason
                        `&url=${encodeURIComponent(url)}` +
                        `&original_url=${encodeURIComponent(url)}` +
                        `&explanation=${encodeURIComponent(result.explanation || 'Direct visit blocked')}`;
                    
                    chrome.tabs.update(details.tabId, { url: blockUrl });
                }
            } catch (e) {
                console.error('Error blocking tab:', e);
            }
        }
    } catch (error) {
        console.error('Error in navigation event handler:', error);
    }
}, { url: [{ schemes: ["http", "https"] }] }); // Only listen for http/https
*/
// END OF DEPRECATED NAVIGATION HANDLER

// Add URL analysis result handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'URL_BLOCKED') {
        const normalizedUrl = normalizeUrl(message.url);
        
        // Store the blocked URL
        chrome.storage.local.get(['blockedUrls'], (data) => {
            const blockedUrls = data.blockedUrls || {};
            blockedUrls[normalizedUrl] = {
                url: message.url,
                timestamp: Date.now(),
                reason: message.reason || 'Not relevant to current task'
            };
            
            chrome.storage.local.set({ blockedUrls }, () => {
                // Remove from active URLs
                activeUrls.delete(message.url);
                
                // Notify popup about URL analysis update
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: message.url,
                    action: 'blocked',
                    reason: message.reason || 'Not relevant to current task'
                });
                
                console.log('URL blocked:', message.url);
                sendResponse({ success: true });
            });
        });
        return true;
    }
    
    if (message.type === 'URL_ALLOWED') {
        const normalizedUrl = normalizeUrl(message.url);
        
        // Store the allowed URL
        chrome.storage.local.get(['allowedUrls'], (data) => {
            const allowedUrls = data.allowedUrls || {};
            allowedUrls[normalizedUrl] = {
                url: message.url,
                timestamp: Date.now(),
                reason: message.reason || 'Content is productive'
            };
            
            chrome.storage.local.set({ allowedUrls }, () => {
                // Remove from active URLs
                activeUrls.delete(message.url);
                
                // Notify popup about URL analysis update
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: message.url,
                    action: 'allowed',
                    reason: message.reason || 'Content is productive'
                });
                
                console.log('URL allowed:', message.url);
                sendResponse({ success: true });
            });
        });
        return true;
    }
});

// Handle popup iframe storage requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'storage-get') {
        chrome.storage.local.get(message.keys, (result) => {
            sendResponse({ result });
        });
        return true;
    }
    
    if (message.type === 'storage-set') {
        chrome.storage.local.set(message.items, () => {
            sendResponse({ success: true });
        });
        return true;
    }
    
    if (message.type === 'START_SESSION') {
        const sessionData = {
            state: 'active',
            startTime: Date.now(),
            endTime: Date.now() + message.duration,
            domain: message.domain,
            context: message.context
        };
        
        chrome.storage.local.set({ 
            sessionData,
            domain: message.domain,
            context: message.context
        }, () => {
            console.log('Session started:', sessionData);
            sendResponse({ success: true });
        });
        return true;
    }
});

// Listen for web navigation events to capture direct visits
chrome.webNavigation.onCompleted.addListener(async (details) => {
    // Only care about main frame navigations (not iframes, etc)
    if (details.frameId !== 0) return;
    
    try {
        // Get the current session data
        const data = await new Promise(resolve => {
            chrome.storage.local.get(['sessionData', 'domain', 'context', 'directVisits'], resolve);
        });
        
        // Skip if there's no active session
        if (!data.sessionData || !data.domain) return;
        
        const url = details.url;
        const domain = data.domain;
        const context = data.context || [];
        
        console.log(`Direct navigation detected: ${url}`);
        
        // Skip chrome:// URLs, chrome-extension:// URLs, and about: URLs
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') || 
            url.startsWith('about:') ||
            url.startsWith('file://') ||
            url === 'about:blank') {
            console.log('Skipping internal browser URL');
            return;
        }
        
        // Skip URLs we've already analyzed (in allowed or blocked lists)
        const urlsData = await new Promise(resolve => {
            chrome.storage.local.get(['allowedUrls', 'blockedUrls'], resolve);
        });
        
        const allowedUrls = urlsData.allowedUrls || {};
        const blockedUrls = urlsData.blockedUrls || {};
        
        // Create a standardized key for checking
        const urlKey = normalizeUrl(url);
        
        // Skip if this URL has already been processed - but log it so we can debug
        if (allowedUrls[urlKey]) {
            console.log(`URL already in allowed list: ${url}`);
            return;
        }
        
        if (blockedUrls[urlKey]) {
            console.log(`URL already in blocked list: ${url}`);
            return;
        }
        
        // Also check if it's already in directVisits
        const directVisits = data.directVisits || {};
        if (directVisits[urlKey]) {
            console.log(`URL already in direct visits: ${url}`);
            return;
        }
        
        // Create a session ID for consistent caching
        const sessionId = data.sessionData.startTime.toString();
        
        // Get the referrer which can help detect search engine clicks
        let referrer = '';
        try {
            const tabInfo = await new Promise(resolve => {
                chrome.tabs.get(details.tabId, resolve);
            });
            
            // Get opener tab info if available
            if (tabInfo.openerTabId) {
                const openerInfo = await new Promise(resolve => { 
                    chrome.tabs.get(tabInfo.openerTabId, info => resolve(info || {}));
                });
                referrer = openerInfo.url || '';
            }
        } catch (e) {
            console.error('Error getting referrer:', e);
        }
        
        console.log(`Analyzing direct visit: ${url}`, { referrer });
        
        // Analyze this URL
        const serverUrl = 'http://localhost:5000/analyze';
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                domain: domain,
                context: context,
                session_id: sessionId,
                referrer: referrer,
                direct_visit: true // Flag to indicate this is a direct visit
            })
        });
        
        if (!response.ok) {
            console.error(`Server returned ${response.status} ${response.statusText}`);
            return;
        }
        
        const result = await response.json();
        console.log('Direct visit analysis result:', result);
        
        // Store the result in directVisits
        const timestamp = Date.now();
        directVisits[urlKey] = {
            url: url,
            timestamp: timestamp,
            isProductive: result.isProductive,
            explanation: result.explanation,
            confidence: result.confidence,
            reason: result.explanation
        };
        
        // Update storage with new direct visit
        await new Promise(resolve => {
            chrome.storage.local.set({ directVisits }, resolve);
        });
        
        console.log('Saved direct visit to storage:', directVisits[urlKey]);
        
        // Now ALWAYS add the site to either allowedUrls or blockedUrls as well
        // This ensures it shows up in the statistics
        if (result.isProductive) {
            // For allowed URLs from direct visits, also store in allowedUrls
            allowedUrls[urlKey] = {
                url: url,
                timestamp: timestamp,
                reason: result.explanation || 'Content is productive'
            };
            
            await new Promise(resolve => {
                chrome.storage.local.set({ allowedUrls }, resolve);
            });
            
            console.log('Added direct visit to allowedUrls:', url);
            
            // Send update to popup - force this with multiple methods
            try {
                // Method 1: Standard message
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: url,
                    action: 'allowed',
                    reason: result.explanation,
                    directVisit: true
                });
                
                // Method 2: Also send URL_ALLOWED message like from block.js
                sendMessageSafely({
                    type: 'URL_ALLOWED',
                    url: url,
                    reason: result.explanation
                });
            } catch (e) {
                console.log('Error sending messages to popup (this is normal if popup is not open):', e);
            }
        } else {
            // For blocked URLs, add to blockedUrls
            blockedUrls[urlKey] = {
                url: url,
                timestamp: timestamp,
                reason: result.explanation || 'Not relevant to current task'
            };
            
            await new Promise(resolve => {
                chrome.storage.local.set({ blockedUrls }, resolve);
            });
            
            console.log('Added direct visit to blockedUrls:', url);
            
            // Send update to popup
            try {
                // Method 1: Standard message
                sendMessageSafely({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: url,
                    action: 'blocked',
                    reason: result.explanation,
                    directVisit: true
                });
                
                // Method 2: Also send URL_BLOCKED message like from block.js
                sendMessageSafely({
                    type: 'URL_BLOCKED',
                    url: url,
                    reason: result.explanation
                });
            } catch (e) {
                console.log('Error sending messages to popup (this is normal if popup is not open):', e);
            }
            
            // If URL should be blocked, redirect to block page
            try {
                const tab = await new Promise(resolve => {
                    chrome.tabs.get(details.tabId, resolve);
                });
                
                if (tab && tab.url === url) {
                    const blockUrl = chrome.runtime.getURL('block.html') + 
                        `?url=${encodeURIComponent(url)}` +
                        `&reason=${encodeURIComponent(result.explanation)}` +
                        `&original_url=${encodeURIComponent(url)}`;
                    
                    chrome.tabs.update(details.tabId, { url: blockUrl });
                }
            } catch (e) {
                console.error('Error blocking tab:', e);
            }
        }
    } catch (error) {
        console.error('Error in navigation event handler:', error);
    }
});

//=+=+=+=+=+=+=+=+=+=+=
//      New Tab Override - Uses tab-based blocking
//=+=+=+=+=+=+=+=+=+=+=

// Fast new tab override that checks session state immediately
var TabOverride = function (id, url) {
    if (typeof url == "undefined") return;
    if (url.search(/(chrome|opera|vivaldi):\/.*\/startpage/ig) == -1) return;
    if (url.search(/(download|history|bookmark|extension|news)/ig) != -1) return;

    // Immediately check session state and redirect accordingly
    chrome.storage.local.get(['sessionData'], (data) => {
        let targetUrl;
        
        if (!data.sessionData || data.sessionData.state !== 'active') {
            // No active session - redirect to block page
            targetUrl = chrome.runtime.getURL('block.html') + '?reason=no-session-newtab';
            console.log("[📦] No active session, redirecting new tab to block page");
        } else {
            // Active session - redirect to new tab page
            targetUrl = chrome.runtime.getURL('newtab.html');
            console.log("[📦] Active session, redirecting to new tab page");
        }

        // Update tab immediately without delays
        chrome.tabs.update(id, { url: targetUrl }, (updatedTab) => {
            if (chrome.runtime.lastError) {
                console.log("[📦] Could not override tab:", chrome.runtime.lastError.message);
            } else {
                console.log("[📦] Successfully overrode tab to", targetUrl);
            }
        });
    });
};

// Event listener for tab creation - immediate response
chrome.tabs.onCreated.addListener(function (tab) {
    // Check for new tab pages immediately without delay
    const isNewTab = !tab.url || 
                     tab.url === 'chrome://newtab/' || 
                     tab.url.includes('newtab') || 
                     tab.url.includes('startpage') || 
                     tab.url === 'about:newtab';
    
    if (isNewTab) {
        // Override immediately - no waiting
        TabOverride(tab.id, tab.url || tab.pendingUrl || 'chrome://newtab/');
    }
});
