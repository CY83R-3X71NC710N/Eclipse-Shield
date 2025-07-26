document.addEventListener('DOMContentLoaded', () => {
    // Chrome Storage wrapper for iframe
    const chromeStorage = {
        get: function(keys) {
            return new Promise((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => {
                    resolve(event.data.result);
                };
                window.parent.postMessage({
                    type: 'storage-get',
                    keys: keys
                }, '*', [channel.port2]);
            });
        },
        set: function(items) {
            return new Promise((resolve) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = () => resolve();
                window.parent.postMessage({
                    type: 'storage-set',
                    items: items
                }, '*', [channel.port2]);
            });
        }
    };

    // Initialize storage state
    let storageState = {
        sessionDuration: null,
        domain: null,
        context: [],
        sessionData: null,
        blockDuration: null,
        durationUnit: 'minutes',
        domainSelection: '',
        currentQuestion: '',
        currentAnswer: '',
        activeSection: 'blockDurationSelect',
        analysisStatus: {
            totalSites: 0,
            blockedSites: 0,
            allowedSites: 0,
            lastUrl: '',
            lastAction: '',
            lastReason: ''
        }
    };

    // Initialize by checking storage
    chromeStorage.get(['formState', 'blockedUrls', 'allowedUrls', 'directVisits']).then(data => {
        console.log('Initial storage and form state:', data);
        if (data.formState) {
            storageState = {...storageState, ...data.formState};
            restoreFormState();
        }
        
        // Update analysis stats with all data types
        updateAnalysisStats(data);
        
        // Force refresh of analysis display
        updateAnalysisUI();
    }).catch(err => {
        console.error('Storage access error:', err);
    });

    // Function to update analysis statistics
    function updateAnalysisStats(data) {
        let blockedCount = 0;
        let allowedCount = 0;

        if (data.blockedUrls) {
            blockedCount = Object.keys(data.blockedUrls).length;
        }
        
        if (data.allowedUrls) {
            allowedCount = Object.keys(data.allowedUrls).length;
        }

        // Add counts from direct visits if available
        if (data.directVisits) {
            Object.values(data.directVisits).forEach(visit => {
                if (visit.isProductive) {
                    // Only count if it's not already in allowedUrls
                    // This avoids double counting since we now store productive direct visits in both places
                    const urlInAllowed = data.allowedUrls && Object.values(data.allowedUrls).some(
                        allowed => allowed.url === visit.url
                    );
                    if (!urlInAllowed) {
                        allowedCount++;
                    }
                } else {
                    // Only count if not already in blockedUrls
                    const urlInBlocked = data.blockedUrls && Object.values(data.blockedUrls).some(
                        blocked => blocked.url === visit.url
                    );
                    if (!urlInBlocked) {
                        blockedCount++;
                    }
                }
            });
        }
        
        storageState.analysisStatus.blockedSites = blockedCount;
        storageState.analysisStatus.allowedSites = allowedCount;
        storageState.analysisStatus.totalSites = blockedCount + allowedCount;
            
        // Update the UI
        updateAnalysisUI();
    }
    
    // Function to update analysis UI
    function updateAnalysisUI() {
        const analysisSection = document.getElementById('analysisSection');
        if (!analysisSection) return;
        
        // Only make visible if it's the active section
        if (storageState.activeSection === 'analysisSection') {
            analysisSection.classList.remove('hidden');
            analysisSection.style.display = 'block';
            
            const analysisResultDiv = document.getElementById('analysisResult');
            if (analysisResultDiv) {
                analysisResultDiv.classList.remove('hidden');
                analysisResultDiv.style.display = 'block';
            }
            
            const resultDiv = document.getElementById('result');
            if (!resultDiv) return;
            
            resultDiv.classList.remove('hidden');
            resultDiv.style.display = 'block';
            
            const stats = storageState.analysisStatus;
            
            // Create the analysis display
            let statusHtml = `
                <div class="analysis-stats">
                    <h4>SESSION STATISTICS</h4>
                    <div class="stat-item">
                        <span class="stat-label">Sites Analyzed</span>
                        <span class="stat-value">${stats.totalSites}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Sites Allowed</span>
                        <span class="stat-value allowed">${stats.allowedSites}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Sites Blocked</span>
                        <span class="stat-value blocked">${stats.blockedSites}</span>
                    </div>
                </div>`;
                
            // Always retrieve recent URLs from storage to show the most recent one
            chromeStorage.get(['blockedUrls', 'allowedUrls', 'directVisits']).then(urlData => {
                let latestUrl = '';
                let latestTimestamp = 0;
                let action = '';
                let reason = '';
                
                // Check blocked URLs for most recent
                if (urlData.blockedUrls) {
                    Object.entries(urlData.blockedUrls).forEach(([url, data]) => {
                        if (data.timestamp && data.timestamp > latestTimestamp) {
                            latestUrl = data.url || url;
                            latestTimestamp = data.timestamp;
                            action = 'blocked';
                            reason = data.reason || '';
                        }
                    });
                }
                
                // Check allowed URLs for most recent
                if (urlData.allowedUrls) {
                    Object.entries(urlData.allowedUrls).forEach(([url, data]) => {
                        if (data.timestamp && data.timestamp > latestTimestamp) {
                            latestUrl = data.url || url;
                            latestTimestamp = data.timestamp;
                            action = 'allowed';
                            reason = data.reason || '';
                        }
                    });
                }
                
                // Check direct visits for most recent - new addition
                if (urlData.directVisits) {
                    Object.entries(urlData.directVisits).forEach(([url, data]) => {
                        if (data.timestamp && data.timestamp > latestTimestamp) {
                            latestUrl = data.url || url;
                            latestTimestamp = data.timestamp;
                            action = data.isProductive ? 'allowed' : 'blocked';
                            reason = data.reason || '';
                        }
                    });
                }
                
                // Based on what we found, update the UI appropriately
                let activityHtml = `
                    <div class="latest-activity">
                        <h4>LATEST ACTIVITY</h4>`;
                
                if (latestUrl) {
                    const actionClass = action === 'blocked' ? 'blocked' : 'allowed';
                    activityHtml += `
                        <div class="activity-item ${actionClass}">
                            <div class="activity-url">${latestUrl}</div>
                            <div class="activity-status ${actionClass}">${action.toUpperCase()}</div>
                            ${reason ? `<div class="activity-reason">${reason}</div>` : ''}
                        </div>`;
                    
                    // Update state with this latest activity
                    storageState.analysisStatus.lastUrl = latestUrl;
                    storageState.analysisStatus.lastAction = action;
                    storageState.analysisStatus.lastReason = reason;
                } else if (stats.totalSites === 0) {
                    activityHtml += `
                        <div class="activity-item neutral">
                            <div class="activity-status">No sites visited yet</div>
                            <div class="activity-info">Your browsing statistics will appear here</div>
                        </div>`;
                } else {
                    // Should rarely happen - have stats but can't find latest activity
                    const siteText = stats.totalSites === 1 ? 'site has' : 'sites have';
                    activityHtml += `
                        <div class="activity-item neutral">
                            <div class="activity-status">Site activity detected</div>
                            <div class="activity-info">${stats.totalSites} ${siteText} been analyzed</div>
                        </div>`;
                }
                
                activityHtml += `</div>`;
                            
                // Add session info with combined HTML
                addSessionInfo(resultDiv, statusHtml + activityHtml);
                
                // Also update total counts based on direct visits
                if (urlData.directVisits) {
                    let allowedFromDirect = 0;
                    let blockedFromDirect = 0;
                    
                    Object.values(urlData.directVisits).forEach(data => {
                        if (data.isProductive) {
                            allowedFromDirect++;
                        } else {
                            blockedFromDirect++;
                        }
                    });
                    
                    // Update the stats in the UI if there's anything to update
                    if (allowedFromDirect > 0 || blockedFromDirect > 0) {
                        const totalSitesElem = resultDiv.querySelector('.stat-value:nth-child(1)');
                        const allowedSitesElem = resultDiv.querySelector('.stat-value.allowed');
                        const blockedSitesElem = resultDiv.querySelector('.stat-value.blocked');
                        
                        if (totalSitesElem) totalSitesElem.textContent = (stats.totalSites + allowedFromDirect + blockedFromDirect);
                        if (allowedSitesElem) allowedSitesElem.textContent = (stats.allowedSites + allowedFromDirect);
                        if (blockedSitesElem) blockedSitesElem.textContent = (stats.blockedSites + blockedFromDirect);
                        
                        // Also update our state
                        storageState.analysisStatus.totalSites = stats.totalSites + allowedFromDirect + blockedFromDirect;
                        storageState.analysisStatus.allowedSites = stats.allowedSites + allowedFromDirect;
                        storageState.analysisStatus.blockedSites = stats.blockedSites + blockedFromDirect;
                    }
                }
            });
        }
    }
    
    // Helper function to add session info to the result div
    function addSessionInfo(resultDiv, currentHtml) {
        chromeStorage.get(['sessionData', 'domain']).then(sessionData => {
            if (sessionData.sessionData) {
                const timeLeft = sessionData.sessionData.endTime - Date.now();
                const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
                
                const sessionHtml = `
                    <div class="session-info">
                        <h4>SESSION INFO</h4>
                        <div class="session-item">
                            <span class="session-label">Domain</span>
                            <span class="session-value domain">${sessionData.domain || 'Not set'}</span>
                        </div>
                        <div class="session-item">
                            <span class="session-label">Time Remaining</span>
                            <span class="session-value time">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</span>
                        </div>
                    </div>`;
                
                console.log('Setting result HTML content', currentHtml + sessionHtml);
                resultDiv.innerHTML = currentHtml + sessionHtml;
            } else {
                console.log('Setting result HTML content', currentHtml);
                resultDiv.innerHTML = currentHtml;
            }
        });
    }

    // Function to update only the time remaining display (for frequent updates)
    function updateTimeRemainingDisplay() {
        if (storageState.activeSection !== 'analysisSection') return;
        const timeElement = document.querySelector('.session-value.time');
        if (!timeElement) {
            console.log('Time element not found');
            return;
        }
        
        console.log('Updating time display');
        
        // Use chromeStorage wrapper instead of directly accessing chrome.storage.local
        chromeStorage.get(['sessionData']).then(data => {
            if (data.sessionData && data.sessionData.endTime) {
                const timeLeft = data.sessionData.endTime - Date.now();
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
                    
                    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    console.log('Setting time to:', timeString);
                    timeElement.textContent = timeString;
                } else {
                    timeElement.textContent = '00:00:00';
                }
            }
        }).catch(error => {
            console.error('Error getting sessionData:', error);
        });
    }

    // Function to initialize and manage a client-side countdown without relying on storage
    function initClientSideTimer() {
        if (storageState.activeSection !== 'analysisSection') return;
        
        const timeElement = document.querySelector('.session-value.time');
        if (!timeElement) return;
        
        // Clear any existing timer
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }
        
        // Get the initial end time from storage once
        chromeStorage.get(['sessionData']).then(data => {
            if (!data.sessionData || !data.sessionData.endTime) return;
            
            // Calculate end time (server time)
            const endTime = data.sessionData.endTime;
            
            // Create a function that will update the timer display
            function updateDisplay() {
                const now = Date.now();
                const timeLeft = Math.max(0, endTime - now);
                
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
                    
                    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    timeElement.textContent = timeString;
                } else {
                    timeElement.textContent = '00:00:00';
                }
            }
            
            // Update immediately
            updateDisplay();
            
            // Set interval to update every second
            window.countdownInterval = setInterval(updateDisplay, 1000);
        });
    }

    // Save form state after any change
    function saveFormState() {
        storageState.blockDuration = document.getElementById('blockDuration').value;
        storageState.durationUnit = document.getElementById('durationUnit').value;
        storageState.domainSelection = document.getElementById('domain').value;
        storageState.currentAnswer = document.getElementById('answer').value;

        if (!document.getElementById('blockDurationSelect').classList.contains('hidden')) {
            storageState.activeSection = 'blockDurationSelect';
        } else if (!document.getElementById('domainSelect').classList.contains('hidden')) {
            storageState.activeSection = 'domainSelect';
        } else if (!document.getElementById('contextQuestions').classList.contains('hidden')) {
            storageState.activeSection = 'contextQuestions';
        } else if (!document.getElementById('analysisSection').classList.contains('hidden')) {
            storageState.activeSection = 'analysisSection';
        }

        chromeStorage.set({
            formState: storageState
        }).then(() => {
            console.log('Form state saved:', storageState);
        });
    }

    // Restore form state from storage
    function restoreFormState() {
        console.log('Restoring form state:', storageState);

        if (storageState.blockDuration) {
            document.getElementById('blockDuration').value = storageState.blockDuration;
        }
        if (storageState.durationUnit) {
            document.getElementById('durationUnit').value = storageState.durationUnit;
        }
        if (storageState.domainSelection) {
            document.getElementById('domain').value = storageState.domainSelection;
        }
        if (storageState.currentAnswer) {
            document.getElementById('answer').value = storageState.currentAnswer;
        }
        if (storageState.currentQuestion) {
            document.getElementById('question').textContent = storageState.currentQuestion;
        }

        const sections = ['blockDurationSelect', 'domainSelect', 'contextQuestions', 'analysisSection'];
        sections.forEach(section => {
            const element = document.getElementById(section);
            if (element) {
                if (section === storageState.activeSection) {
                    element.classList.remove('hidden');
                    if (section === 'analysisSection') {
                        element.style.display = 'block';
                        
                        // Make sure all analysis divs are visible
                        const analysisResultDiv = document.getElementById('analysisResult');
                        if (analysisResultDiv) {
                            analysisResultDiv.classList.remove('hidden');
                            analysisResultDiv.style.display = 'block';
                        }
                        
                        const resultDiv = document.getElementById('result');
                        if (resultDiv) {
                            resultDiv.classList.remove('hidden');
                            resultDiv.style.display = 'block';
                        }
                        
                        // Start the client-side timer when restoring to the analysis section
                        setTimeout(() => {
                            console.log('Starting client-side timer from restore');
                            initClientSideTimer();
                        }, 100);
                        
                        // Trigger immediate UI update
                        setTimeout(updateAnalysisUI, 0);
                    }
                } else {
                    element.classList.add('hidden');
                }
            }
        });
    }

    // Matrix animation code
    let canvas = null;
    let ctx = null;
    let drops = [];
    const fontSize = 14;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';

    function initCanvas() {
        canvas = document.getElementById('matrix-rain');
        if (!canvas) {
            console.error('Matrix canvas not found!');
            return false;
        }

        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get canvas context!');
            return false;
        }

        return true;
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        drops.length = 0;
        const columns = Math.ceil(canvas.width / fontSize);
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * -100;
        }
    }

    function drawMatrix() {
        if (!canvas || !ctx) return;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const char = characters[Math.floor(Math.random() * characters.length)];
            const x = i * fontSize;
            const y = drops[i] * fontSize;

            if (drops[i] * fontSize < canvas.height && drops[i] > 0) {
                if (Math.random() > 0.98) {
                    ctx.fillStyle = '#FFF';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#0F0';
                } else {
                    ctx.fillStyle = '#0F0';
                    ctx.shadowBlur = 0;
                }

                ctx.fillText(char, x, y);
            }

            drops[i] += 0.5;

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
        }

        requestAnimationFrame(drawMatrix);
    }

    function startMatrixAnimation() {
        if (!canvas || !ctx) {
            if (!initCanvas()) return;
        }

        resizeCanvas();
        drawMatrix();
    }

    window.addEventListener('resize', resizeCanvas);

    startMatrixAnimation();

    const blockDurationSelect = document.getElementById('blockDurationSelect');
    const domainSelect = document.getElementById('domainSelect');
    const contextQuestions = document.getElementById('contextQuestions');
    const analysisSection = document.getElementById('analysisSection');
    
    let currentContext = [];
    
    document.getElementById('blockDuration').addEventListener('input', saveFormState);
    document.getElementById('durationUnit').addEventListener('change', saveFormState);
    document.getElementById('domain').addEventListener('change', saveFormState);
    document.getElementById('answer').addEventListener('input', saveFormState);

    document.getElementById('startBlock').addEventListener('click', () => {
        const duration = parseInt(document.getElementById('blockDuration').value);
        const unit = document.getElementById('durationUnit').value;
        const durationMs = unit === 'hours' ? duration * 60 * 60 * 1000 : duration * 60 * 1000;
        
        storageState.sessionDuration = durationMs;
        
        chromeStorage.set({
            sessionDuration: durationMs
        }).then(() => {
            console.log('Stored session duration:', durationMs);
            blockDurationSelect.classList.add('hidden');
            domainSelect.classList.remove('hidden');
            storageState.activeSection = 'domainSelect';
            saveFormState();
        });
    });
    
    document.getElementById('startContext').addEventListener('click', async () => {
        const domain = document.getElementById('domain').value;
        if (!domain) return;
        
        storageState.domain = domain;
        
        await chromeStorage.set({
            domain: domain
        });
        console.log('Stored domain:', domain);
        
        domainSelect.classList.add('hidden');
        contextQuestions.classList.remove('hidden');
        storageState.activeSection = 'contextQuestions';
        saveFormState();
        
        await getNextQuestion(domain);
    });
    
    document.getElementById('nextQuestion').addEventListener('click', async () => {
        const answer = document.getElementById('answer').value;
        if (!answer) return;
        
        const question = document.getElementById('question').textContent;
        currentContext.push({ question, answer });
        
        storageState.context = currentContext;
        await chromeStorage.set({
            context: currentContext
        });
        console.log('Stored updated context:', currentContext);
        
        const domain = document.getElementById('domain').value;
        const response = await fetch('http://localhost:5000/get_question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: domain,
                context: currentContext
            })
        });
        
        const data = await response.json();
        
        if (data.question === 'DONE') {
            startAnalysis();
        } else {
            document.getElementById('question').textContent = data.question;
            storageState.currentQuestion = data.question;
            document.getElementById('answer').value = '';
            storageState.currentAnswer = '';
            saveFormState();
        }
    });
    
    async function getNextQuestion(domain) {
        const response = await fetch('http://localhost:5000/get_question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: domain,
                context: currentContext
            })
        });
        
        const data = await response.json();
        document.getElementById('question').textContent = data.question;
        storageState.currentQuestion = data.question;
        saveFormState();
    }
    
    async function startAnalysis() {
        try {
            contextQuestions.classList.add('hidden');
            
            // Make sure all analysis containers are visible
            analysisSection.classList.remove('hidden');
            analysisSection.style.display = 'block';
            
            const analysisResultDiv = document.getElementById('analysisResult');
            if (analysisResultDiv) {
                analysisResultDiv.classList.remove('hidden');
                analysisResultDiv.style.display = 'block'; 
            }
            
            const resultDiv = document.getElementById('result');
            if (resultDiv) {
                resultDiv.classList.remove('hidden');
                resultDiv.style.display = 'block';
                // Add initial content to show it's working
                resultDiv.innerHTML = '<div class="loading">Initializing analysis panel...</div>';
            }
            
            storageState.activeSection = 'analysisSection';
            saveFormState();
            
            // Get all stored data
            const sessionDuration = await chromeStorage.get('sessionDuration');
            const domain = storageState.domain;
            const context = storageState.context;
            
            // Create session data
            const sessionData = {
                state: 'active',
                startTime: Date.now(),
                endTime: Date.now() + sessionDuration.sessionDuration,
                domain: domain
            };
            
            // Store complete session state
            await chromeStorage.set({
                sessionData: sessionData,
                domain: domain,
                context: context
            });
            
            console.log('Stored complete session state:', {
                sessionData,
                domain,
                context
            });

            // Show analysis UI immediately
            updateAnalysisUI();
            
            // Initialize the client-side timer right away
            setTimeout(() => {
                initClientSideTimer();
                
                // Also add a manual timer directly in the DOM
                const timeElement = document.querySelector('.session-value.time');
                if (timeElement) {
                    const endTime = Date.now() + sessionDuration.sessionDuration;
                    
                    // Create a self-updating timer using vanilla JS
                    let timerInterval = setInterval(() => {
                        const now = Date.now();
                        const remaining = Math.max(0, endTime - now);
                        
                        if (remaining > 0) {
                            const h = Math.floor(remaining / (60 * 60 * 1000));
                            const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                            const s = Math.floor((remaining % (60 * 1000)) / 1000);
                            
                            timeElement.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                        } else {
                            timeElement.textContent = '00:00:00';
                            clearInterval(timerInterval);
                        }
                    }, 1000);
                    
                    // Store the interval ID for cleanup
                    window.timerInterval = timerInterval;
                }
            }, 200);

            // Send message to parent
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                console.log('Message received from parent:', event.data);
                if (event.data.success) {
                    // Ensure the #result div itself is visible after success
                    const resultDiv = document.getElementById('result');
                    if (resultDiv) {
                        resultDiv.classList.remove('hidden');
                        resultDiv.style.display = 'block';
                    }
                    updateAnalysisUI(); // Update UI with initial stats
                } else {
                    document.getElementById('result').innerHTML = 
                        '<div class="error">Failed to start session. Please try again.</div>';
                    // Make sure error is visible
                    const resultDiv = document.getElementById('result');
                    if (resultDiv) {
                        resultDiv.classList.remove('hidden');
                        resultDiv.style.display = 'block';
                    }
                }
                saveFormState(); // Save state after potential UI changes
            };

            window.parent.postMessage({
                type: 'START_SESSION',
                duration: sessionDuration.sessionDuration,
                domain: domain,
                context: context
            }, '*', [channel.port2]);

        } catch (error) {
            console.error('Error in startAnalysis:', error);
            const resultDiv = document.getElementById('result');
            if (resultDiv) {
                resultDiv.innerHTML = 
                    '<div class="error">An unexpected error occurred. Please try again.</div>';
                // Make sure error is visible
                resultDiv.classList.remove('hidden');
                resultDiv.style.display = 'block';
                // Also ensure the parent container is visible
                const analysisResultDiv = document.getElementById('analysisResult');
                if (analysisResultDiv) {
                    analysisResultDiv.classList.remove('hidden');
                    analysisResultDiv.style.display = 'block'; 
                }
            }
            saveFormState();
        }
    }
    
    document.getElementById('startBlockAnalysis').addEventListener('click', () => {
        const duration = parseInt(document.getElementById('blockDurationAnalysis').value);
        const unit = document.getElementById('durationUnitAnalysis').value;
        
        const durationMs = unit === 'hours' ? 
            duration * 60 * 60 * 1000 : 
            duration * 60 * 1000;
        
        chrome.storage.local.get(['sessionData'], (data) => {
            if (data.sessionData) {
                const sessionData = {
                    ...data.sessionData,
                    endTime: Date.now() + durationMs
                };
                chrome.storage.local.set({ sessionData });
                saveFormState();
            }
        });
    });

    // Listen for URL analysis updates
    if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'URL_ANALYSIS_UPDATE') {
                storageState.analysisStatus.lastUrl = message.url;
                storageState.analysisStatus.lastAction = message.action;
                storageState.analysisStatus.lastReason = message.reason || '';
                
                // Update stats
                chromeStorage.get(['blockedUrls', 'allowedUrls']).then(data => {
                    updateAnalysisStats(data);
                    saveFormState();
                });
            }
            return true;
        });
    } else {
        console.log('Chrome runtime messaging not available, URL analysis updates will not be received');
    }
    
    // Add refresh button for analysis
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refreshAnalysis';
    refreshButton.textContent = 'Refresh Stats';
    refreshButton.addEventListener('click', () => {
        chromeStorage.get(['blockedUrls', 'allowedUrls']).then(data => {
            updateAnalysisStats(data);
        });
    });
    
    // Append refresh button to analysis section
    const analysisBlockDuration = document.getElementById('analysisBlockDuration');
    if (analysisBlockDuration) {
        analysisBlockDuration.parentNode.insertBefore(refreshButton, analysisBlockDuration);
    }
    
    // Set up interval to refresh the timer every second and full UI occasionally
    setInterval(() => {
        if (storageState.activeSection === 'analysisSection' && 
            document.getElementById('analysisSection') && 
            !document.getElementById('analysisSection').classList.contains('hidden')) {
                
            // Call the dedicated timer update function
            updateTimeRemainingDisplay();
            
            // Occasionally refresh the full UI (every 10 seconds)
            if (Date.now() % 10000 < 1000) {
                updateAnalysisUI();
            }
        }
    }, 1000); // Update every second for real-time timer
});
