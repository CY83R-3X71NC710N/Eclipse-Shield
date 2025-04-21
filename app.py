from flask import Flask, request, jsonify, make_response, send_from_directory, render_template, session, redirect
from flask_cors import CORS
from script import ProductivityAnalyzer
import logging
from functools import lru_cache
from urllib.parse import urlparse
import os
import threading
import time

app = Flask(__name__,
    static_folder='extension',
    template_folder='extension'
)
app.secret_key = 'secret_key_here'

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
app.logger.setLevel(logging.DEBUG) # Set Flask app logger level too

# Configure CORS
CORS(app,
     resources={r"/*": {
         "origins": ["http://localhost:5000", "chrome-extension://*"],
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization", "Accept"],
         "supports_credentials": True,
         "expose_headers": ["Content-Type", "X-CSRFToken"],
         "max_age": 3600
     }})

analyzer = ProductivityAnalyzer()

# Update cache structure to include timestamp and session ID
url_cache = {
    'data': {},
    'timestamps': {},
    'session_ids': {}
}

CACHE_DURATION = 60  # Cache duration in seconds

def clear_expired_cache():
    """Clear expired entries from cache."""
    current_time = time.time()
    expired = []
    for url in url_cache['timestamps']:
        if current_time - url_cache['timestamps'][url] > CACHE_DURATION:
            expired.append(url)
    
    for url in expired:
        del url_cache['data'][url]
        del url_cache['timestamps'][url]
        del url_cache['session_ids'][url]

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        if origin == 'http://localhost:5000' or origin.startswith('chrome-extension://'):
            response.headers.update({
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '3600'
            })
    return response

# NEW: Matrix Animation Routes
@app.route('/matrix-animation')
def matrix_animation_page():
    """Serve the matrix animation page"""
    return render_template('matrix-animation.html')

