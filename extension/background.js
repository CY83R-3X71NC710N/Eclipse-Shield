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

// Add immediate check when extension loads
checkSessionTimeout();

// Add URL normalization function
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove tracking parameters
        urlObj.searchParams.delete('utm_source');
        urlObj.searchParams.delete('utm_medium');
        urlObj.searchParams.delete('utm_campaign');
        // Normalize the URL by lowercasing and removing trailing slash
        return urlObj.toString().toLowerCase().replace(/\/$/, '');
    } catch (e) {
        console.error('URL normalization error:', e);
        return url.toLowerCase();
    }
}

// Add URL state tracking
function isBlockPage(url) {
    try {
        return url.includes(chrome.runtime.id) && url.includes('block.html');
    } catch (e) {
        return false;
    }
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
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
        // Skip internal browser URLs and the extension pages
        if (tab.url.startsWith('chrome') || 
            tab.url.startsWith('chrome-extension') || 
            tab.url.startsWith('about') || 
            tab.url.startsWith('edge') ||
            tab.url.includes('localhost:5000')) {
            return;
        }
        
        // Only proceed if we have an active session
        const { sessionData } = await chrome.storage.local.get('sessionData');
        if (!sessionData || sessionData.state !== 'active') {
            console.log('No active session, skipping URL monitoring');
            return;
        }

        // Process URLs that aren't our block page
        if (!isBlockPage(tab.url)) {
            const normalizedUrl = normalizeUrl(tab.url);
            const { blockedUrls, allowedUrls } = await chrome.storage.local.get(['blockedUrls', 'allowedUrls']);
            
            // Check if URL has already been analyzed
            const urlKey = normalizedUrl;
            
            if (blockedUrls && blockedUrls[urlKey]) {
                console.log('URL is blocked:', tab.url);
                
                // Send update to popup
                chrome.runtime.sendMessage({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: tab.url,
                    action: 'blocked',
                    reason: blockedUrls[urlKey].reason
                });
                
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

            // Only analyze if URL isn't being processed and isn't already allowed
            if (!activeUrls.has(tab.url) && (!allowedUrls || !allowedUrls[urlKey])) {
                activeUrls.add(tab.url);
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
                chrome.runtime.sendMessage({
                    type: 'URL_ANALYSIS_UPDATE',
                    url: tab.url,
                    action: 'allowed',
                    reason: allowedUrls[urlKey].reason || 'Content is productive'
                });
            }

        } else {
            // This is our block page - we're already handling this URL
            console.log('Block page detected:', tab.url);
        }

    } catch (error) {
        console.error('Error in tabs.onUpdated listener:', error);
    }
});

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
                chrome.runtime.sendMessage({
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
                chrome.runtime.sendMessage({
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
        
        // Skip chrome:// URLs, chrome-extension:// URLs, and about: URLs
        if (url.startsWith('chrome://') || 
            url.startsWith('chrome-extension://') || 
            url.startsWith('about:') ||
            url.startsWith('file://') ||
            url === 'about:blank') {
            return;
        }
        
        // Skip URLs we've already analyzed (in allowed or blocked lists)
        const urlsData = await new Promise(resolve => {
            chrome.storage.local.get(['allowedUrls', 'blockedUrls'], resolve);
        });
        
        const allowedUrls = urlsData.allowedUrls || {};
        const blockedUrls = urlsData.blockedUrls || {};
        
        // Create a standardized key for checking
        const urlKey = new URL(url).href;
        
        // Skip if this URL has already been processed
        if (allowedUrls[urlKey] || blockedUrls[urlKey]) {
            return;
        }
        
        // Also check if it's already in directVisits
        const directVisits = data.directVisits || {};
        if (directVisits[urlKey]) {
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
            referrer = tabInfo.openerTabId ? 
                (await new Promise(resolve => { 
                    chrome.tabs.get(tabInfo.openerTabId, info => resolve(info?.url || ''));
                })) : '';
        } catch (e) {
            console.error('Error getting referrer:', e);
        }
        
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
                referrer: referrer
            })
        });
        
        if (!response.ok) {
            console.error(`Server returned ${response.status} ${response.statusText}`);
            return;
        }
        
        const result = await response.json();
        
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
        
        // Send a message to any open popup to refresh
        chrome.runtime.sendMessage({
            type: 'URL_ANALYSIS_UPDATE',
            url: url,
            action: result.isProductive ? 'allowed' : 'blocked',
            reason: result.explanation,
            directVisit: true
        }).catch(() => {}); // Catch errors if popup isn't open
        
        // If URL should be blocked, redirect to block page
        if (!result.isProductive) {
            // Check if tab still exists and is on the same URL
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
