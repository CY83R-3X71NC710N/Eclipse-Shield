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
            context_dict = context

        if not context_dict:
            logger.warning("No valid context data provided")
            return jsonify({
                'isProductive': False,
                'explanation': 'No task context available. Please set up a productivity session.',
                'confidence': 0.0
            })

        # Update analyzer context
        analyzer.context_data = context_dict
        logger.info(f"Set analyzer context to: {context_dict}")

        try:
            is_productive = analyzer.analyze_website(url, domain)
            url_signals = analyzer._analyze_url_components(url)
            context_relevance = analyzer._check_context_relevance(url, url_signals.get('search_query'))

            result = {
                'isProductive': bool(is_productive),
                'explanation': get_explanation(is_productive, url_signals, context_relevance, context_dict),
                'confidence': get_confidence_score(url_signals, context_relevance),
                'signals': url_signals,
                'context_relevance': context_relevance,
                'context_used': context_dict  # Add this for debugging
            }

            # Store result in cache with timestamp and session ID
            url_cache['data'][cache_key] = result
            url_cache['timestamps'][cache_key] = current_time
            url_cache['session_ids'][cache_key] = session_id

            return jsonify(result)

        except Exception as e:
            logger.error(f"Error analyzing URL: {str(e)}")
            return jsonify({
                'error': str(e),
                'isProductive': False,
                'explanation': 'Error analyzing URL'
            }), 500

    except Exception as e:
        logger.error(f"Error in analyze endpoint: {str(e)}")
        return jsonify({
            'error': str(e),
            'isProductive': False,
            'explanation': 'Error processing request'
        }), 500

def get_explanation(is_productive: bool, signals: dict, relevance: dict, context: dict) -> str:
    """Generate a detailed explanation based on context and analysis."""
    if not context:
        return "No task context available. Please set up a productivity session."
    
    if is_productive:
        if relevance.get('matched_terms'):
            return f"Content matches your task: {', '.join(relevance['matched_terms'])}"
        elif signals.get('is_search'):
            return 'Search query allowed for task research'
        return 'Content appears relevant to your task'
    
    return 'Content does not match your current task focus'

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