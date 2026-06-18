import os
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Atom Namespace
NAMESPACE = {'atom': 'http://www.w3.org/2005/Atom'}

def fetch_and_parse_feed():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        entries = []
        
        for entry in root.findall('atom:entry', NAMESPACE):
            title_node = entry.find('atom:title', NAMESPACE)
            updated_node = entry.find('atom:updated', NAMESPACE) or entry.find('atom:published', NAMESPACE)
            content_node = entry.find('atom:content', NAMESPACE) or entry.find('atom:summary', NAMESPACE)
            link_node = entry.find('atom:link', NAMESPACE)
            id_node = entry.find('atom:id', NAMESPACE)
            
            title = title_node.text if title_node is not None else "No Title"
            updated = updated_node.text if updated_node is not None else ""
            content = content_node.text if content_node is not None else ""
            link = link_node.attrib.get('href', '') if link_node is not None else ""
            entry_id = id_node.text if id_node is not None else ""
            
            # Format update date if possible (e.g. 2026-06-18T... -> June 18, 2026)
            # We can also do this on client-side
            
            entries.append({
                'id': entry_id,
                'title': title,
                'updated': updated,
                'content': content,
                'link': link
            })
            
        return {'status': 'success', 'data': entries}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes():
    result = fetch_and_parse_feed()
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
