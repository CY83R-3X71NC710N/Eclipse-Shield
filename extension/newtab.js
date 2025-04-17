// Global variables and utility functions
let lastTime = 0;
let mouseVelocity = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };
let globalSearchBox = null; // Add global reference

// Matrix animation setup
const canvas = document.getElementById('matrixCanvas');
const ctx = canvas.getContext('2d');
const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const fontSize = 16;
let drops = [];

// Update matrix animation settings
const matrixConfig = {
    fontSize: 20,     // Increased font size
    baseSpeed: 1.5,   // Faster speed
    speedVariation: 0.4,
    density: 0.8,
    // Cyberpunk-inspired color palette
    colors: {
        primary: '#00ff9f',    // Bright cyan
        bright: '#ffffff',     // Pure white
        secondary: '#0ef0c8',  // Seafoam
        tertiary: '#00d4ff',   // Electric blue
        faded: '#005c54'       // Deep teal
    },
    glowStrength: 12, // Increased glow
    depth: 3,         // Reduced number of layers for better performance
    zDistance: 1000,  // Increased Z distance
    perspective: 2000, // Increased perspective distance
};

// Update matrix initialization to properly fill screen
function initMatrix() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Calculate columns to fill entire width without gaps
    const columns = Math.ceil(canvas.width / (matrixConfig.fontSize * 0.8)); // More dense columns
    drops = new Array(columns).fill(0).map(() => Math.random() * -100);
    
    // Set proper font before measuring text
    ctx.font = `bold ${matrixConfig.fontSize}px 'Share Tech Mono'`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';
}

// Remove floating particles functionality
// Comment out addFloatingParticles() function definition and calls
// function addFloatingParticles() { /* ...existing code... */ }
// window.addEventListener('resize', () => {
    // addFloatingParticles(); 
// });

// Add window resize handler for particles
// window.addEventListener('resize', () => {
    // addFloatingParticles();
// });

// Enhance matrix rain with depth layers
function drawMatrix() {
    // Clear with gradient background
    const gradient = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, canvas.width
    );
    gradient.addColorStop(0, 'rgba(0, 15, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add depth fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reduce character density
    const drawProbability = 0.7; // Only draw 70% of characters

    // Remove the overall blur from matrix characters
    ctx.filter = 'none';
    ctx.globalAlpha = 0.85; // Increased base opacity

    // Draw matrix in depth layers
    for(let z = 0; z < matrixConfig.depth; z++) {
        const depth = z / matrixConfig.depth;
        const scale = 1 - (depth * 0.2); // Reduced scale difference
        const speed = matrixConfig.baseSpeed * (1 + depth * 0.5);
        const opacity = 1 - (depth * 0.2); // Reduced opacity difference
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        for(let i = 0; i < drops.length; i++) {
            if (Math.random() > drawProbability) continue;
            const x = i * matrixConfig.fontSize;
            const y = drops[i] * matrixConfig.fontSize;
            
            // Adjust perspective calculation
            const zOffset = depth * matrixConfig.zDistance;
            const perspectiveFactor = matrixConfig.perspective / (matrixConfig.perspective + zOffset);
            
            // Center the perspective point
            const x3d = canvas.width/2 + (x - canvas.width/2) * perspectiveFactor;
            const y3d = canvas.height/2 + (y - canvas.height/2) * perspectiveFactor;
            
            // Draw character with enhanced 3D effect
            const fontSize = Math.floor(matrixConfig.fontSize * perspectiveFactor);
            ctx.font = `bold ${fontSize}px 'Share Tech Mono'`;
            
            // Enhanced glow effect based on depth
            if (Math.random() > 0.95) {
                ctx.shadowColor = matrixConfig.colors.bright;
                ctx.shadowBlur = matrixConfig.glowStrength * (1 - depth);
                ctx.fillStyle = matrixConfig.colors.bright;
            } else {
                ctx.shadowBlur = 0;
                ctx.fillStyle = z === 0 ? 
                    matrixConfig.colors.primary : 
                    matrixConfig.colors.secondary;
            }
            
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, x3d, y3d);
            
            // Update position with depth-based speed
            drops[i] += speed;
            if (y3d > canvas.height) {
                drops[i] = 0;
            }
        }
        ctx.restore();
    }

    // Add velocity-based effects
    const velocityEffect = Math.sqrt(mouseVelocity.x ** 2 + mouseVelocity.y ** 2) * 0.1;
    ctx.shadowBlur = matrixConfig.glowStrength + velocityEffect;
    
    // Add wave effect
    const time = Date.now() * 0.001;
    for(let i = 0; i < drops.length; i++) {
        // ...existing drop code...
        
        // Add sine wave distortion
        const wave = Math.sin(i * 0.1 + time) * 2;
        drops[i] += wave * 0.1;
    }
}

// Search form handling
document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = e.target.querySelector('input').value;
    if (query) {
        chrome.storage.local.get(['sessionData'], (data) => {
            if (data.sessionData?.state === 'active') {
                window.location.href = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
            }
        });
    }
});

// Update timer display with glitch effect
async function updateTimer() {
    const { sessionData } = await chrome.storage.local.get('sessionData');
    if (sessionData?.endTime) {
        const timeLeft = sessionData.endTime - Date.now();
        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
            
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            const countdown = document.getElementById('countdown');
            countdown.textContent = timeString;
            countdown.setAttribute('data-text', timeString); // For glitch effect
            
            document.getElementById('activeDomain').textContent = sessionData.domain.toUpperCase();
        }
    }
}

