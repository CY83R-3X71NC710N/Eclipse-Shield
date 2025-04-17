import os
import json
import requests
from google import genai
from typing import Dict, List
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import logging

# Setup logging for script.py - ENHANCED LOGGING
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG for maximum verbosity
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(filename)s - %(lineno)d - %(message)s') # More detailed format
handler.setFormatter(formatter)
logger.addHandler(handler)

def load_api_key() -> str:
    """Load API key from file or environment variable."""
    logger.debug("load_api_key - START")
    api_key = os.getenv("API_KEY")
    if not api_key:
        try:
            with open("api_key.txt", "r") as f:
                api_key = f.read().strip()
                logger.debug("load_api_key - API key loaded from api_key.txt")
        except FileNotFoundError:
            error_msg = "API key not found in environment or api_key.txt"
            logger.error(f"load_api_key - {error_msg}")
            raise Exception(error_msg)
    else:
        logger.debug("load_api_key - API key loaded from environment variable")
    logger.debug("load_api_key - END")
    return api_key

def load_domain_settings() -> Dict:
    """Load domain settings from settings.json."""
    logger.debug("load_domain_settings - START")
    try:
        with open("settings.json", "r") as f:
            settings = json.load(f)
            logger.debug("load_domain_settings - Settings loaded from settings.json")
            logger.debug(f"load_domain_settings - Settings content: {settings}") # Log settings content
            logger.debug("load_domain_settings - END - SUCCESS")
            return settings
    except FileNotFoundError:
        error_msg = "settings.json file not found."
        logger.error(f"load_domain_settings - {error_msg}")
        raise FileNotFoundError(error_msg)
    except json.JSONDecodeError:
        error_msg = "settings.json is not valid JSON."
        logger.error(f"load_domain_settings - {error_msg}")
        raise json.JSONDecodeError(error_msg, 'settings.json', 0)
    except Exception as e:
        logger.error(f"load_domain_settings - Error loading settings: {e}")
        raise

