import json
import numpy as np
from sentence_transformers import SentenceTransformer


DATA_FILE = "combined_movie_data.json"
EMBED_FILE = "embeddings.npy"

# Ratings we do not want to recommend
BLOCKED_RATINGS = {
    "R",
    "NC-17",
    "X",
    "TV-MA"
}


# -----------------------------------------------------
# Load model once
# -----------------------------------------------------

print("Loading recommendation model...")

model = SentenceTransformer("all-MiniLM-L6-v2")


# -----------------------------------------------------
# Load movie data
# -----------------------------------------------------

with open(DATA_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)


# -----------------------------------------------------
# Load embeddings
# -----------------------------------------------------

embeddings = np.load(EMBED_FILE)

print(f"Loaded {len(data)} movies.")


# -----------------------------------------------------
# Check if movie is allowed
# -----------------------------------------------------

def is_movie_allowed(movie):

    # Remove anything TMDB marked as adult
    if movie.get("adult", False):
        return False

    certification = (
        movie.get("certification", "")
        .strip()
        .upper()
    )

    # Remove mature ratings
    if certification in BLOCKED_RATINGS:
        return False

    return True


# -----------------------------------------------------
# Recommendation function
# -----------------------------------------------------

def recommend(prompt, top_k=60):
    """
    Recommend up to 60 movies based on the user's description.
    Movies with similarity <= 0 are not returned.
    """

    prompt = prompt.strip()

    if not prompt:
        return []

    # Convert user prompt into an embedding
    user_vec = model.encode(
        [prompt],
        normalize_embeddings=True
    )[0]

    # Cosine similarity
    similarities = embeddings @ user_vec

    # Highest similarity first
    ranked_indices = np.argsort(similarities)[::-1]

    results = []

    for idx in ranked_indices:

        similarity = float(similarities[idx])

        # Do not return movies with 0 or negative similarity
        if similarity <= 0.1:
            continue

        movie = data[idx]

        # Skip mature/adult movies
        if not is_movie_allowed(movie):
            continue

        results.append({
            "id": movie.get("id"),
            "title": movie.get("title", ""),
            "release": movie.get("release_date", ""),
            "poster": movie.get("poster", ""),
            "plot": movie.get("overview", ""),
            "popularity": movie.get("popularity", 0),
            "certification": movie.get("certification", ""),
            "similarity": round(similarity, 4)
        })

        # Maximum of 60 recommendations
        if len(results) >= top_k:
            break

    return results