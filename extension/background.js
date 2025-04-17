// Track analyzing state
let isAnalyzing = false;
let activeUrls = new Set();

// Initialize storage
chrome.storage.local.get(['blockedUrls', 'allowedUrls'], (data) => {
    if (!data.blockedUrls) {
        chrome.storage.local.set({ blockedUrls: {} });
    }
    if (!data.allowedUrls) {
        chrome.storage.local.set({ allowedUrls: {} });
    }
});

// Verify storage is working
chrome.storage.local.get(null, (data) => {
    console.log('Current storage state:', data);
});

// Add complete cleanup function
function cleanupAllData() {
    return new Promise((resolve) => {
        // Clear all chrome storage
        chrome.storage.local.clear(() => {
            // Reset all state variables
            isAnalyzing = false;
            activeUrls.clear();
            
            // Clear any other extension storage
            chrome.storage.session?.clear?.();
            
            // Query and reload all tabs
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (!tab.url.startsWith('chrome://') && 
                        !tab.url.startsWith('chrome-extension://')) {
                        chrome.tabs.update(tab.id, {
                            url: chrome.runtime.getURL('block.html') + 
                                '?reason=no-session' +
                                `&url=${encodeURIComponent(tab.url)}` +
                                `&original_url=${encodeURIComponent(tab.url)}`
                        });
                    }
                });
                resolve();
            });
        });
    });
}

// Add session timeout checker
function checkSessionTimeout() {
    chrome.storage.local.get(['sessionData'], (data) => {
        if (data.sessionData?.endTime && data.sessionData.state === 'active') {
            if (Date.now() >= data.sessionData.endTime) {
                console.log('Session expired, performing complete cleanup');
                cleanupAllData();
            }
        }
    });
}

// Check session timeout every minute
setInterval(checkSessionTimeout, 60000);

// Add immediate check when extension loads
checkSessionTimeout();

// Add URL normalization function
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove common tracking parameters
        urlObj.searchParams.delete('utm_source');
        urlObj.searchParams.delete('utm_medium');
        urlObj.searchParams.delete('utm_campaign');
        // Remove trailing slashes and convert to lowercase
        return urlObj.toString().toLowerCase().replace(/\/$/, '');
    } catch (e) {
        console.error('URL normalization error:', e);
        return url.toLowerCase();
    }
}

// Add URL state tracking
function isBlockPage(url) {
    return url.includes('block.html');
}

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
    if (changeInfo.status === 'loading' && tab.url) {
        console.log('Processing URL:', tab.url);
        
        try {
            // Skip if this is already a block page
            if (isBlockPage(tab.url)) {
                const reason = getBlockPageReason(tab.url);
                console.log('Already on block page with reason:', reason);
                if (reason === 'blocked' || reason === 'no-session') {
                    return; // Don't reprocess blocked or no-session pages
                }
            }

            // Skip other internal URLs
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') || 
                tab.url.includes('localhost:5000')) {
                return;
            }

            // Get all necessary data atomically
            const data = await chrome.storage.local.get(['sessionData', 'blockedUrls', 'allowedUrls']);
            const { sessionData, blockedUrls, allowedUrls } = data;
            
            if (!sessionData || sessionData.state !== 'active') {
                console.log('No active session');
                await chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=no-session' +
                        `&url=${encodeURIComponent(tab.url)}` +
                        `&original_url=${encodeURIComponent(tab.url)}`
                });
                return;
            }

            // Normalize the URL for consistent comparison
            const normalizedUrl = normalizeUrl(tab.url);
            const urlKey = `${normalizedUrl}-${sessionData.startTime}`;

            console.log('Checking URL:', {
                original: tab.url,
                normalized: normalizedUrl,
                key: urlKey,
                blockedUrls: blockedUrls
            });

            // Check if URL was previously allowed - important to check first
            if (allowedUrls && allowedUrls[urlKey]) {
                console.log('URL was previously allowed:', tab.url);
                activeUrls.delete(tab.url); // Clean up tracking
                return; // Let the navigation continue without interruption
            }

            // Check if URL was previously blocked
            if (blockedUrls && blockedUrls[urlKey]) {
                console.log('URL was previously blocked:', normalizedUrl);
                if (!isBlockPage(tab.url) || getBlockPageReason(tab.url) !== 'blocked') {
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

            // Only analyze if URL isn't being processed
            if (!activeUrls.has(tab.url)) {
                activeUrls.add(tab.url);
                await chrome.tabs.update(tabId, {
                    url: chrome.runtime.getURL('block.html') + 
                        '?reason=analyzing' +
                        `&url=${encodeURIComponent(tab.url)}` +
                        `&original_url=${encodeURIComponent(tab.url)}` +
                        `&domain=${encodeURIComponent(sessionData.domain)}` +
                        `&context=${encodeURIComponent(JSON.stringify(sessionData.context || []))}`
                });
            }

        } catch (error) {
            console.error('Error:', error);
            activeUrls.delete(tab.url);
        }
    }
});

