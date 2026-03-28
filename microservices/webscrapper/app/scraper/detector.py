from bs4 import BeautifulSoup


def is_dynamic_content(html: str) -> bool:
    """
    Detect if a page likely needs JavaScript rendering.

    Checks for common SPA patterns where the HTML body is mostly empty
    and content is loaded via JavaScript.
    """
    soup = BeautifulSoup(html, "lxml")
    body = soup.find("body")

    if not body:
        return True  # No body tag = something unusual, try dynamic

    body_text = body.get_text(strip=True)

    # SPA root indicators - body has very little text but has a JS app root
    spa_indicators = [
        body.find(id="root"),
        body.find(id="app"),
        body.find(id="__next"),
        body.find(id="__nuxt"),
    ]
    has_spa_root = any(spa_indicators)

    # Very little visible text content
    has_little_content = len(body_text) < 200

    # Lots of script tags relative to content
    scripts = soup.find_all("script")
    has_many_scripts = len(scripts) > 5

    # Framework-specific markers in script tags
    framework_markers = [
        "__NEXT_DATA__",
        "__NUXT__",
        "window.__INITIAL_STATE__",
        "React.createElement",
        "Vue.createApp",
        "ng-app",
    ]
    html_str = str(soup)
    has_framework = any(marker in html_str for marker in framework_markers)

    # noscript fallback present (suggests JS is needed)
    has_noscript = soup.find("noscript") is not None and has_little_content

    # Decision: if body is mostly empty AND has SPA indicators
    if has_little_content and (has_spa_root or has_framework):
        return True

    if has_little_content and has_many_scripts and has_noscript:
        return True

    return False
