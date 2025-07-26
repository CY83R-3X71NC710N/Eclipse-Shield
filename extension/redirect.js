// redirect.js - UPDATED TO HANDLE 'get-current-tab' MESSAGE

document.addEventListener('DOMContentLoaded', () => {
    const frame = document.getElementById('popup-frame');
    const loading = document.getElementById('loading');
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let currentState = null;

    // Function to handle loading state
    function handleFrameLoad() {
        console.log('redirect.js: Frame load event triggered');

        // Get state from chrome storage and send to iframe
        chrome.storage.local.get(['appState'], (result) => {
            if (result.appState) {
                currentState = result.appState;
                restoreState();
            }
        });

        setTimeout(() => {
            frame.classList.add('iframe-loaded');
            frame.style.opacity = '1';
            loading.style.opacity = '0';
            setTimeout(() => {
                loading.style.display = 'none';
            }, 300);
        }, 500);
    }

    // Listen for state updates from popup.html
    window.addEventListener('message', (event) => {
        if (event.origin !== 'http://localhost:5000') return; // IMPORTANT: Validate origin!

        if (event.data.type === 'SAVE_STATE') {
            currentState = event.data.state;
            console.log('redirect.js: Saving state:', currentState);
            chrome.storage.local.set({ appState: currentState }, () => {
                // Confirm save back to popup
                frame.contentWindow.postMessage({
                    type: 'STATE_SAVED',
                    state: currentState
                }, '*');
                // Restore state after saving
                restoreState();
            });
            return; // Important: Return to prevent further processing in this listener
        }

        if (event.data.type === 'storage-get') {
            const keys = event.data.keys;
            const responsePort = event.ports[0]; // Get the response port from iframe message

            chrome.storage.local.get(keys, (result) => {
                console.log("redirect.js: storage-get - sending response to iframe:", result); // Debug log
                responsePort.postMessage({ type: 'storage-response', result: result }); // Send result back to iframe
                responsePort.close();
            });
            return; // Important: Return to prevent further processing in this listener
        }

        if (event.data.type === 'storage-set') {
            const items = event.data.items;
            const responsePort = event.ports[0]; // Get the response port

            chrome.storage.local.set(items, () => {
                console.log("redirect.js: storage-set - sending confirmation to iframe"); // Debug log
                responsePort.postMessage({ type: 'storage-response' }); // Send confirmation back
                responsePort.close();
            });
            return; // Important: Return to prevent further processing in this listener
        }

        if (event.data.type === 'storage-remove') {
            const keys = event.data.keys;
            const responsePort = event.ports[0]; // Get response port

            chrome.storage.local.remove(keys, () => {
                console.log("redirect.js: storage-remove - sending confirmation to iframe"); // Debug log
                responsePort.postMessage({ type: 'storage-response' }); // Send confirmation back
                responsePort.close();
            });
            return; // Important: Return to prevent further processing in this listener
        }

        if (event.data.type === 'get-current-tab') {
            const responsePort = event.ports[0]; // Get response port

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const currentTab = tabs[0];
                console.log("redirect.js: get-current-tab - sending tab info to iframe:", currentTab); // Debug log
                responsePort.postMessage({ type: 'tab-response', tab: currentTab }); // Send tab info back
                responsePort.close();
            });
            return; // Important: Return to prevent further processing in this listener
        }

        // Handle redirect messages
        if (event.data.type === 'redirect') {
            console.log('redirect.js: Handling redirect request:', event.data.url);
            
            // Check if we're in extension mode
            if (chrome?.tabs) {
                chrome.tabs.create({ url: event.data.url });
            } else {
                // Development mode - open in new window
                window.open(event.data.url, '_blank');
            }
            return;
        }
    });

    // Only restore state on frame load and when state changes
    let lastRestoredState = null;

    function restoreState() {
        if (frame.contentWindow && currentState && JSON.stringify(currentState) !== JSON.stringify(lastRestoredState)) {
            console.log('redirect.js: Restoring new state:', currentState);
            frame.contentWindow.postMessage({
                type: 'RESTORE_STATE',
                state: currentState
            }, '*');
            lastRestoredState = JSON.parse(JSON.stringify(currentState));
        }
    }

    // Function to handle loading error
    function handleFrameError(error) {
        console.log('redirect.js: Handling error:', error, 'Retry count:', retryCount);

        if (retryCount < MAX_RETRIES) {
            loading.innerHTML = `Connection error. Retrying... (${retryCount + 1}/${MAX_RETRIES})<br>
                               <small>Make sure Flask server is running on port 5000</small>`;
            loading.style.color = '#ff9900';
            retryCount++;

            setTimeout(initializeFrame, 2000);
        } else {
            loading.innerHTML = `Failed to connect to server.<br>
                               <small>Please check if Flask server is running on port 5000</small>`;
            loading.style.color = '#ff0000';
        }
    }

    // Initialize frame
    function initializeFrame() {
        try {
            frame.src = 'http://localhost:5000/ext-popup';
            console.log('redirect.js: Setting frame source to:', frame.src);
        } catch (error) {
            console.error('redirect.js: Failed to initialize frame:', error);
            handleFrameError('Failed to initialize frame');
        }
    }

    // Add event listeners
    frame.addEventListener('load', handleFrameLoad);
    frame.addEventListener('error', (e) => {
        console.error('redirect.js: Frame error:', e);
        handleFrameError('Frame failed to load');
    });

    // Initialize the frame
    console.log('redirect.js: Initializing frame...');
    initializeFrame();

    // Safety timeout
    setTimeout(() => {
        if (loading.style.display !== 'none') {
            handleFrameError('Connection timeout');
        }
    }, 10000);
});