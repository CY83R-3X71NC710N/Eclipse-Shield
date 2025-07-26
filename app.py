from flask import Flask, request, jsonify, make_response, send_from_directory, render_template, session, redirect
from flask_cors import CORS
from script import ProductivityAnalyzer
import logging
from functools import lru_cache
from urllib.parse import urlparse
import os
import sys # Added for sys.exit
import threading
import time
import atexit # Added for cleanup

# --- PID Check Addition ---
# Try importing psutil for reliable process checking
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    # Warning if psutil is not installed
    print("WARNING: psutil library not found. PID checking will be less reliable (especially on Windows).")
    print("Install using: pip install psutil")
    # On Windows, we really need psutil. On Unix-like, os.kill is a fallback.
    if os.name == 'nt':
         print("ERROR: psutil is required for reliable PID checking on Windows. Exiting.")
         sys.exit(1) # Exit if on Windows without psutil

# --- Flask App Setup ---
app = Flask(__name__,
    static_folder='extension',
    template_folder='extension'
)
app.secret_key = 'secret_key_here' # CHANGE THIS IN PRODUCTION

# Enable detailed logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
app.logger.handlers = logger.handlers # Use the same handlers
app.logger.setLevel(logging.DEBUG) # Set Flask app logger level too

# --- PID File Configuration ---
PID_FILE = "flask_app.pid" # Name of the file to store the PID

# --- PID Check Functions ---
def is_process_running(pid):
    """Check if a process with the given PID is running."""
    if not isinstance(pid, int) or pid <= 0:
        return False
    if PSUTIL_AVAILABLE:
        try:
            process = psutil.Process(pid)
            # Optional: Add a check here to be more certain it's the *same* script
            # e.g., by comparing process.cmdline() or process.create_time()
            # For simplicity, just check if it's running.
            return process.is_running()
        except psutil.NoSuchProcess:
            return False
        except psutil.AccessDenied:
            # Process exists but we lack permissions to query it fully.
            # Assume it's running to be safe.
            logger.warning(f"Access denied when checking PID {pid}. Assuming it's running.")
            return True
    else:
        # Fallback for Unix-like systems without psutil
        if os.name != 'nt':
            try:
                # Sending signal 0 doesn't kill the process but checks if it exists
                # and if we have permission to signal it.
                os.kill(pid, 0)
                return True
            except ProcessLookupError: # PID does not exist
                return False
            except PermissionError: # PID exists, but we lack permissions
                logger.warning(f"Permission error when checking PID {pid} (using os.kill). Assuming it's running.")
                return True
            except OSError as e:
                 logger.error(f"Unexpected OSError checking PID {pid} (using os.kill): {e}")
                 return False # Cannot confirm, assume not running to avoid false block? Or True to be safe? Let's say False.
        else:
            # Should have exited earlier if on Windows without psutil
            logger.error("Cannot reliably check process on Windows without psutil.")
            return False # Cannot confirm

def remove_pid_file():
    """Remove the PID file if it exists and contains the current process's PID."""
    try:
        if os.path.exists(PID_FILE):
            # Check if the PID in the file matches the current process before removing
            pid_in_file = -1
            try:
                 with open(PID_FILE, "r") as f:
                      content = f.read().strip()
                      if content:
                           pid_in_file = int(content)
            except (IOError, ValueError) as read_err:
                 logger.warning(f"Could not read PID from {PID_FILE} during cleanup: {read_err}")
                 # If we can't read it, maybe just delete it? Or leave it? Let's leave it if unsure.
                 return

            if pid_in_file == os.getpid():
                 os.remove(PID_FILE)
                 logger.info(f"Removed PID file {PID_FILE} on exit.")
            else:
                 # This could happen if the process crashed and a new one started before cleanup somehow
                 logger.warning(f"PID file {PID_FILE} contained PID {pid_in_file}, but current PID is {os.getpid()}. Not removing.")
    except OSError as e:
        logger.error(f"Error removing PID file {PID_FILE}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during PID file cleanup: {e}")

# Register the cleanup function to run when the script exits
atexit.register(remove_pid_file)
# --- End PID Check Setup ---


# Configure CORS (Keep existing CORS config)
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

