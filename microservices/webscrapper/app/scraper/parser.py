from bs4 import BeautifulSoup
from app.api.schemas import ScrapedData


def parse_html(html: str, url: str, mode_used: str) -> ScrapedData:
    """Parse HTML into structured data."""
    soup = BeautifulSoup(html, "lxml")

    # Title
    title = soup.title.string.strip() if soup.title and soup.title.string else None

    # Meta description
    meta_tag = soup.find("meta", attrs={"name": "description"})
    meta_description = meta_tag["content"].strip() if meta_tag and meta_tag.get("content") else None

    # Headings (h1 through h6)
    headings = {}
    for level in range(1, 7):
        tag = f"h{level}"
        found = soup.find_all(tag)
        if found:
            headings[tag] = [h.get_text(strip=True) for h in found]

    # Links
    links = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = a["href"]
        if href and not href.startswith(("#", "javascript:")):
            links.append({"text": text, "href": href})

    # Images
    images = []
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if src:
            images.append({"alt": alt, "src": src})

    # Text content (visible text only)
    # Remove script and style elements
    for element in soup(["script", "style", "noscript", "header", "footer", "nav"]):
        element.decompose()
    text_content = soup.get_text(separator="\n", strip=True)
    # Clean up excessive newlines
    lines = [line.strip() for line in text_content.splitlines() if line.strip()]
    text_content = "\n".join(lines)

    # Tables
    tables = []
    for table in soup.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            cells = [
                td.get_text(strip=True)
                for td in tr.find_all(["td", "th"])
            ]
            if cells:
                rows.append(cells)
        if rows:
            tables.append(rows)

    return ScrapedData(
        url=url,
        title=title,
        meta_description=meta_description,
        headings=headings,
        links=links,
        images=images,
        text_content=text_content,
        tables=tables,
        mode_used=mode_used,
    )
