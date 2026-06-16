from flask import Flask, render_template, jsonify, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache to prevent excessive external requests
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SECS = 300 # 5 minutes

def parse_release_notes(xml_content):
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        # Fallback in case of parse errors
        return []

    parsed_updates = []
    for entry in root.findall('atom:entry', namespaces):
        date_title = entry.find('atom:title', namespaces)
        date_title = date_title.text.strip() if date_title is not None else "Unknown Date"
        
        updated = entry.find('atom:updated', namespaces)
        updated_time = updated.text.strip() if updated is not None else ""
        
        content_elem = entry.find('atom:content', namespaces)
        content_html = content_elem.text if content_elem is not None else ""
        
        link_elem = entry.find('atom:link', namespaces)
        link = link_elem.attrib.get('href') if link_elem is not None else "https://cloud.google.com/bigquery/docs/release-notes"

        soup = BeautifulSoup(content_html, 'html.parser')
        h3_tags = soup.find_all('h3')

        if not h3_tags:
            # If there are no H3 elements, capture the whole content as one update
            text_content = soup.get_text().strip()
            parsed_updates.append({
                'id': f"{updated_time}-0",
                'date': date_title,
                'type': 'Update',
                'content': str(soup),
                'text_content': text_content,
                'link': link
            })
        else:
            for idx, h3 in enumerate(h3_tags):
                item_type = h3.get_text().strip()
                item_html_parts = []
                
                sibling = h3.next_sibling
                while sibling and sibling.name != 'h3':
                    item_html_parts.append(str(sibling))
                    sibling = sibling.next_sibling
                    
                item_html = "".join(item_html_parts).strip()
                item_soup = BeautifulSoup(item_html, 'html.parser')
                text_content = item_soup.get_text().strip()
                
                # Create a unique ID for frontend tracking
                unique_id = f"{updated_time}-{idx}"
                
                parsed_updates.append({
                    'id': unique_id,
                    'date': date_title,
                    'type': item_type,
                    'content': item_html,
                    'text_content': text_content,
                    'link': link
                })
                
    return parsed_updates

def fetch_feed(force=False):
    current_time = time.time()
    
    # Return cache if valid and not forced
    if not force and cache["data"] is not None and (current_time - cache["last_fetched"]) < CACHE_DURATION_SECS:
        return cache["data"], "cached"
        
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        parsed_data = parse_release_notes(response.content)
        
        cache["data"] = parsed_data
        cache["last_fetched"] = current_time
        return parsed_data, "fetched"
    except Exception as e:
        # If fetch fails but we have cached data, fallback to cache
        if cache["data"] is not None:
            return cache["data"], "fallback"
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def api_releases():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    try:
        data, status = fetch_feed(force=force_refresh)
        return jsonify({
            "success": True,
            "status": status,
            "count": len(data),
            "releases": data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
