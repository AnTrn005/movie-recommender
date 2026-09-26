import os
import json
import time
import asyncio
import aiohttp
import numpy as np
from urllib.parse import quote
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

CACHE_FILE = "movie_data_cache.json"
DATA_FILE = "combined_movie_data.json"
EMBED_FILE = "embeddings.npy"

MAX_CONCURRENT_WIKI = 5
TOTAL_MOVIES = 2000

try:
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        movie_cache = json.load(f)
except FileNotFoundError:
    movie_cache = {}

def get_poster_url(path):
    return f"https://image.tmdb.org/t/p/w500{path}" if path else ""


async def fetch_tmdb_popular(session, total_items=TOTAL_MOVIES):
    results = []
    total_pages = (total_items // 20) + 1

    for page in range(1, total_pages + 1):
        url = f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&page={page}"
        async with session.get(url) as resp:
            data = await resp.json()
            results.extend(data.get("results", []))
            print(f"TMDb page {page}")
        await asyncio.sleep(0.5)

    return results[:total_items]


async def fetch_wikipedia_plot(session, title):
    if title in movie_cache:
        return movie_cache[title]

    headers = {"User-Agent": "MovieBot/1.0"}

    try:
        page_url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&titles={quote(title)}"
        async with session.get(page_url, headers=headers) as resp:
            data = await resp.json()
            pages = data.get("query", {}).get("pages", {})
            page = next(iter(pages.values()))
            pageid = page.get("pageid")

            if not pageid:
                movie_cache[title] = ""
                return ""

        sections_url = f"https://en.wikipedia.org/w/api.php?action=parse&pageid={pageid}&prop=sections&format=json"
        async with session.get(sections_url, headers=headers) as resp:
            data = await resp.json()
            sections = data.get("parse", {}).get("sections", [])

        plot_index = None
        for sec in sections:
            name = sec.get("line", "").lower()
            if any(k in name for k in ["plot", "synopsis", "story", "premise"]):
                plot_index = sec.get("index")
                break

        if not plot_index:
            movie_cache[title] = ""
            return ""

        section_url = f"https://en.wikipedia.org/w/api.php?action=parse&pageid={pageid}&prop=text&section={plot_index}&format=json"
        async with session.get(section_url, headers=headers) as resp:
            data = await resp.json()
            html = data.get("parse", {}).get("text", {}).get("*", "")

        plot_text = BeautifulSoup(html, "html.parser").get_text().strip()
        movie_cache[title] = plot_text
        return plot_text

    except Exception as e:
        print(f"Wiki error {title}: {e}")
        movie_cache[title] = ""
        return ""

async def fetch_all_wikipedia_plots(titles):
    connector = aiohttp.TCPConnector(limit_per_host=MAX_CONCURRENT_WIKI)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [fetch_wikipedia_plot(session, t) for t in titles]
        return await asyncio.gather(*tasks)

async def build_dataset():
    async with aiohttp.ClientSession() as session:
        movies = await fetch_tmdb_popular(session)

    titles = [m["title"] for m in movies]

    print("Fetching Wikipedia plots...")
    plots = await fetch_all_wikipedia_plots(titles)

    combined = []
    for m, plot in zip(movies, plots):
        if m.get("adult", False):
            continue
        combined.append({
            "id": m["id"],
            "title": m["title"],
            "release_date": m.get("release_date", ""),
            "popularity": m.get("popularity", 0),
            "overview": m.get("overview", ""),
            "plot": plot,
            "poster": get_poster_url(m.get("poster_path"))
        })

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(movie_cache, f, indent=2)

    print("Dataset built.")


def build_embeddings():

    print("Loading embedding model...")

    model = SentenceTransformer("all-MiniLM-L6-v2")

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    texts = []

    for movie in data:

        title = movie.get("title", "")
        overview = movie.get("overview", "")

        # Do NOT use Wikipedia plot.
        # Some Wikipedia results are incorrect.

        text = f"""
Movie title: {title}

Movie description:
{overview}
""".strip()

        texts.append(text)

    print(f"Building embeddings for {len(texts)} movies...")

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
        batch_size=32
    )

    np.save(EMBED_FILE, embeddings)

    print(f"Saved {len(embeddings)} embeddings to {EMBED_FILE}")

def recommend(prompt, top_k=20):
    model = SentenceTransformer('all-MiniLM-L6-v2')

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    embeddings = np.load(EMBED_FILE)
    user_vec = model.encode([prompt])
    sims = cosine_similarity(user_vec, embeddings)[0]
    ranked = sorted(
        enumerate(sims),
        key=lambda x: x[1], 
        reverse=True
    )

    print("\nTop Recommendations:\n")

    for i, (idx, score) in enumerate(ranked[:top_k], 1):
        m = data[idx]
        print(f"{i}. {m['title']}")
        print(f"Release: {m['release_date']}")
        print(f"Similarity Score: {score:.3f}")
        print(f"Poster: {m['poster']}")
        print(f"Plot: {(m['plot'] or m['overview'])[:250]}...\n")


def main():
    while True:
        print("\n1. Build dataset")
        print("2. Build embeddings")
        print("3. Recommend movies")
        print("4. Exit")

        choice = input("Choose: ")

        if choice == "1":
            asyncio.run(build_dataset())

        elif choice == "2":
            build_embeddings()

        elif choice == "3":
            prompt = input("\nEnter a movie description:\n")
            recommend(prompt)

        elif choice == "4":
            break

if __name__ == "__main__":
    main()