// Add cursor handling
document.addEventListener('DOMContentLoaded', () => {
    const cursor = document.querySelector('.custom-cursor');
    const ring = document.querySelector('.cursor-ring');
    const dot = document.querySelector('.cursor-dot');

    // Show cursor when mouse moves
    document.addEventListener('mousemove', (e) => {
        cursor.style.display = 'block';
        const x = e.clientX;
        const y = e.clientY;

        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;

        // Enhanced matrix disturbance effect
        const column = Math.floor(x / matrixConfig.fontSize);
        const disturbRadius = 8; // Increased radius of effect
        
        for (let i = -disturbRadius; i <= disturbRadius; i++) {
            if (drops[column + i]) {
                // Create a wave effect in the matrix
                const distance = Math.abs(i);
                const strength = 1 - (distance / disturbRadius);
                const wave = Math.sin(Date.now() * 0.01 + i) * 5;
                drops[column + i] = Math.min(
                    drops[column + i], 
                    y / matrixConfig.fontSize - (15 * strength) + wave
                );
            }
        }
    });

    // RGB color cycling for cursor ring with reactive sizing
    function updateRingEffect() {
        const time = Date.now() * 0.002;
        const r = Math.sin(time) * 127 + 128;
        const g = Math.sin(time + 2) * 127 + 128;
        const b = Math.sin(time + 4) * 127 + 128;
        
        ring.style.borderColor = `rgb(${r}, ${g}, ${b})`;
        ring.style.boxShadow = `0 0 10px rgb(${r}, ${g}, ${b}), 
                               0 0 20px rgba(${r}, ${g}, ${b}, 0.5)`;
        
        // Pulse effect
        const scale = 1 + Math.sin(time * 2) * 0.1;
        ring.style.transform = `translate(-50%, -50%) scale(${scale})`;
        
        requestAnimationFrame(updateRingEffect);
    }

    updateRingEffect();

    // Enhanced click effect
    document.addEventListener('click', (e) => {
        createDigitalBurst(e); // Replace createTornado with createDigitalBurst
        createRipple(e);
        
        // Create multiple smaller ripples
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const miniRipple = document.createElement('div');
                miniRipple.className = 'ripple mini-ripple';
                miniRipple.style.position = 'fixed';
                miniRipple.style.left = `${e.clientX}px`;
                miniRipple.style.top = `${e.clientY}px`;
                miniRipple.style.transform = 'translate(-50%, -50%)';
                document.body.appendChild(miniRipple);
                
                miniRipple.addEventListener('animationend', () => {
                    miniRipple.remove();
                });
            }, i * 100);
        }

        // Create shockwave in matrix
        const clickColumn = Math.floor(e.clientX / matrixConfig.fontSize);
        const shockwaveRadius = 15;
        
        for (let i = -shockwaveRadius; i <= shockwaveRadius; i++) {
            if (drops[clickColumn + i]) {
                setTimeout(() => {
                    const distance = Math.abs(i);
                    const strength = 1 - (distance / shockwaveRadius);
                    drops[clickColumn + i] = -20 * strength;
                }, Math.abs(i) * 50);
            }
        }

        // Add glitch effect to clicked elements
        const clickedElements = document.elementsFromPoint(e.clientX, e.clientY);
        clickedElements.forEach(element => {
            if (element.classList.contains('search-box') || 
                element.id === 'countdown' ||
                element.id === 'activeDomain') {
                element.classList.add('glitch-click');
                setTimeout(() => element.classList.remove('glitch-click'), 500);
            }
        });

        // Create electromagnetic pulse effect
        const pulse = document.createElement('div');
        pulse.className = 'emp-pulse';
        pulse.style.left = e.clientX + 'px';
        pulse.style.top = e.clientY + 'px';
        document.body.appendChild(pulse);
        setTimeout(() => pulse.remove(), 1000);
    });

    // Remove dynamic placeholder update logic
    // function updatePlaceholder() { /* ...existing code... */ }
    // updatePlaceholder();
    // window.placeholderInterval = setInterval(updatePlaceholder, 4000);
    
    // Remove fixed placeholder snippet:
    // const searchBox = document.querySelector('.search-box');
    // searchBox.placeholder = 'Enter search query...';
    
    // Clear placeholder animation on focus for user input
    searchBox.addEventListener('focus', () => {
        searchBox.style.animation = 'none';
        if (window.placeholderInterval) {
            clearInterval(window.placeholderInterval);
        }
    });
    
    // Remove override calls that may block input and click events
    // Remove duplicate focus/mouseover listeners if any
    // ...existing code...

    // Add parallax effect
    const parallaxContainer = document.querySelector('.parallax-container');
    document.addEventListener('mousemove', (e) => {
        if (!parallaxContainer) return;
        
        const xAxis = (window.innerWidth / 2 - e.pageX) / 50;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 50;
        
        parallaxContainer.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });

    // Reset parallax on mouse leave
    document.addEventListener('mouseleave', () => {
        if (!parallaxContainer) return;
        parallaxContainer.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });

    // Enhanced searchbox animation on keypress
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return; // Ignore tab key

        searchBox.focus();
        
        // Remove existing animation classes
        searchBox.classList.remove('active');
        void searchBox.offsetWidth; // Trigger reflow
        searchBox.classList.add('active');

        // Create matrix characters particles
        const chars = '01アイウエオカキクケコサシスセソ';
        const positions = [
            { x: -100, y: -100 },
            { x: 100, y: -100 },
            { x: -100, y: 100 },
            { x: 100, y: 100 }
        ];

        positions.forEach(pos => {
            const particle = document.createElement('div');
            particle.className = 'search-particle';
            particle.textContent = chars[Math.floor(Math.random() * chars.length)];
            
            // Position particle relative to searchbox
            const rect = searchBox.getBoundingClientRect();
            particle.style.left = `${rect.left + rect.width / 2}px`;
            particle.style.top = `${rect.top + rect.height / 2}px`;
            
            // Set random movement direction
            particle.style.setProperty('--x', `${pos.x}px`);
            particle.style.setProperty('--y', `${pos.y}px`);
            
            // Add to DOM and animate
            document.body.appendChild(particle);
            particle.animate([
                {
                    transform: 'translate(-50%, -50%) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${pos.x}px, ${pos.y}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 1000,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards'
            }).onfinish = () => particle.remove();
        });

        // Remove active class after animation
        setTimeout(() => {
            searchBox.classList.remove('active');
        }, 500);
    });

    // Track typing state
    let typingTimer;
    let isTyping = false;

    // Handle typing animation
    function startTyping() {
        if (!isTyping) {
            isTyping = true;
            searchBox.classList.add('typing');
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            isTyping = false;
            searchBox.classList.remove('typing');
        }, 150);
    }

    // Create matrix particle at cursor position
    function createMatrixParticle(x, y) {
        // Create multiple particles for fireworks effect
        const particleCount = Math.floor(Math.random() * 8) + 5; // 5-12 particles
        const rect = searchBox.getBoundingClientRect();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'matrix-cursor-particle';
            
            // Random position within searchbox bounds
            const randomX = Math.random() * rect.width;
            const randomY = Math.random() * rect.height;
            
            // Random color using HSL for rainbow effect
            const hue = Math.random() * 360;
            const saturation = 80 + Math.random() * 20; // 80-100%
            const lightness = 50 + Math.random() * 20; // 50-70%
            
            particle.style.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            particle.style.textShadow = `0 0 5px hsl(${hue}, ${saturation}%, ${lightness}%), 
                                       0 0 10px hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // Random character
            particle.textContent = '01アイウエオカキクケコ'[Math.floor(Math.random() * 11)];
            
            // Position and animation
            particle.style.left = `${randomX}px`;
            particle.style.top = `${randomY}px`;
            particle.style.setProperty('--angle', `${Math.random() * 360}deg`);
            particle.style.setProperty('--distance', `${Math.random() * 50 + 20}px`);
            particle.style.setProperty('--duration', `${Math.random() * 1000 + 500}ms`);
            
            searchBox.insertBefore(particle, searchBox.firstChild);
            
            // Add firework-like animation
            particle.animate([
                {
                    opacity: 1,
                    transform: 'scale(1) translate(0, 0)'
                },
                {
                    opacity: 0,
                    transform: `scale(0.2) translate(
                        calc(cos(var(--angle)) * var(--distance)), 
                        calc(sin(var(--angle)) * var(--distance))
                    )`
                }
            ], {
                duration: parseInt(particle.style.getPropertyValue('--duration')),
                easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
                fill: 'forwards'
            }).onfinish = () => particle.remove();
        }
    }

    // Add this CSS to your stylesheet:
    const style = document.createElement('style');
    style.textContent = `
        .matrix-cursor-particle {
            position: absolute;
            font-family: 'Share Tech Mono', monospace;
            pointer-events: none;
            z-index: 1000;
            transform-origin: center;
            transition: all 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);

    // Enhanced keydown handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        searchBox.focus();
        startTyping();

        // Get cursor position for particle effect
        const rect = searchBox.getBoundingClientRect();
        const style = window.getComputedStyle(searchBox);
        const padding = parseInt(style.paddingLeft);
        
        // Approximate cursor position based on input value length
        const textWidth = searchBox.value.length * (parseInt(style.fontSize) * 0.6);
        const cursorX = rect.left + padding + textWidth;
        const cursorY = rect.top + (rect.height / 2);

        // Create particles at cursor position
        createMatrixParticle(cursorX, cursorY);
        createDNAEffect(cursorX, cursorY);
        createNeuralNetworkEffect();
        createElectricArcs(cursorX, cursorY);
        createRealityGlitch();
        createHoloRipple(cursorX, cursorY);
        createDecomposition(e.key, cursorX, cursorY);
    });
});

