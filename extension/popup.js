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
    chromeStorage.get(['formState', 'blockedUrls', 'allowedUrls']).then(data => {
        console.log('Initial storage and form state:', data);
        if (data.formState) {
            storageState = {...storageState, ...data.formState};
            restoreFormState();
        }
        
        // Update analysis stats
        updateAnalysisStats(data);
    }).catch(err => {
        console.error('Storage access error:', err);
    });

    // Function to update analysis statistics
    function updateAnalysisStats(data) {
        if (data.blockedUrls) {
            storageState.analysisStatus.blockedSites = Object.keys(data.blockedUrls).length;
        }
        if (data.allowedUrls) {
            storageState.analysisStatus.allowedSites = Object.keys(data.allowedUrls).length;
        }
        
        storageState.analysisStatus.totalSites = 
            storageState.analysisStatus.blockedSites + 
            storageState.analysisStatus.allowedSites;
            
        // Update the UI
        updateAnalysisUI();
    }
    
    // Function to update analysis UI
    function updateAnalysisUI() {
        const analysisSection = document.getElementById('analysisSection');
        if (!analysisSection) return;
        
        const resultDiv = document.getElementById('result');
        if (!resultDiv) return;
        
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
            
        // Add latest activity if available
        if (stats.lastUrl) {
            const actionClass = stats.lastAction === 'blocked' ? 'blocked' : 'allowed';
            statusHtml += `
                <div class="latest-activity">
                    <h4>LATEST ACTIVITY</h4>
                    <div class="activity-item ${actionClass}">
                        <div class="activity-url">${stats.lastUrl}</div>
                        <div class="activity-status ${actionClass}">${stats.lastAction.toUpperCase()}</div>
                        ${stats.lastReason ? `<div class="activity-reason">${stats.lastReason}</div>` : ''}
                    </div>
                </div>`;
        } else {
            statusHtml += `
                <div class="latest-activity">
                    <h4>LATEST ACTIVITY</h4>
                    <div class="activity-item neutral">
                        <div class="activity-status">No sites visited yet</div>
                        <div class="activity-info">Your browsing statistics will appear here</div>
                    </div>
                </div>`;
        }
        
        // Add session info
        chromeStorage.get(['sessionData', 'domain']).then(sessionData => {
            if (sessionData.sessionData) {
                const timeLeft = sessionData.sessionData.endTime - Date.now();
                const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
                
                statusHtml += `
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
            }
            
            // Set the HTML content
            resultDiv.classList.remove('hidden');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = statusHtml;
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
                    }
                } else {
                    element.classList.add('hidden');
                    if (section === 'analysisSection') {
                        element.style.display = 'none';
                    }
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
            analysisSection.classList.remove('hidden');
            analysisSection.style.display = 'block';
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

            // Send message to parent
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                if (event.data.success) {
                    document.getElementById('result').classList.remove('hidden');
                    document.getElementById('result').style.display = 'block';
                    updateAnalysisUI();
                } else {
                    document.getElementById('result').innerHTML = 
                        'Failed to start session. Please try again.';
                }
                saveFormState();
            };

            window.parent.postMessage({
                type: 'START_SESSION',
                duration: sessionDuration.sessionDuration,
                domain: domain,
                context: context
            }, '*', [channel.port2]);

        } catch (error) {
            console.error('Error in startAnalysis:', error);
            document.getElementById('result').innerHTML = 
                'An unexpected error occurred. Please try again.';
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
    
    // Set up interval to refresh analysis UI
    setInterval(() => {
        if (document.getElementById('analysisSection').style.display !== 'none') {
            updateAnalysisUI();
        }
    }, 1000);
});