class ProductivityAnalyzer:
    def __init__(self):
        logger.debug("ProductivityAnalyzer.__init__ - START")
        self.api_key = load_api_key()
        self.settings = load_domain_settings()
        self.client = genai.Client(api_key=self.api_key)
        self.context_data = {}
        logger.debug("ProductivityAnalyzer.__init__ - Analyzer initialized, API key loaded, settings loaded, client created.")
        logger.debug("ProductivityAnalyzer.__init__ - END")

    def get_next_question(self, domain: str, context: Dict) -> Dict:
        """Get the next contextual question based on previous answers using AI."""
        logger.debug(f"ProductivityAnalyzer.get_next_question - START - Domain: {domain}, Context: {context}")
        try:
            if not context:
                prompt = f"""As a productivity assistant, ask one direct question to understand what the user is working on in the {domain} domain.
                Keep it simple and focused on their immediate task.
                Example good questions:
                - What specific task are you working on?
                - What are you trying to accomplish?

                Respond with only the question text, no additional formatting."""
                logger.debug("ProductivityAnalyzer.get_next_question - First question - Prompt:\n" + prompt) # Log prompt

            else:
                context_json = json.dumps(context, indent=2)
                prompt = f"""Based on this context about a {domain} task, determine if you have enough information or need to ask one more question.

                Previous Q&A:
                {context_json}

                First, analyze if you have enough information to understand:
                1. What specific task/activity the user is doing
                2. What they are trying to achieve (goal/outcome)

                If you have clear answers to BOTH of these, respond with exactly 'DONE'.

                If you're missing either of these key pieces of information, ask ONE focused follow-up question about what you're missing.
                Do not ask about time, duration, or scheduling.
                Keep the question concise and direct.

                Respond with either exactly 'DONE' or your single follow-up question (no other text)."""
                logger.debug("ProductivityAnalyzer.get_next_question - Subsequent question - Prompt:\n" + prompt) # Log prompt

            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            question = response.text.strip()
            logger.debug(f"ProductivityAnalyzer.get_next_question - AI Response Text: {question}") # Log response text

            if question.upper() == 'DONE':
                logger.debug("ProductivityAnalyzer.get_next_question - AI returned 'DONE'")
                logger.debug("ProductivityAnalyzer.get_next_question - END - DONE")
                return {"question": "DONE"}

            logger.debug(f"ProductivityAnalyzer.get_next_question - Next question: {question}")
            logger.debug("ProductivityAnalyzer.get_next_question - END - Question generated")
            return {"question": question}

        except Exception as e:
            logger.error(f"ProductivityAnalyzer.get_next_question - Error generating question: {e}")
            default_question = "What are you trying to accomplish?"
            logger.debug(f"ProductivityAnalyzer.get_next_question - Returning default question: {default_question}")
            logger.debug("ProductivityAnalyzer.get_next_question - END - ERROR, returning default")
            return {"question": default_question}

    def contextualize(self, domain: str) -> None:
        """Ask focused questions one at a time to contextualize the task."""
        logger.debug(f"ProductivityAnalyzer.contextualize - START - Domain: {domain}")
        conversation_history = []
        self.context_data = {}
        logger.debug("ProductivityAnalyzer.contextualize - Conversation history and context data initialized.")

        while True:
            question_data = self.get_next_question(domain, conversation_history)
            question = question_data["question"]
            logger.debug(f"ProductivityAnalyzer.contextualize - Received question from get_next_question: {question}")

            if question.upper() == 'DONE':
                logger.info("ProductivityAnalyzer.contextualize - Context gathering complete (AI returned DONE).") # Changed to INFO
                logger.debug("ProductivityAnalyzer.contextualize - Context data gathered:\n" + json.dumps(self.context_data, indent=2))
                logger.debug("ProductivityAnalyzer.contextualize - END - DONE")
                break

            print("\n" + question)
            print("-" * 40)
            answer = input("Answer: ")
            print()

            conversation_history.append({"question": question, "answer": answer})
            self.context_data[question] = answer
            logger.debug(f"ProductivityAnalyzer.contextualize - User answer recorded. Question: '{question}', Answer: '{answer}'")

        logger.debug("ProductivityAnalyzer.contextualize - END - Contextualization loop finished")

    def _get_domain_from_url(self, url: str) -> str:
        """Extract the base domain from a URL."""
        logger.debug(f"ProductivityAnalyzer._get_domain_from_url - START - URL: {url}")
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            logger.debug(f"ProductivityAnalyzer._get_domain_from_url - Parsed domain: {domain}")
            logger.debug("ProductivityAnalyzer._get_domain_from_url - END - SUCCESS")
            return domain
        except Exception as e:
            logger.warning(f"ProductivityAnalyzer._get_domain_from_url - Error parsing URL '{url}': {e}") # Changed to logger.warning
            logger.debug("ProductivityAnalyzer._get_domain_from_url - END - ERROR, returning None")
            return None

    def _is_allowed_platform(self, url: str, domain: str) -> bool:
        """Check if URL belongs to allowed platforms for specific domain."""
        try:
            base_domain = self._get_domain_from_url(url)
            logger.debug(f"_is_allowed_platform - Checking domain: {base_domain} for URL: {url} in {domain} context")
            
            if not base_domain:
                return False

            settings = self.settings["domains"][domain]
            url_lower = url.lower()
            hostname_lower = base_domain.lower()

            # Only check platform types that exist in this domain's settings
            allowed_platform_types = ['lms_platforms', 'productivity_tools', 'ai_tools']
            
            for platform_type in allowed_platform_types:
                if platform_type not in settings:
                    continue
                    
                for platform in settings[platform_type]:
                    platform_lower = platform.lower()
                    if platform_lower in hostname_lower or platform_lower in url_lower:
                        logger.info(f"Platform match in {domain} domain - Type: {platform_type}, Platform: {platform}")
                        return True

            logger.debug(f"No allowed platform match for {url} in {domain} domain")
            return False

        except Exception as e:
            logger.error(f"Error in _is_allowed_platform: {e}")
            return False

    def _is_ai_site(self, url: str) -> bool:
        """Check if the URL belongs to a known AI tool site."""
        logger.debug(f"ProductivityAnalyzer._is_ai_site - START - URL: {url}")
        base_domain = self._get_domain_from_url(url)
        logger.debug(f"ProductivityAnalyzer._is_ai_site - Base domain from URL: {base_domain}")
        if not base_domain:
            logger.debug("ProductivityAnalyzer._is_ai_site - Base domain is None, returning False")
            return False

        ai_patterns = [
            "chat.openai.com", "chatgpt.com",
            "bard.google.com",
            "claude.ai",
            "gemini.google.com",
            "copilot.github.com"
        ]
        logger.debug(f"ProductivityAnalyzer._is_ai_site - AI patterns: {ai_patterns}")
        is_ai = any(base_domain.endswith(ai_domain) for ai_domain in ai_patterns)
        logger.debug(f"ProductivityAnalyzer._is_ai_site - AI site match found: {is_ai}")
        logger.debug("ProductivityAnalyzer._is_ai_site - END - Returning: " + str(is_ai))
        return is_ai

    def _is_productive_domain(self, url: str, domain: str) -> bool:
        """Check if the domain is in the productive list."""
        logger.debug(f"ProductivityAnalyzer._is_productive_domain - START - URL: {url}, Domain: {domain}")
        base_domain = self._get_domain_from_url(url)
        logger.debug(f"ProductivityAnalyzer._is_productive_domain - Base domain from URL: {base_domain}")
        if not base_domain:
            logger.debug("ProductivityAnalyzer._is_productive_domain - Base domain is None, returning None")
            logger.debug("ProductivityAnalyzer._is_productive_domain - END - No base domain, returning None")
            return None # Important to return None if no base domain

        settings = self.settings["domains"][domain]
        logger.debug(f"ProductivityAnalyzer._is_productive_domain - Domain settings: {settings}")

        if self._is_allowed_platform(url, domain):
            logger.debug("ProductivityAnalyzer._is_productive_domain - Is allowed platform, returning True")
            logger.debug("ProductivityAnalyzer._is_productive_domain - END - Allowed platform, returning True")
            return True

        if "blocked_specific" in settings:
            for blocked in settings["blocked_specific"]:
                if base_domain.endswith(blocked):
                    logger.debug(f"ProductivityAnalyzer._is_productive_domain - Blocked specific domain '{blocked}' match. Returning False")
                    logger.debug("ProductivityAnalyzer._is_productive_domain - END - Blocked specific domain, returning False")
                    return False

        logger.debug("ProductivityAnalyzer._is_productive_domain - No explicit productive/blocked rule found. Returning None for further analysis.")
        logger.debug("ProductivityAnalyzer._is_productive_domain - END - Needs analysis, returning None")
        return None

    def _analyze_url_components(self, url: str, skip_context: bool = False) -> dict:
        """Enhanced URL component analysis with keyword checking."""
        try:
            parsed = urlparse(url)
            path_parts = parsed.path.lower().split('/')
            query_parts = parsed.query.lower().split('&')
            
            # Extract search query if present
            search_query = next((
                param.split('=')[1] 
                for param in query_parts 
                if param.startswith('q=') or param.startswith('query=')
            ), None)

            # Basic URL analysis without context checking
            signals = {
                'is_search': any(term in parsed.netloc for term in ['search', 'find', 'query']) or
                            any(term in parsed.path for term in ['search', 'find', 'query']) or
                            any(param.startswith(('q=', 'query=', 'search=')) for param in query_parts),
                'is_educational': any(term in parsed.netloc for term in ['edu', 'learn', 'course', 'study', 'academic', 'school']),
                'is_reference': any(term in parsed.netloc for term in ['wiki', 'docs', 'documentation', 'reference']),
                'search_query': search_query,
                'domain_type': self._categorize_domain(parsed.netloc),
                'path_indicators': [part for part in path_parts if part],
                'hostname': parsed.netloc,
            }
            
            # Add keyword detection
            url_lower = url.lower()
            signals['has_blocked_keywords'] = any(
                keyword.lower() in url_lower 
                for keyword in ['game', 'unblocked', 'entertainment', 'proxy', 'bypass']
            )
            
            # Add path analysis
            signals['suspicious_paths'] = any(
                keyword in path_parts 
                for keyword in ['games', 'unblocked', 'bypass', 'proxy', 'hack']
            )

            # Only check context relevance if not skipped
            if not skip_context:
                signals.update({
                    'likely_productive': (
                        signals['is_search'] or 
                        signals['is_educational'] or 
                        signals['is_reference'] or
                        'docs' in parsed.netloc or
                        'documentation' in parsed.netloc
                    ),
                    'context_relevance': self._check_context_relevance(url, search_query)
                })
            
            return signals
            
        except Exception as e:
            logger.error(f"Error analyzing URL components: {e}")
            return {'error': str(e)}

    def _check_context_relevance(self, url: str, search_query: str = None) -> dict:
        """Enhanced context relevance checking with detailed scoring."""
        try:
            if not self.context_data:
                logger.warning("No context data available for analysis")
                return {
                    'score': 0.0,
                    'matched_terms': [],
                    'matches': []
                }

            logger.debug(f"Checking context relevance with data: {self.context_data}")
            
            relevance = {
                'score': 0.0,
                'matched_terms': [],
                'matches': []
            }

            # Process all answers into searchable terms
            context_terms = []
            for question, answer in self.context_data.items():
                if isinstance(answer, str):
                    # Clean and split into terms
                    terms = [t.lower().strip('.,?!') for t in answer.split()]
                    # Add individual terms
                    context_terms.extend(terms)
                    # Add 2-word combinations for better phrase matching
                    context_terms.extend([
                        f"{terms[i]} {terms[i+1]}"
                        for i in range(len(terms)-1)
                    ])
                    # Add 3-word combinations
                    context_terms.extend([
                        f"{terms[i]} {terms[i+1]} {terms[i+2]}"
                        for i in range(len(terms)-2)
                    ])

            # Remove duplicates and very short terms
            context_terms = [term for term in set(context_terms) if len(term) > 2]
            
            url_lower = url.lower()
            logger.debug(f"Checking URL {url_lower} against terms: {context_terms}")

            # Check URL components
            for term in context_terms:
                if term in url_lower:
                    relevance['score'] += 0.3
                    relevance['matched_terms'].append(term)
                    relevance['matches'].append({
                        'term': term,
                        'location': 'url',
                        'weight': 0.3
                    })

            # Check search query with higher weight
            if search_query:
                try:
                    decoded_query = requests.utils.unquote(search_query).lower()
                    logger.debug(f"Checking search query: {decoded_query}")
                    for term in context_terms:
                        if term in decoded_query:
                            relevance['score'] += 0.5
                            relevance['matched_terms'].append(term)
                            relevance['matches'].append({
                                'term': term,
                                'location': 'search_query',
                                'weight': 0.5
                            })
                except Exception as e:
                    logger.warning(f"Error processing search query: {e}")

            # Normalize score
            relevance['score'] = min(1.0, relevance['score'])
            relevance['matched_terms'] = list(set(relevance['matched_terms']))
            
            logger.debug(f"Context relevance result: {relevance}")
            return relevance

        except Exception as e:
            logger.error(f"Error in _check_context_relevance: {e}")
            return {
                'score': 0.0,
                'matched_terms': [],
                'matches': [],
                'error': str(e)
            }

    def _categorize_domain(self, hostname: str) -> str:
        """Categorize domain type based on hostname patterns."""
        hostname = hostname.lower()
        
        categories = {
            'search': ['search', 'find', 'query'],
            'educational': ['edu', 'learn', 'course', 'study', 'academic'],
            'documentation': ['docs', 'documentation', 'reference', 'manual'],
            'productivity': ['mail', 'calendar', 'drive', 'docs', 'sheets'],
            'development': ['github', 'gitlab', 'stackoverflow', 'dev']
        }
        
        for category, patterns in categories.items():
            if any(pattern in hostname for pattern in patterns):
                return category
                
        return 'general'

    def analyze_website(self, url: str, domain: str) -> bool:
        """Analyze if a website is productive based on domain settings first, then context."""
        logger.debug(f"analyze_website - START - URL: {url}, Domain: {domain}")
        try:
            settings = self.settings["domains"][domain]
            
            # First check if URL is specifically allowed for this domain
            if self._is_allowed_platform(url, domain):
                logger.info(f"URL {url} is explicitly allowed in {domain} domain - Platform allowed")
                return {
                    'isProductive': True,
                    'explanation': 'Explicitly allowed platform'
                }

            # Get URL signals and check context relevance only once
            url_signals = self._analyze_url_components(url, skip_context=False)
            context_relevance = self._check_context_relevance(url, url_signals.get('search_query'))
            logger.debug(f"Context relevance result: {context_relevance}")
            
            # If context relevance is high enough (> 0.7), allow without AI check
            if context_relevance['score'] > 0.7:
                logger.info(f"URL allowed based on high context relevance: {context_relevance['score']}")
                return {
                    'isProductive': True,
                    'explanation': f"High relevance to current task (Score: {context_relevance['score']})"
                }
                
            # Check blocked keywords for this domain
            url_lower = url.lower()
            if "blocked_keywords" in settings:
                for keyword in settings["blocked_keywords"]:
                    if keyword.lower() in url_lower:
                        logger.info(f"Blocked keyword '{keyword}' found in URL: {url}")
                        return {
                            'isProductive': False,
                            'explanation': f"Contains blocked keyword: {keyword}"
                        }

            # Only use AI analysis for borderline cases (relevance score between 0.3 and 0.7)
            if 0.3 <= context_relevance['score'] <= 0.7:
                # ... existing AI analysis code ...
                analysis_prompt = f"""Analyze if this URL content matches the current task:

                CURRENT TASK:
                {json.dumps(self.context_data, indent=2)}

                URL Details:
                - URL: {url}
                - Search Query: {url_signals.get('search_query')}
                - Context Match Score: {context_relevance['score']}
                - Matched Terms: {context_relevance['matched_terms']}
                
                Rules:
                1. URL must be directly related to the current task
                2. Content must help complete the specific task
                3. Block if content could distract from task
                
                Respond with exactly 'ALLOW' or 'BLOCK' followed by reason.
                Format: <ALLOW|BLOCK>: <reason>"""

                response = self.client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=analysis_prompt
                )
                
                decision = response.text.strip()
                logger.info(f"AI Analysis for {url}:\n{decision}")
                
                try:
                    verdict, explanation = decision.split(':', 1)
                    verdict = verdict.strip().upper()
                    is_allowed = verdict == 'ALLOW'
                    
                    logger.info(f"URL Analysis Result - URL: {url}")
                    logger.info(f"Verdict: {verdict}")
                    logger.info(f"Explanation: {explanation.strip()}")
                    
                    return is_allowed
                    
                except Exception as e:
                    logger.error(f"Error parsing AI decision: {e}")
                    return False

        except Exception as e:
            logger.error(f"Error analyzing {url}: {e}")
            return False

def main():
    logger.info("main - START - Script execution started.")
    analyzer = ProductivityAnalyzer()
    while True:
        domain = input("Enter domain (work/school/personal): ").lower()
        if domain in analyzer.settings["domains"]:
            logger.debug(f"main - User selected valid domain: {domain}")
            break
        else:
            print("Invalid domain. Please choose from work, school, or personal.")
            logger.warning(f"main - User entered invalid domain: {domain}")

    analyzer.contextualize(domain)
    logger.info("main - Contextualization completed.")

    while True:
        url = input("Enter URL to analyze (or 'quit' to exit): ")
        if url.lower() == 'quit':
            logger.info("main - User chose to quit.")
            break

        logger.info(f"main - Analyzing URL: {url} in domain: {domain}")
        is_productive = analyzer.analyze_website(url, domain)
        print(f"Website is {'productive' if is_productive else 'not productive'} for your task.")
        logger.info(f"main - Analysis for URL: {url} - Result: {'productive' if is_productive else 'not productive'}")

    logger.info("main - END - Script execution finished.")

if __name__ == "__main__":
    main()