// NEW: DNA helix effect that spirals around the character
function createDNAEffect(x, y) {
    const dnaContainer = document.createElement('div');
    dnaContainer.className = 'dna-strand';
    dnaContainer.style.left = `${x - 10}px`; // Position slightly offset
    dnaContainer.style.top = `${y}px`;
    // Create multiple orbiting particles
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'dna-particle';
        particle.style.top = `${i * 12}px`;
        dnaContainer.appendChild(particle);
    }
    document.querySelector('.search-box').appendChild(dnaContainer);
    setTimeout(() => dnaContainer.remove(), 3000);
}

// NEW: Neural network visualization connecting random nodes over the search box
function createNeuralNetworkEffect() {
    const container = document.querySelector('.search-box');
    const nodes = [];
    for (let i = 0; i < 5; i++) {
        const node = document.createElement('div');
        node.className = 'neural-node';
        node.style.left = `${Math.random()*90 + 5}%`;
        node.style.top = `${Math.random()*90 + 5}%`;
        container.appendChild(node);
        nodes.push(node);
    }
    // Create connections
    for (let i = 1; i < nodes.length; i++) {
        const connection = document.createElement('div');
        connection.className = 'neural-connection';
        container.appendChild(connection);
        const rect1 = nodes[i-1].getBoundingClientRect();
        const rect2 = nodes[i].getBoundingClientRect();
        const x1 = rect1.left + rect1.width/2;
        const y1 = rect1.top + rect1.height/2;
        const x2 = rect2.left + rect2.width/2;
        const y2 = rect2.top + rect2.height/2;
        const length = Math.hypot(x2-x1, y2-y1);
        const angle = Math.atan2(y2-y1, x2-x1);
        connection.style.width = `${length}px`;
        connection.style.left = `${x1}px`;
        connection.style.top = `${y1}px`;
        connection.style.transform = `rotate(${angle}rad)`;
    }
    setTimeout(() => {
        nodes.forEach(n => n.remove());
        document.querySelectorAll('.neural-connection').forEach(c => c.remove());
    }, 2000);
}

// NEW: Electric arcs effect between characters
function createElectricArcs(x, y) {
    for (let i = 0; i < 3; i++) {
        const arc = document.createElement('div');
        arc.className = 'electric-arc';
        arc.style.left = `${x}px`;
        arc.style.top = `${y}px`;
        arc.style.width = `${Math.random()*50 + 20}px`;
        arc.style.transform = `rotate(${Math.random()*360}deg)`;
        document.querySelector('.search-box').appendChild(arc);
        setTimeout(() => arc.remove(), 250);
    }
}

// NEW: Reality-bending glitch effect overlaying the search box
function createRealityGlitch() {
    const glitch = document.createElement('div');
    glitch.className = 'reality-glitch';
    document.querySelector('.search-box').appendChild(glitch);
    setTimeout(() => glitch.remove(), 500);
}

// NEW: Holographic ripple effect at the given position
function createHoloRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'holo-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.querySelector('.search-box').appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);
}

// NEW: Digital decomposition that causes the typed character to break into particles
function createDecomposition(char, x, y) {
    for (let i = 0; i < 4; i++) {
        const part = document.createElement('div');
        part.className = 'decompose-particle';
        part.textContent = char;
        part.style.left = `${x}px`;
        part.style.top = `${y}px`;
        part.style.setProperty('--x-offset', Math.random()*2 - 1);
        part.style.setProperty('--y-offset', Math.random()*2 - 1);
        part.style.setProperty('--rotation', Math.random()*2 - 1);
        document.querySelector('.search-box').appendChild(part);
        setTimeout(() => part.remove(), 1000);
    }
}

