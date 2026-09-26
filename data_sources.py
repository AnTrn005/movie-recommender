# data_sources.py

import os
import json
import asyncio
import aiohttp
from urllib.parse import quote
from dotenv import load_dotenv
from bs4 import BeautifulSoup

# ==============================
# CONFIG
# ==============================
load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

DATA_FILE = "data/combined_movie_data.json"
CACHE_FILE = "data/movie_cache.json"
EMBED_FILE = "data/movie_embeddings.npy"

MAX_CONCURRENT_WIKI = 5
TOTAL_MOVIES = 2000

# ==============================
# LOAD CACHE
# ==============================
try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        movie_cache = json.load(f)
except:
    movie_cache = {}

# ==============================
# UTIL
# ==============================
def get_poster_url(path):
    return f"https://image.tmdb.org/t/p/w500{path}" if path else ""

# ==============================
# TMDB FETCH
# ==============================
async def fetch_tmdb_popular():
    results = []
    pages = (TOTAL_MOVIES // 20) + 1

    async with aiohttp.ClientSession() as session:
        for page in range(1, pages + 1):
            url = f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&page={page}"
            async with session.get(url) as resp:
                data = await resp.json()
                results.extend(data.get("results", []))
                print(f"TMDb page {page}")
            await asyncio.sleep(0.5)

    return results[:TOTAL_MOVIES]

# ==============================
# WIKIPEDIA FETCH
# ==============================
async def fetch_wikipedia_plot(session, title):
    if title in movie_cache:
        return movie_cache[title]

    headers = {"User-Agent": "MovieBot/1.0"}

    try:
        # Step 1: get page ID
        url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&titles={quote(title)}"
        async with session.get(url, headers=headers) as resp:
            data = await resp.json()
            pages = data["query"]["pages"]
            page = next(iter(pages.values()))
            pageid = page.get("pageid")

            if not pageid:
                movie_cache[title] = ""
                return ""

        # Step 2: get sections
        sec_url = f"https://en.wikipedia.org/w/api.php?action=parse&pageid={pageid}&prop=sections&format=json"
        async with session.get(sec_url, headers=headers) as resp:
            data = await resp.json()
            sections = data.get("parse", {}).get("sections", [])

        # Step 3: find plot section
        plot_index = None
        for sec in sections:
            name = sec["line"].lower()
            if any(k in name for k in ["plot", "synopsis", "story", "premise"]):
                plot_index = sec["index"]
                break

        if not plot_index:
            movie_cache[title] = ""
            return ""

        # Step 4: fetch plot
        plot_url = f"https://en.wikipedia.org/w/api.php?action=parse&pageid={pageid}&prop=text&section={plot_index}&format=json"
        async with session.get(plot_url, headers=headers) as resp:
            data = await resp.json()
            html = data["parse"]["text"]["*"]

        text = BeautifulSoup(html, "html.parser").get_text().strip()

        movie_cache[title] = text
        return text

    except Exception as e:
        print(f"Wiki error {title}: {e}")
        movie_cache[title] = ""
        return ""

async def fetch_all_wiki(titles):
    connector = aiohttp.TCPConnector(limit_per_host=MAX_CONCURRENT_WIKI)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch_wikipedia_plot(session, t) for t in titles]
        return await asyncio.gather(*tasks)

# ==============================
# SAVE CACHE
# ==============================
def save_cache():
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(movie_cache, f, indent=2)