# Eclipse Shield

Eclipse Shield is an advanced AI productivity analyzer tool designed to help users stay focused on their tasks by blocking unproductive websites and providing contextual questions to understand the user's task better.

## Purpose and Functionality

Eclipse Shield aims to enhance productivity by analyzing user activity and blocking access to websites that are deemed unproductive. It also provides contextual questions to help users stay on track with their tasks.

## Installation

To install Eclipse Shield, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git
   ```
2. Navigate to the project directory:
   ```
   cd Eclipse-Shield
   ```
3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

# Instructions Creating a PLIST:
```
cp ./local.eclipseshield.runner.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.eclipseshield.runner.plist
```
When popped up grant the permissions needed to bash

## Usage

To use Eclipse Shield, follow these steps:

1. Start the Flask server:
   ```
   python app.py
   ```
2. Open your web browser and navigate to `http://localhost:5000`.
3. Follow the on-screen instructions to configure and use Eclipse Shield.

## Dependencies and Requirements

Eclipse Shield requires the following dependencies:

- Flask
- Flask-CORS
- Other dependencies listed in `requirements.txt`

## Contribution Guidelines

We welcome contributions to Eclipse Shield! To contribute, follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix:
   ```
   git checkout -b my-feature-branch
   ```
3. Make your changes and commit them:
   ```
   git commit -m "Add new feature"
   ```
4. Push your changes to your fork:
   ```
   git push origin my-feature-branch
   ```
5. Open a pull request on the main repository.

## Setting up GitHub Actions Workflow

To set up the GitHub Actions workflow for deploying the update server, follow these steps:

1. Create a new file `.github/workflows/deploy-update-server.yml` in your repository.
2. Add the following content to the file:
   ```yaml
   name: Deploy Update Server

   on:
     push:
       branches:
         - main

   jobs:
     build:
       runs-on: ubuntu-latest

       steps:
       - name: Checkout repository
         uses: actions/checkout@v2

       - name: Set up Python
         uses: actions/setup-python@v2
         with:
           python-version: '3.x'

       - name: Install dependencies
         run: |
           python -m pip install --upgrade pip
           pip install -r requirements.txt

       - name: Generate update.xml
         run: |
           python update_server.py

       - name: Deploy to GitHub Pages
         uses: peaceiris/actions-gh-pages@v3
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
           publish_dir: ./
           publish_branch: gh-pages
   ```

## Configuring GitHub Pages

To configure your repository for GitHub Pages, follow these steps:

1. Go to the settings of your repository on GitHub.
2. Scroll down to the "GitHub Pages" section.
3. Under "Source", select the `gh-pages` branch.
4. Click "Save".

## Generating and Deploying the `update.xml` File

To generate and deploy the `update.xml` file, follow these steps:

1. Create a new file `update_server.py` in your repository.
2. Add the following content to the file:
   ```python
   import xml.etree.ElementTree as ET

   def generate_update_xml(version, update_url):
       root = ET.Element("gupdate", xmlns="http://www.google.com/update2/response", protocol="2.0")
       app = ET.SubElement(root, "app", appid="your-extension-id")
       updatecheck = ET.SubElement(app, "updatecheck", codebase=update_url, version=version)

       tree = ET.ElementTree(root)
       tree.write("update.xml", encoding="utf-8", xml_declaration=True)

   if __name__ == "__main__":
       version = "1.0.0"
       update_url = "https://your-github-username.github.io/your-repo-name/extension.crx"
       generate_update_xml(version, update_url)
   ```

## Copyright

© 2025 CY83R-3X71NC710N. All rights reserved.

## Attribution

If you use any part of this code, you must provide proper attribution to CY83R-3X71NC710N.