// Modify keydown handler to trigger all new effects and position the matrix particle under the character.
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.querySelector('.search-box');
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        searchBox.focus();
        // Trigger the typing animation
        startTyping(); // existing function

        // Calculate the approximate cursor position in the input based on its value length.
        const rect = searchBox.getBoundingClientRect();
        const style = window.getComputedStyle(searchBox);
        const padding = parseInt(style.paddingLeft) || 0;
        const cursorIndex = searchBox.selectionStart || searchBox.value.length;
        const charWidth = parseInt(style.fontSize)*0.6;
        const posX = rect.left + padding + (cursorIndex * charWidth);
        const posY = rect.top + rect.height/2;
        
        // Matrix particle appears under the character
        createMatrixParticle(posX, posY);
        // DNA strand spirals around the character
        createDNAEffect(posX, posY);
        // Neural network visualization on keystroke
        createNeuralNetworkEffect();
        // Electric arcs effect
        createElectricArcs(posX, posY);
        // Reality-bending glitch effect
        createRealityGlitch();
        // Holographic ripple effect
        createHoloRipple(posX, posY);
        // Decompose the typed character into particles
        createDecomposition(e.key, posX, posY);
    });
});

// ...existing code...

document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.querySelector('.search-box');
    
    // Single keydown handler that triggers all effects
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        
        // Focus and animate the search box
        searchBox.focus();
        searchBox.classList.remove('active', 'typing');
        void searchBox.offsetWidth; // Force reflow
        searchBox.classList.add('active', 'typing');
        
        // Get cursor position for effects
        const rect = searchBox.getBoundingClientRect();
        const cursorPos = searchBox.selectionStart;
        const style = window.getComputedStyle(searchBox);
        const charWidth = parseInt(style.fontSize) * 0.6;
        const startX = rect.left + parseInt(style.paddingLeft) + (cursorPos * charWidth);
        const startY = rect.top + (rect.height / 2);
        
        // Create particle effects
        for (let i = 0; i < 3; i++) {
            const particle = document.createElement('div');
            particle.className = 'matrix-cursor-particle';
            particle.textContent = '01アイウエオカキクケコ'[Math.floor(Math.random() * 11)];
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;
            searchBox.appendChild(particle);
            
            // Remove particle after animation
            particle.addEventListener('animationend', () => particle.remove());
        }
        
        // Create DNA effect
        const dna = document.createElement('div');
        dna.className = 'dna-strand';
        dna.style.setProperty('--x', `${startX}px`);
        searchBox.appendChild(dna);
        
        // Create electric arcs
        for (let i = 0; i < 3; i++) {
            const arc = document.createElement('div');
            arc.className = 'electric-arc';
            arc.style.left = `${startX}px`;
            arc.style.top = `${startY}px`;
            arc.style.width = `${Math.random() * 50 + 20}px`;
            arc.style.transform = `rotate(${Math.random() * 360}deg)`;
            searchBox.appendChild(arc);
        }
        
        // Create reality glitch
        const glitch = document.createElement('div');
        glitch.className = 'reality-glitch';
        searchBox.appendChild(glitch);
        
        // Cleanup
        setTimeout(() => {
            searchBox.classList.remove('active', 'typing');
            dna.remove();
            glitch.remove();
            const arcs = searchBox.getElementsByClassName('electric-arc');
            Array.from(arcs).forEach(arc => arc.remove());
        }, 1000);
    });
});

// ...existing code...

// Add digital burst effect function
function createDigitalBurst(e) {
    const particleCount = 60;
    const duration = 1500;
    const characters = '01アイウエオカキクケコサシスセソタチツテト';
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'digital-particle';
        particle.textContent = characters[Math.floor(Math.random() * characters.length)];
        document.body.appendChild(particle);

        const angle = (i / particleCount) * Math.PI * 2;
        const velocity = 2 + Math.random() * 4;
        const x = e.clientX;
        const y = e.clientY;
        const size = Math.random() * 20 + 10;
        
        particle.style.fontSize = `${size}px`;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        particle.animate([
            {
                transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)',
                opacity: 1
            },
            {
                transform: `
                    translate(
                        ${Math.cos(angle) * velocity * 100}px,
                        ${Math.sin(angle) * velocity * 100}px
                    ) 
                    scale(0) 
                    rotate(${Math.random() * 720}deg)
                `,
                opacity: 0
            }
        ], {
            duration: duration + Math.random() * 500,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards'
        }).onfinish = () => particle.remove();
    }
}