# Cache structure and functions (Keep existing)
url_cache = {
    'data': {},
    'timestamps': {},
    'session_ids': {}
}
CACHE_DURATION = 60
def clear_expired_cache():
    # ... (keep existing implementation)
    current_time = time.time()
    expired = []
    lock = threading.Lock() # Add lock for thread safety if clearing from multiple places
    with lock:
        for url in list(url_cache['timestamps']): # Iterate over copy of keys
            if current_time - url_cache['timestamps'][url] > CACHE_DURATION:
                expired.append(url)

        for url in expired:
            if url in url_cache['data']: del url_cache['data'][url]
            if url in url_cache['timestamps']: del url_cache['timestamps'][url]
            if url in url_cache['session_ids']: del url_cache['session_ids'][url]
        if expired:
            logger.debug(f"Cleared {len(expired)} expired cache entries.")


@app.after_request
def after_request(response):
    # ... (keep existing implementation)
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

# --- Routes (Keep existing routes) ---

@app.route('/matrix-animation')
def matrix_animation_page():
    return render_template('matrix-animation.html')

@app.route('/matrix-animation/<path:filename>')
def matrix_animation_files(filename):
    try:
        return send_from_directory('extension/matrix-animation', filename)
    except Exception as e:
        app.logger.error(f"Error serving matrix-animation/{filename}: {e}")
        return f"Error loading {filename}", 404

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    try:
        return send_from_directory('extension/assets', filename)
    except Exception as e:
        app.logger.error(f"Error serving assets/{filename}: {e}")
        return f"Error loading {filename}", 404