@app.route('/matrix-animation/<path:filename>')
def matrix_animation_files(filename):
    """Serve matrix animation files"""
    try:
        # First, try to find the file in extension/matrix-animation
        return send_from_directory('extension/matrix-animation', filename)
    except Exception as e:
        app.logger.error(f"Error serving matrix-animation/{filename}: {e}")
        return f"Error loading {filename}", 404

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve files from the assets directory"""
    try:
        return send_from_directory('extension/assets', filename)
    except Exception as e:
        app.logger.error(f"Error serving assets/{filename}: {e}")
        return f"Error loading {filename}", 404

@app.route('/matrix-animation.html')
def matrix_animation_html():
    """Serve a special HTML wrapper for the matrix animation"""
    return render_template('matrix-animation-wrapper.html')

@app.route('/ext-popup')
def popup_page():
    try:
        return send_from_directory('extension', 'popup.html')
    except Exception as e:
        app.logger.error(f"Error serving popup: {e}")
        return "Error loading popup", 500

@app.route('/')
def root():
    return send_from_directory('extension', 'popup.html')

@app.route('/popup.js')
def popup_js():
    return send_from_directory('extension', 'popup.js', mimetype='application/javascript')

@app.route('/block.js')
def block_js():
    return send_from_directory('extension', 'block.js', mimetype='application/javascript')

@app.route('/extension/<path:filename>')
def extension_files(filename):
    try:
        response = make_response(send_from_directory('extension', filename))
        if filename.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'
        elif filename.endswith('.html'):
            response.headers['Content-Type'] = 'text/html'
        elif filename.endswith('.css'):
            response.headers['Content-Type'] = 'text/css'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    except Exception as e:
        app.logger.error(f"Error serving {filename}: {e}")
        return f"Error loading {filename}", 404

@app.route('/get_question', methods=['POST'])
def get_question():
    try:
        data = request.get_json()
        app.logger.debug(f"Received get_question request with data: {data}")

        domain = data.get('domain')
        context = data.get('context', {})

        if not domain:
            return jsonify({"error": "Domain is required"}), 400

        response = analyzer.get_next_question(domain, context)
        return jsonify(response)

    except Exception as e:
        app.logger.error(f"Error in get_question: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/contextualize', methods=['POST'])
def contextualize():
    try:
        data = request.get_json()
        domain = data.get('domain')
        context = data.get('context', {})

        if not domain:
            return jsonify({"error": "Domain is required"}), 400

        # Store the context for later use in analysis
        session['context'] = context
        session['domain'] = domain

        return jsonify({"status": "success"})

    except Exception as e:
        app.logger.error(f"Error in contextualize: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        logger.debug(f"Received analyze request with data: {data}")

        url = data.get('url')
        domain = data.get('domain')
        context = data.get('context', [])
        session_id = data.get('session_id')  # Get session ID from request
        referrer = data.get('referrer')  # Get the referrer info for direct visits
        is_direct_visit = data.get('direct_visit', False)  # Flag indicating if this is a direct visit

        if not url or not domain:
            return jsonify({'error': 'Missing required fields'}), 400

        # Clear expired cache entries
        clear_expired_cache()

        # Check cache, but only use if from same session
        cache_key = f"{url}-{domain}"
        current_time = time.time()
        
        if (cache_key in url_cache['data'] and 
            url_cache['session_ids'][cache_key] == session_id and
            current_time - url_cache['timestamps'][cache_key] <= CACHE_DURATION):
            logger.debug(f"Cache hit for {url}")
            return jsonify(url_cache['data'][cache_key])

        # Convert context array to dictionary format
        if isinstance(context, list):
            context_dict = {}
            for qa in context:
                if isinstance(qa, dict):
                    question = qa.get('question', '')
                    answer = qa.get('answer', '')
                    if question and answer:  # Only add if both exist
                        context_dict[question] = answer
            logger.debug(f"Converted context to dictionary: {context_dict}")
        else:
            context_dict = context if isinstance(context, dict) else {} # Ensure it's a dict or empty dict

        # Update analyzer context (even if empty)
        analyzer.context_data = context_dict
        logger.info(f"Set analyzer context to: {context_dict}")

        try:
            # Additional search signals to add if this is a direct visit with referrer
            additional_signals = {}
            
            # Add direct visit flag to signals
            if is_direct_visit:
                additional_signals['is_direct_visit'] = True
                logger.debug(f"Processing direct visit for URL: {url}")
            
            # Check if referrer is a search engine and extract useful information
            search_query = None
            is_search_engine_referrer = False
            
            if referrer:
                logger.debug(f"Processing referrer information: {referrer}")
                parsed_referrer = urlparse(referrer)
                
                # Check for common search engines
                if any(search_domain in parsed_referrer.netloc.lower() for search_domain in 
                       ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'brave.com', 'startpage.com']):
                    is_search_engine_referrer = True
                    additional_signals['from_search_engine'] = True
                    additional_signals['search_engine'] = parsed_referrer.netloc
                    
                    # Try to extract search query from referrer URL
                    query_params = parsed_referrer.query.split('&')
                    for param in query_params:
                        if '=' in param:
                            key, value = param.split('=', 1)
                            # Common search query parameter names
                            if key.lower() in ['q', 'query', 'p', 'text', 'search']:
                                from urllib.parse import unquote_plus
                                search_query = unquote_plus(value)
                                additional_signals['search_query'] = search_query
                                logger.debug(f"Extracted search query: {search_query}")
                                break
            
            # Get url_signals for signals analysis
            url_signals = analyzer._analyze_url_components(url)
            
            # Merge additional signals from referrer if present
            if additional_signals:
                url_signals.update(additional_signals)
                logger.debug(f"Enhanced URL signals with referrer/direct visit data: {url_signals}")
            
            # Get context relevance for additional information
            context_relevance = analyzer._check_context_relevance(url, url_signals)
            
            # More restrictive handling for search engine referrers with vague queries
            if is_search_engine_referrer and search_query:
                # Block by default for very short search queries (less than 3 characters)
                if len(search_query.strip()) < 3:
                    logger.info(f"Blocking URL due to very short search query: '{search_query}'")
                    return jsonify({
                        'isProductive': False,
                        'explanation': f"Search query '{search_query}' is too vague to determine relevance to your task.",
                        'confidence': 0.8,
                        'signals': url_signals,
                        'context_relevance': context_relevance,
                        'search_query_blocked': True
                    })
                
                # If context exists, require a minimum relevance score for search queries
                if context_dict and context_relevance.get('score', 0) < 0.4:
                    logger.info(f"Blocking URL due to low context relevance for search query: '{search_query}', score: {context_relevance.get('score', 0)}")
                    return jsonify({
                        'isProductive': False,
                        'explanation': f"Search query '{search_query}' has low relevance to your current task.",
                        'confidence': 0.7,
                        'signals': url_signals,
                        'context_relevance': context_relevance,
                        'search_query_blocked': True
                    })
            
            # Call the updated analyze_website which returns a dict
            analysis_result = analyzer.analyze_website(url, domain)
            logger.info(f"Analysis result for {url}: {analysis_result}")
            
            # Build enhanced result with analytics data but use the actual result from analyze_website
            result = {
                'isProductive': analysis_result['isProductive'],
                'explanation': analysis_result['explanation'],
                'confidence': get_confidence_score(url_signals, context_relevance),
                'signals': url_signals,
                'context_relevance': context_relevance,
                'context_used': context_dict,  # Add this for debugging
                'referrer_data': additional_signals if additional_signals else None,  # Include referrer analysis
                'direct_visit': is_direct_visit  # Include direct visit flag in result
            }

            # Add result to cache
            url_cache['data'][cache_key] = result
            url_cache['timestamps'][cache_key] = current_time
            url_cache['session_ids'][cache_key] = session_id
            logger.debug(f"Cached result for {url}")
            
            # Log more details for direct visits to help with debugging
            if is_direct_visit:
                logger.info(f"Direct visit analysis result for {url}: isProductive={result['isProductive']}, explanation={result['explanation']}")

            return jsonify(result)

        except Exception as e:
            logger.error(f"Error analyzing URL: {str(e)}")
            return jsonify({
                'error': str(e),
                'isProductive': False,
                'explanation': f'Error analyzing URL: {str(e)}'
            }), 500

    except Exception as e:
        logger.error(f"Error in analyze endpoint: {str(e)}")
        return jsonify({
            'error': str(e),
            'isProductive': False,
            'explanation': f'Error processing request: {str(e)}'
        }), 500

# Since analyze_website now returns the explanation directly, this function is only used for confidence scoring
def get_confidence_score(signals: dict, relevance: dict) -> float:
    """Calculate confidence score based on signals and relevance."""
    base_score = 0.5
    
    if signals.get('is_search'):
        base_score += 0.2
    if signals.get('is_educational'):
        base_score += 0.1
    if relevance.get('score'):
        base_score += min(0.3, relevance.get('score'))
        
    return min(1.0, base_score)

@app.route('/block.html')
@app.route('/extension/block.html')
@app.route('/block')
def block_page():
    """Serve the block page for both extension and development environments."""
    try:
        # Get parameters
        reason = request.args.get('reason', 'This site has been blocked to help you stay focused.')
        url = request.args.get('url', '')
        duration = request.args.get('duration')
        original_url = request.args.get('original_url', '')

        # Skip blocking for special URLs
        if (url.startswith('chrome://') or 
            url.startswith('chrome-extension://') or 
            url.startswith('about:') or 
            'localhost:5000' in url):
            return redirect(original_url or '/')

        # Render block page with parameters
        return render_template(
            'block.html',
            reason=reason,
            url=url,
            duration=duration,
            original_url=original_url
        )
    except Exception as e:
        app.logger.error(f"Error serving block page: {e}")
        return "Error loading block page", 500

# Add URL validation
def is_valid_url(url: str) -> bool:
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

@lru_cache(maxsize=1000)
def cache_analysis(url, domain):
    """Cache analysis results for URLs."""
    return analyzer.analyze_website(url, domain)

@app.route('/dev/storage', methods=['GET'])
def debug_storage():
    """Debug endpoint to view current storage state."""
    if not app.debug:
        return "Debug endpoint disabled", 403
    
    storage_data = {
        'message': 'Access the storage state in the browser console using DEV_STORAGE'
    }
    return jsonify(storage_data), 200

# Add periodic cache cleanup
def cleanup_cache():
    """Periodically clean up expired cache entries."""
    while True:
        time.sleep(60)  # Run every minute
        clear_expired_cache()

# Start cache cleanup thread
cleanup_thread = threading.Thread(target=cleanup_cache, daemon=True)
cleanup_thread.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)