// Move all DOM interactions inside a single DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return; // Guard clause

    let typingTimer;
    let isTyping = false;

    function startTyping() {
        if (!isTyping) {
            isTyping = true;
            searchBox.classList.add('typing');
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            isTyping = false;
            searchBox.classList.remove('typing');
        }, 150);
    }

    function createMatrixParticle(x, y) {
        // Create multiple particles for fireworks effect
        const particleCount = Math.floor(Math.random() * 8) + 5; // 5-12 particles
        const rect = searchBox.getBoundingClientRect();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'matrix-cursor-particle';
            
            // Random position within searchbox bounds
            const randomX = Math.random() * rect.width;
            const randomY = Math.random() * rect.height;
            
            // Random color using HSL for rainbow effect
            const hue = Math.random() * 360;
            const saturation = 80 + Math.random() * 20; // 80-100%
            const lightness = 50 + Math.random() * 20; // 50-70%
            
            particle.style.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            particle.style.textShadow = `0 0 5px hsl(${hue}, ${saturation}%, ${lightness}%), 
                                       0 0 10px hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // Random character
            particle.textContent = '01アイウエオカキクケコ'[Math.floor(Math.random() * 11)];
            
            // Position and animation
            particle.style.left = `${randomX}px`;
            particle.style.top = `${randomY}px`;
            particle.style.setProperty('--angle', `${Math.random() * 360}deg`);
            particle.style.setProperty('--distance', `${Math.random() * 50 + 20}px`);
            particle.style.setProperty('--duration', `${Math.random() * 1000 + 500}ms`);
            
            searchBox.insertBefore(particle, searchBox.firstChild);
            
            // Add firework-like animation
            particle.animate([
                {
                    opacity: 1,
                    transform: 'scale(1) translate(0, 0)'
                },
                {
                    opacity: 0,
                    transform: `scale(0.2) translate(
                        calc(cos(var(--angle)) * var(--distance)), 
                        calc(sin(var(--angle)) * var(--distance))
                    )`
                }
            ], {
                duration: parseInt(particle.style.getPropertyValue('--duration')),
                easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
                fill: 'forwards'
            }).onfinish = () => particle.remove();
        }
    }

    function createDNAEffect(x, y) {
        const dnaContainer = document.createElement('div');
        dnaContainer.className = 'dna-strand';
        dnaContainer.style.left = `${x - 10}px`;
        dnaContainer.style.top = `${y}px`;
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'dna-particle';
            particle.style.top = `${i * 12}px`;
            dnaContainer.appendChild(particle);
        }
        searchBox.appendChild(dnaContainer);
        setTimeout(() => dnaContainer.remove(), 3000);
    }

    function createNeuralNetworkEffect() {
        const container = document.querySelector('.search-box');
        const nodes = [];
        for (let i = 0; i < 5; i++) {
            const node = document.createElement('div');
            node.className = 'neural-node';
            node.style.left = `${Math.random() * 90 + 5}%`;
            node.style.top = `${Math.random() * 90 + 5}%`;
            container.appendChild(node);
            nodes.push(node);
        }
        for (let i = 1; i < nodes.length; i++) {
            const connection = document.createElement('div');
            connection.className = 'neural-connection';
            container.appendChild(connection);
            const rect1 = nodes[i - 1].getBoundingClientRect();
            const rect2 = nodes[i].getBoundingClientRect();
            const x1 = rect1.left + rect1.width / 2;
            const y1 = rect1.top + rect1.height / 2;
            const x2 = rect2.left + rect2.width / 2;
            const y2 = rect2.top + rect2.height / 2;
            const length = Math.hypot(x2 - x1, y2 - y1);
            const angle = Math.atan2(y2 - y1, x2 - x1);
            connection.style.width = `${length}px`;
            connection.style.left = `${x1}px`;
            connection.style.top = `${y1}px`;
            connection.style.transform = `rotate(${angle}rad)`;
        }
        setTimeout(() => {
            nodes.forEach(n => n.remove());
            document.querySelectorAll('.neural-connection').forEach(c => c.remove());
        }, 2000);
    }

    function createElectricArcs(x, y) {
        for (let i = 0; i < 3; i++) {
            const arc = document.createElement('div');
            arc.className = 'electric-arc';
            arc.style.left = `${x}px`;
            arc.style.top = `${y}px`;
            arc.style.width = `${Math.random() * 50 + 20}px`;
            arc.style.transform = `rotate(${Math.random() * 360}deg)`;
            searchBox.appendChild(arc);
            setTimeout(() => arc.remove(), 250);
        }
    }

    function createRealityGlitch() {
        const glitch = document.createElement('div');
        glitch.className = 'reality-glitch';
        searchBox.appendChild(glitch);
        setTimeout(() => glitch.remove(), 500);
    }

    function createHoloRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'holo-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        searchBox.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);
    }

    function createDecomposition(char, x, y) {
        for (let i = 0; i < 4; i++) {
            const part = document.createElement('div');
            part.className = 'decompose-particle';
            part.textContent = char;
            part.style.left = `${x}px`;
            part.style.top = `${y}px`;
            part.style.setProperty('--x-offset', Math.random() * 2 - 1);
            part.style.setProperty('--y-offset', Math.random() * 2 - 1);
            part.style.setProperty('--rotation', Math.random() * 2 - 1);
            searchBox.appendChild(part);
            setTimeout(() => part.remove(), 1000);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') return;
        searchBox.focus();
        startTyping();

        const rect = searchBox.getBoundingClientRect();
        const style = window.getComputedStyle(searchBox);
        const paddingLeft = parseInt(style.paddingLeft) || 0;
        const paddingTop = parseInt(style.paddingTop) || 0;
        const fontSize = parseInt(style.fontSize);
        const charWidth = fontSize * 0.6;
        const cursorIndex = searchBox.selectionStart || searchBox.value.length;

        const xPos = rect.left + paddingLeft + (cursorIndex * charWidth);
        // Align near baseline
        const yPos = rect.top + paddingTop + fontSize * 0.8;

        createMatrixParticle(xPos, yPos);
        createDNAEffect(xPos, yPos);
        createNeuralNetworkEffect();
        createElectricArcs(xPos, yPos);
        createRealityGlitch();
        createHoloRipple(xPos, yPos);
        createDecomposition(e.key, xPos, yPos);
    });

    searchBox.addEventListener('focus', () => {
        searchBox.style.animation = 'none';
        if (window.placeholderInterval) {
            clearInterval(window.placeholderInterval);
        }
    });

    // Existing cursor handlers...
    const cursor = document.querySelector('.custom-cursor');
    const ring = document.querySelector('.cursor-ring');
    const dot = document.querySelector('.cursor-dot');

    // Rest of your existing event listeners...
    // ...existing code...

    searchBox.addEventListener('input', (e) => {
        const typedChar = e.data || '';
        if (typedChar) {
            const rect = searchBox.getBoundingClientRect();
            const caretX = rect.left + 20 + (searchBox.value.length * 10);
            const caretY = rect.top + rect.height / 2;
            createMatrixParticle(caretX, caretY, typedChar);
        }
    });

    window.createMatrixParticle = function (x, y, char) {
        const particle = document.createElement('span');
        particle.className = 'matrix-cursor-particle';
        particle.textContent = char || '*';
        const rect = searchBox.getBoundingClientRect();
        particle.style.left = `${x - rect.left}px`;
        particle.style.top = `${y - rect.top}px`;
        searchBox.insertBefore(particle, searchBox.firstChild);
        particle.addEventListener('animationend', () => particle.remove());
    };

    // Insert DNA effect elements
    const dnaStrand = document.createElement('div');
    dnaStrand.classList.add('dna-strand');
    for (let i = 0; i < 10; i++) {
        const dnaParticle = document.createElement('div');
        dnaParticle.classList.add('dna-particle');
        dnaStrand.appendChild(dnaParticle);
    }
    document.querySelector('.background-effects').appendChild(dnaStrand);

    // Ensure placeholder never cuts off
    searchBox.style.whiteSpace = 'normal';
    searchBox.style.overflow = 'visible';
    searchBox.style.textOverflow = 'clip';

    const placeholders = [
        "Accessing Matrix Search Protocol...",
        "Establishing Neural Pathways...",
        "Awaiting User Commands...",
        "Scanning Neural Network...",
        "Initializing Quantum Interface...",
        "Connecting to Cyberdeck...",
        "Bypassing Security Protocols...",
        "Synchronizing Neural Links...",
        "Loading Reality Matrices...",
        "Calibrating Digital Wavelengths...",
        "Interfacing with Cyberspace...",
        "Decrypting Neural Pathways...",
        "Establishing Quantum Entanglement...",
        "Accessing Deep Web Protocols...",
        "Initializing AI Constructs...",
        "Loading Virtual Reality Interface...",
        "Compiling Search Algorithms...",
        "Hacking the Mainframe...",
        "Recalibrating Digital Synapses...",
        "Establishing Secure Connection...",
        "Scanning Dimensional Barriers...",
        "Loading Cybernetic Enhancements...",
        "Initializing Search Matrix...",
        "Compiling Data Streams...",
        "Accessing Digital Consciousness...",
        "Bypassing Neural Firewalls...",
        "Loading Mind-Machine Interface...",
        "Synchronizing Quantum Processors...",
        "Establishing Digital Uplink...",
        "Calculating Search Parameters..."
    ];
    let placeholderIndex = 0;
    let typingInterval;
    let backspacingInterval;

    function typePlaceholder(text, cb) {
        let typed = "";
        typingInterval = setInterval(() => {
            typed += text[typed.length];
            searchBox.placeholder = typed;
            searchBox.style.setProperty('--placeholder-size', adjustPlaceholderSize(text));
            if (typed.length === text.length) {
                clearInterval(typingInterval);
                setTimeout(cb, 1000);
            }
        }, 80);
    }

    function backspacePlaceholder(cb) {
        const fullText = searchBox.placeholder;
        backspacingInterval = setInterval(() => {
            const current = searchBox.placeholder;
            if (current.length <= 1) {
                clearInterval(backspacingInterval);
                searchBox.placeholder = '';
                cb();
                ensurePlaceholdersActive(); // Ensure placeholders are active after deletion
                return;
            }
            
            // Keep the font size consistent with the full text during deletion
            const newText = current.slice(0, -1);
            searchBox.placeholder = newText;
            searchBox.style.setProperty('--placeholder-size', fitTextToContainer(fullText));
            
            // Add transition for smooth size change
            searchBox.style.transition = 'font-size 0.05s ease-out';
        }, 50);
    }

    function cyclePlaceholders() {
        if (searchBox.value) return; // Skip if user is typing
        const text = placeholders[placeholderIndex];
        typePlaceholder(text, () => {
            backspacePlaceholder(() => {
                placeholderIndex = (placeholderIndex + 1) % placeholders.length;
                setTimeout(cyclePlaceholders, 500);
            });
        });
    }

    // Start cycling if user hasn't typed
    setInterval(() => {
        if (!searchBox.value && !typingInterval && !backspacingInterval) {
            cyclePlaceholders();
        }
    }, 2000);

    // Reduce placeholder font size
    searchBox.style.fontSize = '14px';

    // Function to check if text fits
    function checkPlaceholderFit(text) {
        const tempSpan = document.createElement('span');
        tempSpan.style.font = getComputedStyle(searchBox).font;
        tempSpan.style.fontSize = '1.2rem'; // Initial placeholder size
        tempSpan.style.visibility = 'hidden';
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);
        
        const fits = tempSpan.offsetWidth < (searchBox.offsetWidth - 80); // Account for padding
        document.body.removeChild(tempSpan);
        return fits;
    }

    // Modify cyclePlaceholders to use size detection
    function typePlaceholder(text, cb) {
        const fontSize = checkPlaceholderFit(text) ? '1.2rem' : '0.9rem';
        searchBox.style.setProperty('--placeholder-size', fontSize);
        // ...rest of existing typePlaceholder code...
    }

    // Add CSS variable for dynamic placeholder size
    searchBox.style.setProperty('--placeholder-size', '1.2rem');

    function adjustPlaceholderSize(text) {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);

        const boxWidth = searchBox.offsetWidth - 80; // Account for padding
        let fontSize = 1.6;
        
        tempSpan.style.fontSize = `${fontSize}rem`;
        while (tempSpan.offsetWidth < boxWidth && fontSize < 2) {
            fontSize += 0.1;
            tempSpan.style.fontSize = `${fontSize}rem`;
        }
        
        document.body.removeChild(tempSpan);
        return `${fontSize}rem`;
    }

    function typePlaceholder(text, cb) {
        let typed = "";
        typingInterval = setInterval(() => {
            typed += text[typed.length];
            searchBox.placeholder = typed;
            searchBox.style.setProperty('--placeholder-size', adjustPlaceholderSize(text));
            if (typed.length === text.length) {
                clearInterval(typingInterval);
                setTimeout(cb, 1000);
            }
        }, 80);
    }

    function fitTextToContainer(text) {
        if (!text) return '1.6rem'; // Default size for empty text
        
        const container = searchBox;
        const containerWidth = container.offsetWidth - 80; // Account for padding
        const tempSpan = document.createElement('span');
        
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'nowrap';
        tempSpan.style.fontFamily = getComputedStyle(container).fontFamily;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);

        // Binary search for optimal font size
        let low = 0.1;
        let high = 4.0;
        const targetWidth = containerWidth * 0.95; // 95% of container width
        
        while (high - low > 0.01) {
            const mid = (low + high) / 2;
            tempSpan.style.fontSize = `${mid}rem`;
            
            if (tempSpan.offsetWidth > targetWidth) {
                high = mid;
            } else {
                low = mid;
            }
        }
        
        document.body.removeChild(tempSpan);
        return `${low}rem`;
    }

    function typePlaceholder(text, cb) {
        let typed = "";
        typingInterval = setInterval(() => {
            typed += text[typed.length];
            searchBox.placeholder = typed;
            
            // Use the full text for size calculation to maintain consistency
            searchBox.style.setProperty('--placeholder-size', fitTextToContainer(text));
            
            if (typed.length === text.length) {
                clearInterval(typingInterval);
                setTimeout(cb, 1000);
            }
        }, 80);
    }

    // Add auto-unfocus variables
    let unfocusTimer = null;
    const UNFOCUS_DELAY = 0; // 0 seconds of inactivity before unfocusing

    // Function to handle auto-unfocus
    function startUnfocusTimer() {
        clearTimeout(unfocusTimer);
        if (!searchBox.value) {
            unfocusTimer = setTimeout(() => {
                searchBox.blur();
            }, UNFOCUS_DELAY);
        }
    }

    // Update existing focus handler
    searchBox.addEventListener('focus', () => {
        searchBox.style.animation = 'none';
        if (window.placeholderInterval) {
            clearInterval(window.placeholderInterval);
        }
        startUnfocusTimer();
    });

    // Add input handler to reset timer when typing
    searchBox.addEventListener('input', () => {
        clearTimeout(unfocusTimer);
        if (!searchBox.value) {
            startUnfocusTimer();
        }
    });

    // Add keydown handler to reset timer
    searchBox.addEventListener('keydown', () => {
        clearTimeout(unfocusTimer);
        if (!searchBox.value) {
            startUnfocusTimer();
        }
    });

    // Start timer when mouse leaves the search box
    searchBox.addEventListener('mouseleave', () => {
        if (document.activeElement === searchBox && !searchBox.value) {
            startUnfocusTimer();
        }
    });

    // Clear timer when mouse enters the search box
    searchBox.addEventListener('mouseenter', () => {
        clearTimeout(unfocusTimer);
    });

    // Add this function to ensure placeholders start
    function ensurePlaceholdersActive() {
        if (!typingInterval && !backspacingInterval) {
            if (placeholderIndex >= placeholders.length) {
                placeholderIndex = 0;
            }
            if (!searchBox.placeholder || searchBox.placeholder.trim() === '') {
                cyclePlaceholders();
            }
        }
    }

    // Update the blur handler
    searchBox.addEventListener('blur', () => {
        searchBox.value = ''; // Clear any input text
        setTimeout(() => {
            searchBox.placeholder = ''; // Force trigger for placeholder update
            ensurePlaceholdersActive();
        }, 0);
    });

    // Update auto-unfocus function
    function startUnfocusTimer() {
        clearTimeout(unfocusTimer);
        if (!searchBox.value) {
            unfocusTimer = setTimeout(() => {
                searchBox.blur();
                ensurePlaceholdersActive();
            }, UNFOCUS_DELAY);
        }
    }

    // Update mouseleave handler
    searchBox.addEventListener('mouseleave', () => {
        if (document.activeElement === searchBox && !searchBox.value) {
            startUnfocusTimer();
        }
    });

    // Reset placeholders when focus is lost
    document.addEventListener('focusout', (e) => {
        if (e.target === searchBox) {
            ensurePlaceholdersActive();
        }
    });

    // Ensure placeholders start when the page loads
    setTimeout(ensurePlaceholdersActive, 500);

    // Add input handler to reset placeholders when input is cleared
    searchBox.addEventListener('input', () => {
        if (!searchBox.value) {
            ensurePlaceholdersActive();
        }
    });
});

// Initialize matrix and timer
initMatrix();
requestAnimationFrame(animate);
window.addEventListener('resize', initMatrix);
setInterval(updateTimer, 1000);
updateTimer();

// Add missing animate function
function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    
    if (deltaTime > 30) { // Cap at ~30fps for performance
        drawMatrix();
        lastTime = currentTime;
    }
    requestAnimationFrame(animate);
}

// Add missing createRipple function
function createRipple(e) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.position = 'fixed';
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    ripple.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ripple);
    
    ripple.addEventListener('animationend', () => ripple.remove());
}

// Move all event listeners and DOM operations inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return; // Guard clause
    
    let typingTimer;
    let isTyping = false;
    let mouseVelocity = { x: 0, y: 0 };
    let lastMousePosition = { x: 0, y: 0 };
    let lastTime = 0;

    // Function definitions inside DOMContentLoaded scope
    function startTyping() {
        if (!isTyping) {
            isTyping = true;
            searchBox.classList.add('typing');
        }
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            isTyping = false;
            searchBox.classList.remove('typing');
        }, 150);
    }

    // Event listeners
    searchBox.addEventListener('focus', () => {
        searchBox.style.animation = 'none';
        if (window.placeholderInterval) {
            clearInterval(window.placeholderInterval);
        }
    });

    // ...rest of your existing event listeners...

    // Initialize matrix and start animation
    initMatrix();
    requestAnimationFrame(animate);
    window.addEventListener('resize', initMatrix);

    // Start timer update
    setInterval(updateTimer, 1000);
    updateTimer();
});

// ...existing code...

// Get the reference to the search box
const searchBox = document.querySelector('.search-box');

// Dummy "startTyping" function to prevent errors
function startTyping() {
    // ...existing or placeholder logic...
}

// ...existing code...
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    // Make sure references to searchBox and startTyping exist
    if (searchBox) {
        // Example usage:
        searchBox.addEventListener('focus', () => {
            startTyping();
        });
    }
    // ...existing code...
});

// NEW: Dynamically adjust the search box font size to perfectly fit its text.
function adjustSearchBoxFontSize() {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;
    
    // Store the original height and position
    const originalHeight = searchBox.offsetHeight;
    const originalTop = searchBox.offsetTop;
    
    // Use either the input value or placeholder text
    const textToMeasure = searchBox.value || searchBox.placeholder || '';
    
    // Create a hidden dummy element for measuring text width
    const dummySpan = document.createElement('span');
    dummySpan.style.visibility = 'hidden';
    dummySpan.style.whiteSpace = 'pre';
    const computedStyle = window.getComputedStyle(searchBox);
    dummySpan.style.fontFamily = computedStyle.fontFamily;
    dummySpan.style.fontSize = computedStyle.fontSize;
    dummySpan.style.fontWeight = computedStyle.fontWeight;
    dummySpan.style.letterSpacing = computedStyle.letterSpacing;
    dummySpan.style.lineHeight = computedStyle.lineHeight;
    dummySpan.textContent = textToMeasure;
    document.body.appendChild(dummySpan);
    const textWidth = dummySpan.offsetWidth;
    document.body.removeChild(dummySpan);
    
    // Calculate available width inside the search box (excluding padding)
    const paddingLeft = parseFloat(computedStyle.paddingLeft);
    const paddingRight = parseFloat(computedStyle.paddingRight);
    const availableWidth = searchBox.clientWidth - paddingLeft - paddingRight;
    
    if (textWidth === 0) return;
    
    const currentFontSize = parseFloat(computedStyle.fontSize);
    // Compute scale factor for perfect fit
    const scaleFactor = availableWidth / textWidth;
    let newFontSize = currentFontSize * scaleFactor;
    newFontSize = Math.max(12, Math.min(newFontSize, 100)); // limit to min/max values
    
    // Apply new font size while preserving the box model
    searchBox.style.height = originalHeight + 'px';
    searchBox.style.fontSize = newFontSize + 'px';
    searchBox.style.lineHeight = originalHeight + 'px'; // Maintain vertical centering
    
    // Ensure the position stays consistent
    if (searchBox.offsetHeight !== originalHeight) {
        const heightDiff = searchBox.offsetHeight - originalHeight;
        searchBox.style.marginTop = -heightDiff/2 + 'px';
    }
}

// Update the typePlaceholder function to use adjustSearchBoxFontSize
function typePlaceholder(text, cb) {
    let typed = "";
    typingInterval = setInterval(() => {
        typed += text[typed.length];
        searchBox.placeholder = typed;
        adjustSearchBoxFontSize(); // Call the adjustment function for each character
        if (typed.length === text.length) {
            clearInterval(typingInterval);
            setTimeout(cb, 1000);
        }
    }, 80);
}

// Update the backspacePlaceholder function to use adjustSearchBoxFontSize
function backspacePlaceholder(cb) {
    const fullText = searchBox.placeholder;
    backspacingInterval = setInterval(() => {
        const current = searchBox.placeholder;
        if (current.length <= 1) {
            clearInterval(backspacingInterval);
            searchBox.placeholder = '';
            cb();
            ensurePlaceholdersActive(); // Ensure placeholders are active after deletion
            return;
        }
        
        // Keep the font size consistent with the full text during deletion
        const newText = current.slice(0, -1);
        searchBox.placeholder = newText;
        searchBox.style.setProperty('--placeholder-size', fitTextToContainer(fullText));
        
        // Add transition for smooth size change
        searchBox.style.transition = 'font-size 0.05s ease-out';
    }, 50);
}

// Add an event listener for placeholder changes
if (searchBox) {
    const originalPlaceholder = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'placeholder');
    
    // Override the placeholder setter to trigger font size adjustment
    Object.defineProperty(searchBox, 'placeholder', {
        set: function(val) {
            originalPlaceholder.set.call(this, val);
            adjustSearchBoxFontSize();
        },
        get: function() {
            return originalPlaceholder.get.call(this);
        }
    });

    // Attach existing event listeners
    searchBox.addEventListener('input', adjustSearchBoxFontSize);
    window.addEventListener('resize', adjustSearchBoxFontSize);
    
    // Initialize on page load
    adjustSearchBoxFontSize();
}

// ...existing code...

document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox) return;

    // Declare these variables once at the top of the DOMContentLoaded handler
    const placeholders = [
        "Accessing Matrix Search Protocol...",
        "Establishing Neural Pathways...",
        "Awaiting User Commands...",
        "Scanning Neural Network...",
        "Initializing Quantum Interface...",
        "Connecting to Cyberdeck...",
        "Bypassing Security Protocols...",
        "Synchronizing Neural Links...",
        "Loading Reality Matrices...",
        "Calibrating Digital Wavelengths...",
        "Interfacing with Cyberspace...",
        "Decrypting Neural Pathways...",
        "Establishing Quantum Entanglement...",
        "Accessing Deep Web Protocols...",
        "Initializing AI Constructs...",
        "Loading Virtual Reality Interface...",
        "Compiling Search Algorithms...",
        "Hacking the Mainframe...",
        "Recalibrating Digital Synapses...",
        "Establishing Secure Connection...",
        "Scanning Dimensional Barriers...",
        "Loading Cybernetic Enhancements...",
        "Initializing Search Matrix...",
        "Compiling Data Streams...",
        "Accessing Digital Consciousness...",
        "Bypassing Neural Firewalls...",
        "Loading Mind-Machine Interface...",
        "Synchronizing Quantum Processors...",
        "Establishing Digital Uplink...",
        "Calculating Search Parameters..."
    ];
    let placeholderIndex = 0;
    let typingInterval;
    let backspacingInterval;
    let typingTimer;
    let isTyping = false;

    // Remove the duplicate declarations that appear later in the code
    // (around line 1080 and elsewhere)
    
    // Initialize placeholder immediately
    searchBox.placeholder = "Initializing...";
    setTimeout(() => {
        if (!searchBox.value) {
            cyclePlaceholders();
        }
    }, 500);

    function ensurePlaceholdersActive() {
        if (!typingInterval && !backspacingInterval) {
            if (placeholderIndex >= placeholders.length) {
                placeholderIndex = 0;
            }
            if (!searchBox.placeholder || searchBox.placeholder.trim() === '') {
                cyclePlaceholders();
            }
        }
    }

    // Update the blur handler
    searchBox.addEventListener('blur', () => {
        searchBox.value = ''; // Clear any input text
        setTimeout(() => {
            searchBox.placeholder = ''; // Force trigger for placeholder update
            ensurePlaceholdersActive();
        }, 0);
    });

    // Update auto-unfocus function
    function startUnfocusTimer() {
        clearTimeout(unfocusTimer);
        if (!searchBox.value) {
            unfocusTimer = setTimeout(() => {
                searchBox.blur();
                ensurePlaceholdersActive();
            }, UNFOCUS_DELAY);
        }
    }

    // Update mouseleave handler
    searchBox.addEventListener('mouseleave', () => {
        if (document.activeElement === searchBox && !searchBox.value) {
            startUnfocusTimer();
        }
    });

    // Reset placeholders when focus is lost
    document.addEventListener('focusout', (e) => {
        if (e.target === searchBox) {
            ensurePlaceholdersActive();
        }
    });

    // Ensure placeholders start when the page loads
    setTimeout(ensurePlaceholdersActive, 500);

    // Add input handler to reset placeholders when input is cleared
    searchBox.addEventListener('input', () => {
        if (!searchBox.value) {
            ensurePlaceholdersActive();
        }
    });
});

// Add flag for backspace state
let isBackspacing = false;

// Listen for backspace key events to control placeholder updates
document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        isBackspacing = true;
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Backspace') {
        isBackspacing = false;
    }
});

// Modify ensurePlaceholdersActive to skip updates during backspacing
function ensurePlaceholdersActive() {
    if (isBackspacing) return; // Do not update when backspacing
    if (!typingInterval && !backspacingInterval) {
        if (placeholderIndex >= placeholders.length) {
            placeholderIndex = 0;
        }
        if (!searchBox.placeholder || searchBox.placeholder.trim() === '') {
            cyclePlaceholders();
        }
    }
}
