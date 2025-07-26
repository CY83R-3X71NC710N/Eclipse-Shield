# Contributing to Eclipse Shield

Thank you for your interest in contributing to Eclipse Shield! This guide will help you get started.

## 🚀 Getting Started

### Fork and Clone
1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Eclipse-Shield.git
   cd Eclipse-Shield
   ```

### Set Up Development Environment
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Add your API key to .env file
```

### Test the Setup
```bash
# Run security tests
python3 security_test.py http://localhost:5000

# Start the application
python3 secure_app.py
```

## 📝 Making Changes

### Create a Branch
```bash
git checkout -b your-feature-name
```

### Code Guidelines
- Follow Python PEP 8 style
- Add comments for complex logic
- Test your changes
- Keep security in mind

### Commit Your Changes
```bash
git add .
git commit -m "Brief description of your changes"
git push origin your-feature-name
```

## 🐛 Reporting Issues

### Bug Reports
Please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Python version, browser)

### Security Issues
For security vulnerabilities:
- Use the Security Report issue template
- For critical issues, contact through secure channels
- Do not post sensitive details publicly

## � Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Pull Request Guidelines
- Use descriptive titles
- Explain what your changes do
- Reference any related issues
- Include screenshots if relevant

## 🧪 Testing

### Run Tests
```bash
# Security tests
python3 security_test.py http://localhost:5000

# Test specific endpoints
curl -X POST http://localhost:5000/analyze -d '{"url":"https://example.com"}'
```

### Test Checklist
- [ ] Core functionality works
- [ ] Security features intact
- [ ] No new vulnerabilities introduced
- [ ] Browser extension compatibility

## 📚 Documentation

Help improve documentation:
- Fix typos and unclear explanations
- Add examples and use cases
- Update setup instructions
- Improve API documentation

## 💬 Community

### Getting Help
- Check existing issues for similar problems
- Use GitHub Discussions for questions
- Search documentation first

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment

## 🔄 Development Workflow

### Typical Workflow
1. Pick an issue or propose a feature
2. Discuss approach if it's a major change
3. Implement and test your solution
4. Submit pull request
5. Address review feedback
6. Merge after approval

### Types of Contributions
- **Bug fixes**: Fix reported issues
- **Features**: Add new functionality
- **Security**: Improve security measures
- **Documentation**: Enhance guides and docs
- **Testing**: Add tests and improve coverage

## 🎯 Project Goals

Eclipse Shield aims to be:
- **Secure**: Enterprise-grade security implementation
- **Reliable**: Stable and performant
- **User-friendly**: Easy to deploy and use
- **Well-documented**: Clear guides and examples

Thank you for contributing to Eclipse Shield! 🚀
echo "your-test-api-key" > api_key.txt

# Install pre-commit hooks (if available)
pre-commit install
```

#### Run Tests
```bash
# Run security tests
python3 security_test.py http://localhost:5000

# Run unit tests (if available)
python3 -m pytest tests/

# Run the application locally
python3 secure_app.py
```

### 3. Create a Branch

Create a descriptive branch name:
```bash
git checkout -b feature/add-new-security-feature
git checkout -b bugfix/fix-rate-limiting-issue
git checkout -b security/improve-input-validation
```

## 📋 Development Guidelines

### Code Style

#### Python Style Guide
- Follow [PEP 8](https://pep8.org/) style guidelines
- Use meaningful variable and function names
- Add docstrings to all functions and classes
- Maximum line length: 88 characters (Black formatter standard)

```python
# Good example
def validate_user_input(url: str, context: str) -> bool:
    """
    Validate user input for URL analysis.
    
    Args:
        url: The URL to validate
        context: The user context (work, research, etc.)
        
    Returns:
        bool: True if input is valid, False otherwise
        
    Raises:
        ValueError: If input format is invalid
    """
    if not InputValidator.validate_url(url):
        return False
    return InputValidator.validate_context(context)
```

#### Security Coding Practices
- **Always validate input**: Use the InputValidator class for all user inputs
- **Sanitize outputs**: Escape data before logging or displaying
- **Use parameterized queries**: Never concatenate SQL/NoSQL queries
- **Secure defaults**: Fail securely when in doubt
- **Least privilege**: Only request necessary permissions

```python
# Security-focused example
def analyze_url_securely(url: str, user_context: str) -> Dict:
    """Securely analyze URL with comprehensive validation."""
    
    # Input validation
    sanitized_url = InputValidator.sanitize_url(url)
    if not InputValidator.validate_url(sanitized_url):
        logger.warning("Invalid URL attempted", extra={
            'ip': request.remote_addr,
            'url_length': len(url)  # Log length, not actual URL
        })
        raise ValueError("Invalid URL format")
    
    # Context validation
    validated_context = InputValidator.validate_context(user_context)
    
    # Rate limiting check
    if not rate_limiter.check_rate_limit(request.remote_addr):
        logger.warning("Rate limit exceeded", extra={
            'ip': request.remote_addr
        })
        raise RateLimitExceeded()
    
    # Proceed with analysis...
```

### Security Considerations

#### Input Validation
- Use the existing `InputValidator` class
- Validate all inputs at the boundary
- Sanitize data before processing
- Set reasonable limits on input sizes

#### Error Handling
- Don't expose internal details in error messages
- Log security events appropriately
- Use structured logging for security analysis

#### Testing Security Features
```python
# Example security test
def test_sql_injection_prevention():
    """Test that SQL injection attempts are blocked."""
    malicious_inputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET admin=1; --"
    ]
    
    for malicious_input in malicious_inputs:
        with pytest.raises(ValueError):
            InputValidator.validate_url(malicious_input)
