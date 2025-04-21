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