// Clear analyzed URLs periodically
setInterval(() => {
    analyzedUrls.clear();
}, 60000); // Clear every minute

// Add tab creation listener
chrome.tabs.onCreated.addListener(async (tab) => {
    // Handle new tab creation immediately
    console.log('New tab created:', tab);
    
    // Check if it's a new tab page and no active session
    if (tab.pendingUrl === 'chrome://newtab/' || tab.url === 'chrome://newtab/') {
        const data = await chrome.storage.local.get(['sessionData']);
        
        // Only block new tab if there's no active session
        if (!data.sessionData || data.sessionData.state !== 'active') {
            const noSessionBlockUrl = chrome.runtime.getURL('block.html') + 
                `?reason=no-session` +
                `&url=${encodeURIComponent('chrome://newtab/')}` +
                `&original_url=${encodeURIComponent('chrome://newtab/')}`;
            
            await chrome.tabs.update(tab.id, { url: noSessionBlockUrl });
        }
        // If there is an active session, let the custom newtab page handle it
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);

    if (message.type === 'URL_BLOCKED') {
        // Store blocked URL with session ID and reason
        chrome.storage.local.get(['blockedUrls', 'sessionData'], (data) => {
            const blockedUrls = data.blockedUrls || {};
            const normalizedUrl = normalizeUrl(message.url);
            const urlKey = `${normalizedUrl}-${data.sessionData.startTime}`;
            blockedUrls[urlKey] = {
                timestamp: Date.now(),
                reason: message.reason,
                originalUrl: message.url
            };
            chrome.storage.local.set({ blockedUrls });
        });
    }

    if (message.type === 'URL_ALLOWED') {
        chrome.storage.local.get(['allowedUrls', 'sessionData'], (data) => {
            const allowedUrls = data.allowedUrls || {};
            const urlKey = `${message.url}-${data.sessionData.startTime}`;
            allowedUrls[urlKey] = {
                timestamp: Date.now()
            };
            chrome.storage.local.set({ allowedUrls });
        });
    }

    if (message.type === 'START_SESSION') {
        // Clear previous session's blocked URLs when starting new session
        chrome.storage.local.set({ blockedUrls: {} });
        
        const sessionData = {
            state: 'active',
            startTime: Date.now(),
            endTime: Date.now() + message.duration,
            domain: message.domain,
            context: message.context // Store context with session
        };
        
        // Store complete session data
        chrome.storage.local.set({
            sessionData: sessionData,
            domain: message.domain,
            context: message.context,
            sessionDuration: message.duration
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError });
                return;
            }
            
            // Verify storage
            chrome.storage.local.get(null, (data) => {
                console.log('Complete storage state after START_SESSION:', data);
                sendResponse({ success: true, data: data });
            });
        });

        return true; // Keep message channel open
    }

    if (message.type === 'END_SESSION') {
        cleanupAllData().then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    // Debug storage command
    if (message.type === 'DEBUG_STORAGE') {
        chrome.storage.local.get(null, (data) => {
            console.log('Current storage contents:', data);
            sendResponse({ success: true, data: data });
        });
    }

    return true; // Keep message channel open for async response
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(`Storage key "${key}" changed:`, 
            '\nOld:', oldValue,
            '\nNew:', newValue);
    }
});