@app.route('/matrix-animation.html')
def matrix_animation_html():
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
    # ... (keep existing implementation)
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
    # ... (keep existing implementation)
    try:
        data = request.get_json()
        domain = data.get('domain')
        context = data.get('context', {})
        if not domain:
            return jsonify({"error": "Domain is required"}), 400
        session['context'] = context
        session['domain'] = domain
        return jsonify({"status": "success"})
    except Exception as e:
        app.logger.error(f"Error in contextualize: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    # ... (keep existing implementation)
    try:
        data = request.get_json()
        logger.debug(f"Received analyze request with data: {data}")
        # ... (rest of analyze logic remains the same)
        url = data.get('url')
        domain = data.get('domain')
        context = data.get('context', [])
        session_id = data.get('session_id')  # Get session ID from request
        referrer = data.get('referrer')  # Get the referrer info for direct visits
        is_direct_visit = data.get('direct_visit', False)  # Flag indicating if this is a direct visit

        if not url or not domain:
            return jsonify({'error': 'Missing required fields'}), 400

        clear_expired_cache()

        cache_key = f"{url}-{domain}"
        current_time = time.time()

        if (cache_key in url_cache['data'] and
            url_cache['session_ids'].get(cache_key) == session_id and # Use .get for safety
            current_time - url_cache['timestamps'].get(cache_key, 0) <= CACHE_DURATION): # Use .get for safety
            logger.debug(f"Cache hit for {url}")
            return jsonify(url_cache['data'][cache_key])

        # Convert context array to dictionary format
        if isinstance(context, list):
            context_dict = {}
            for qa in context:
                if isinstance(qa, dict):
                    question = qa.get('question', '')
                    answer = qa.get('answer', '')
                    if question and answer:
                        context_dict[question] = answer
            logger.debug(f"Converted context to dictionary: {context_dict}")
        else:
            context_dict = context if isinstance(context, dict) else {}

        analyzer.context_data = context_dict
        logger.info(f"Set analyzer context to: {context_dict}")

        try:
            additional_signals = {}
            if is_direct_visit:
                additional_signals['is_direct_visit'] = True
                logger.debug(f"Processing direct visit for URL: {url}")

            search_query = None
            is_search_engine_referrer = False
            if referrer:
                logger.debug(f"Processing referrer information: {referrer}")
                parsed_referrer = urlparse(referrer)
                if any(search_domain in parsed_referrer.netloc.lower() for search_domain in
                       ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'brave.com', 'startpage.com']):
                    is_search_engine_referrer = True
                    additional_signals['from_search_engine'] = True
                    additional_signals['search_engine'] = parsed_referrer.netloc
                    query_params = parsed_referrer.query.split('&')
                    for param in query_params:
                        if '=' in param:
                            key, value = param.split('=', 1)
                            if key.lower() in ['q', 'query', 'p', 'text', 'search']:
                                from urllib.parse import unquote_plus
                                search_query = unquote_plus(value)
                                additional_signals['search_query'] = search_query
                                logger.debug(f"Extracted search query: {search_query}")
                                break

            url_signals = analyzer._analyze_url_components(url)
            if additional_signals:
                url_signals.update(additional_signals)
                logger.debug(f"Enhanced URL signals with referrer/direct visit data: {url_signals}")

            context_relevance = analyzer._check_context_relevance(url, url_signals)

            if is_search_engine_referrer and search_query:
                if len(search_query.strip()) < 3:
                    logger.info(f"Blocking URL due to very short search query: '{search_query}'")
                    # ... (return block response)
                    return jsonify({
                        'isProductive': False,
                        'explanation': f"Search query '{search_query}' is too vague to determine relevance to your task.",
                        'confidence': 0.8,
                        'signals': url_signals,
                        'context_relevance': context_relevance,
                        'search_query_blocked': True
                    })
                if context_dict and context_relevance.get('score', 0) < 0.4:
                    logger.info(f"Blocking URL due to low context relevance for search query: '{search_query}', score: {context_relevance.get('score', 0)}")
                    # ... (return block response)
                    return jsonify({
                        'isProductive': False,
                        'explanation': f"Search query '{search_query}' has low relevance to your current task.",
                        'confidence': 0.7,
                        'signals': url_signals,
                        'context_relevance': context_relevance,
                        'search_query_blocked': True
                    })

            analysis_result = analyzer.analyze_website(url, domain)
            logger.info(f"Analysis result for {url}: {analysis_result}")

            result = {
                'isProductive': analysis_result['isProductive'],
                'explanation': analysis_result['explanation'],
                'confidence': get_confidence_score(url_signals, context_relevance),
                'signals': url_signals,
                'context_relevance': context_relevance,
                'context_used': context_dict,
                'referrer_data': additional_signals if additional_signals else None,
                'direct_visit': is_direct_visit
            }

            url_cache['data'][cache_key] = result
            url_cache['timestamps'][cache_key] = current_time
            url_cache['session_ids'][cache_key] = session_id
            logger.debug(f"Cached result for {url}")

            if is_direct_visit:
                logger.info(f"Direct visit analysis result for {url}: isProductive={result['isProductive']}, explanation={result['explanation']}")

            return jsonify(result)

        except Exception as e:
            logger.exception(f"Error analyzing URL internal block: {url}") # Log stack trace
            return jsonify({
                'error': str(e),
                'isProductive': False, # Default to non-productive on error
                'explanation': f'Error analyzing URL: {str(e)}'
            }), 500

    except Exception as e:
        logger.exception("Error in analyze endpoint top level") # Log stack trace
        return jsonify({
            'error': str(e),
            'isProductive': False, # Default to non-productive on error
            'explanation': f'Error processing request: {str(e)}'
        }), 500


def get_confidence_score(signals: dict, relevance: dict) -> float:
    # ... (keep existing implementation)
    base_score = 0.5
    if signals.get('is_search'): base_score += 0.2
    if signals.get('is_educational'): base_score += 0.1
    if relevance.get('score'): base_score += min(0.3, relevance.get('score', 0))
    return min(1.0, max(0.0, base_score)) # Ensure score is between 0.0 and 1.0

@app.route('/block.html')
@app.route('/extension/block.html')
@app.route('/block')
def block_page():
    # ... (keep existing implementation)
    try:
        reason = request.args.get('reason', 'This site has been blocked to help you stay focused.')
        url = request.args.get('url', '')
        duration = request.args.get('duration')
        original_url = request.args.get('original_url', '')
        if (url.startswith('chrome://') or url.startswith('chrome-extension://') or
            url.startswith('about:') or 'localhost:5000' in url):
            return redirect(original_url or '/')
        return render_template(
            'block.html', reason=reason, url=url, duration=duration, original_url=original_url
        )
    except Exception as e:
        app.logger.error(f"Error serving block page: {e}")
        return "Error loading block page", 500