```

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Clear title**: Descriptive summary of the issue
2. **Environment details**: OS, Python version, browser
3. **Steps to reproduce**: Detailed steps to trigger the bug
4. **Expected behavior**: What should happen
5. **Actual behavior**: What actually happens
6. **Logs**: Relevant log entries (sanitize sensitive data)

#### Bug Report Template
```markdown
## Bug Description
Brief description of the bug

## Environment
- OS: macOS 12.0
- Python: 3.9.7
- Browser: Chrome 96.0
- Eclipse Shield Version: 1.0.0

## Steps to Reproduce
1. Start Eclipse Shield with `./start.sh`
2. Navigate to blocked website
3. Extension shows incorrect message

## Expected Behavior
Extension should display block page with context question

## Actual Behavior
Extension shows generic error message

## Logs
```
[2025-07-25 10:30:00] ERROR - Extension communication failed
```

## Additional Context
Any other relevant information
```

### Security Issues

**⚠️ SECURITY VULNERABILITY REPORTING**

If you discover a security vulnerability, please **DO NOT** open a public issue.

Instead:
1. Use the Security Report issue template for non-critical issues
2. For critical vulnerabilities, contact through secure channels
3. Include "Eclipse Shield Security" in communications
4. Provide detailed information about the vulnerability
5. Allow reasonable time for response

We follow responsible disclosure and will:
- Acknowledge receipt promptly
- Provide updates on fix progress
- Credit you in security advisories (if desired)
- Coordinate public disclosure timing

## ✨ Feature Requests

### Before Submitting

1. **Check existing issues**: Search for similar requests
2. **Review roadmap**: Check if it's already planned
3. **Consider scope**: Ensure it fits Eclipse Shield's mission

### Feature Request Template

```markdown
## Feature Summary
One-sentence description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
Detailed description of the proposed feature

## Security Considerations
How does this impact security?

## Implementation Ideas
Technical implementation suggestions (optional)

## Alternatives Considered
Other solutions you've considered
```

## 💻 Code Contributions

### Pull Request Process

#### 1. Before Coding
- Discuss large changes in an issue first
- Ensure tests pass on your development environment
- Review existing code style and patterns

#### 2. Making Changes
- Write clear, self-documenting code
- Add tests for new functionality
- Update documentation as needed
- Follow security best practices

#### 3. Testing Your Changes
```bash
# Run all tests
python3 security_test.py http://localhost:5000

# Test specific security features
python3 -c "from security import InputValidator; print('Tests passed')"

# Manual testing
./start.sh
# Test the functionality manually
./stop.sh
```

#### 4. Submitting Pull Request
- Create a clear title and description
- Reference related issues
- Include test results
- Request security review for security-related changes

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Security improvement
- [ ] Documentation update

## Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed
- [ ] Security implications reviewed

## Security Checklist
- [ ] Input validation implemented
- [ ] No sensitive data in logs
- [ ] Error handling doesn't expose internals
- [ ] Rate limiting considered
- [ ] OWASP guidelines followed

## Related Issues
Fixes #123

## Screenshots (if applicable)
[Add screenshots here]
```

## 🧪 Testing Guidelines

### Test Categories

#### 1. Security Tests
```python
def test_xss_prevention():
    """Test XSS attack prevention."""
    xss_payloads = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src=x onerror=alert('xss')>"
    ]
    
    for payload in xss_payloads:
        sanitized = InputValidator.sanitize_string(payload)
        assert "<script>" not in sanitized
        assert "javascript:" not in sanitized
```

#### 2. Functionality Tests
```python
def test_url_analysis():
    """Test URL analysis functionality."""
    analyzer = ProductivityAnalyzer()
    
    result = analyzer.analyze_url(
        "https://github.com", 
        "work"
    )
    
    assert result['allowed'] is True
    assert 'reason' in result
    assert 'confidence' in result
```

#### 3. Integration Tests
```python
def test_api_endpoint():
    """Test API endpoint functionality."""
    response = client.post('/analyze', json={
        'url': 'https://example.com',
        'context': 'work'
    }, headers={'X-API-Key': 'test-key'})
    
    assert response.status_code == 200
    assert 'allowed' in response.json
```

### Running Tests

```bash
# Security tests (required)
python3 security_test.py http://localhost:5000

# Unit tests
python3 -m pytest tests/ -v

# Coverage report
python3 -m pytest --cov=. tests/

# Specific test categories
python3 -m pytest tests/test_security.py -v
python3 -m pytest tests/test_api.py -v
```

## 📚 Documentation

### Documentation Standards

- Use clear, simple language
- Include code examples
- Keep security implications in mind
- Update related documentation when making changes

### Types of Documentation

1. **Code Documentation**: Inline comments and docstrings
2. **API Documentation**: Endpoint descriptions and examples  
3. **User Guides**: How-to guides for end users
4. **Developer Guides**: Technical implementation details

## 🏆 Recognition

Contributors will be recognized in:
- Project README
- Release notes
- Security advisories (for security contributions)
- Annual contributor list

## 📞 Getting Help

- **General Questions**: Open a discussion on GitHub
- **Development Help**: Join our Discord/Slack (if available)
- **Security Questions**: Use Security Report template
- **Bug Reports**: Use GitHub issues

## 📄 License

By contributing to Eclipse Shield, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Eclipse Shield! Your help makes this project more secure and useful for everyone. 🛡️