def is_valid_url(url: str) -> bool:
    # ... (keep existing implementation)
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

@lru_cache(maxsize=1000)
def cache_analysis(url, domain):
    # ... (keep existing implementation)
    return analyzer.analyze_website(url, domain)

@app.route('/dev/storage', methods=['GET'])
def debug_storage():
    # ... (keep existing implementation)
    if not app.debug:
        return "Debug endpoint disabled", 403
    storage_data = { 'message': 'Access the storage state in the browser console using DEV_STORAGE' }
    return jsonify(storage_data), 200

# Add periodic cache cleanup thread (keep existing)
def cleanup_cache_thread_func():
    """Periodically clean up expired cache entries."""
    while True:
        time.sleep(CACHE_DURATION + 5) # Run slightly longer than cache duration
        try:
            logger.debug("Running periodic cache cleanup...")
            clear_expired_cache()
        except Exception as e:
             logger.error(f"Error during periodic cache cleanup: {e}")

cleanup_thread = threading.Thread(target=cleanup_cache_thread_func, daemon=True)
cleanup_thread.start()

# Add this route for the extension.crx file
@app.route('/extension.crx')
def serve_extension_crx():
    try:
        return send_from_directory('extension', 'extension.crx', as_attachment=True)
    except Exception as e:
        app.logger.error(f"Error serving extension.crx: {e}")
        return "Error loading extension.crx", 500

# Add this route for the update.xml file
@app.route('/update.xml')
def serve_update_xml():
    try:
        return send_from_directory('.', 'update.xml', as_attachment=True)
    except Exception as e:
        app.logger.error(f"Error serving update.xml: {e}")
        return "Error loading update.xml", 500


# --- Main Execution Block ---
if __name__ == '__main__':

    # --- PID Check Logic ---
    logger.info(f"Checking PID file: {PID_FILE}")
    if os.path.exists(PID_FILE):
        try:
            existing_pid = -1
            with open(PID_FILE, "r") as f:
                content = f.read().strip()
                if content:
                    existing_pid = int(content)
                else:
                    logger.warning(f"PID file {PID_FILE} is empty. Will overwrite.")

            if existing_pid > 0:
                 if is_process_running(existing_pid):
                     logger.error(f"Another instance appears to be running with PID {existing_pid} (from {PID_FILE}). Exiting.")
                     # Optionally, you could try to verify if the process name matches your script
                     sys.exit(1) # Exit if another process is found
                 else:
                     logger.warning(f"Found stale PID file {PID_FILE} for PID {existing_pid} (process not running). Overwriting.")
        except (IOError, ValueError) as e:
            logger.warning(f"Error reading or parsing PID file {PID_FILE}: {e}. Will attempt to overwrite.")
        except Exception as e:
            # Catch any other unexpected errors during PID check
            logger.error(f"Unexpected error during PID check for {PID_FILE}: {e}. Exiting to be safe.")
            sys.exit(1)

    # If we reached here, either no PID file exists, it was stale, or empty/invalid.
    # Write the current process's PID to the file.
    try:
        current_pid = os.getpid()
        with open(PID_FILE, "w") as f:
            f.write(str(current_pid))
        logger.info(f"Application starting with PID {current_pid}. PID written to {PID_FILE}.")
    except IOError as e:
        logger.error(f"FATAL: Could not write PID file {PID_FILE}: {e}. Cannot guarantee single instance. Exiting.")
        sys.exit(1) # Exit if we cannot write the PID file

    # --- Start Flask App ---
    try:
        logger.info("Starting Flask application server...")
        # Note: Flask's reloader (debug=True) might interfere slightly with PID file logic
        # as it restarts the process. The atexit cleanup should generally handle this,
        # but be aware if you see oddities during development.
        # Setting use_reloader=False might be more stable with PID files if `debug=True` causes issues.
        app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False) # Consider use_reloader=False for stability with PID file
    except Exception as e:
        logger.error(f"Flask application failed to start: {e}")
        remove_pid_file() # Attempt cleanup even if app.run fails immediately
        sys.exit(1)
    finally:
        # This block might not always be reached if the process is killed forcefully,
        # but atexit is the primary cleanup mechanism.
        logger.info("Flask application shutting down.")
        # atexit will handle PID file removal
