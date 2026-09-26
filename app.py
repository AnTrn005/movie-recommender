import os
import requests

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

from recommender import recommend


# -----------------------------------------------------
# Configuration
# -----------------------------------------------------

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")

app = Flask(__name__)

CORS(app)


# -----------------------------------------------------
# Home page
# -----------------------------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# -----------------------------------------------------
# Movie recommendations
# -----------------------------------------------------

@app.route("/recommend", methods=["POST"])
def recommend_api():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "No data received."
        }), 400

    prompt = data.get(
        "prompt",
        ""
    ).strip()

    if not prompt:
        return jsonify({
            "error": "Please enter a movie description."
        }), 400

    # Get up to 60 movies
    results = recommend(
        prompt,
        top_k=60
    )

    return jsonify(results)


# -----------------------------------------------------
# Movie details
# -----------------------------------------------------

@app.route("/movie/<int:movie_id>")
def movie_details(movie_id):

    if not TMDB_API_KEY:
        return jsonify({
            "error": "TMDB API key is missing."
        }), 500

    # -------------------------------------------------
    # Movie information
    # -------------------------------------------------

    movie_url = (
        f"https://api.themoviedb.org/3/movie/"
        f"{movie_id}"
        f"?api_key={TMDB_API_KEY}"
    )

    # -------------------------------------------------
    # Actors
    # -------------------------------------------------

    credits_url = (
        f"https://api.themoviedb.org/3/movie/"
        f"{movie_id}/credits"
        f"?api_key={TMDB_API_KEY}"
    )

    try:

        movie_response = requests.get(
            movie_url,
            timeout=10
        )

        credits_response = requests.get(
            credits_url,
            timeout=10
        )

    except requests.RequestException:

        return jsonify({
            "error": "Could not connect to TMDB."
        }), 500


    # -------------------------------------------------
    # Check response
    # -------------------------------------------------

    if movie_response.status_code != 200:

        return jsonify({
            "error": "Movie information could not be found."
        }), 404


    movie = movie_response.json()


    # Extra safety check
    if movie.get("adult", False):

        return jsonify({
            "error": "This movie is not available."
        }), 403


    # -------------------------------------------------
    # Credits
    # -------------------------------------------------

    if credits_response.status_code == 200:

        credits = credits_response.json()

    else:

        credits = {}


    # -------------------------------------------------
    # Actors
    # -------------------------------------------------

    actors = []

    for actor in credits.get("cast", [])[:10]:

        profile_path = actor.get(
            "profile_path"
        )

        if profile_path:

            profile = (
                "https://image.tmdb.org/t/p/w185"
                + profile_path
            )

        else:

            profile = None


        actors.append({

            "name": actor.get(
                "name",
                ""
            ),

            "character": actor.get(
                "character",
                ""
            ),

            "profile": profile
        })


    # -------------------------------------------------
    # Genres
    # -------------------------------------------------

    genres = []

    for genre in movie.get(
        "genres",
        []
    ):

        genres.append(
            genre.get(
                "name",
                ""
            )
        )


    # -------------------------------------------------
    # Poster
    # -------------------------------------------------

    poster_path = movie.get(
        "poster_path"
    )

    if poster_path:

        poster = (
            "https://image.tmdb.org/t/p/w500"
            + poster_path
        )

    else:

        poster = None


    # -------------------------------------------------
    # Backdrop
    # -------------------------------------------------

    backdrop_path = movie.get(
        "backdrop_path"
    )

    if backdrop_path:

        backdrop = (
            "https://image.tmdb.org/t/p/original"
            + backdrop_path
        )

    else:

        backdrop = None


    # -------------------------------------------------
    # Return movie details
    # -------------------------------------------------

    details = {

        "id": movie.get(
            "id"
        ),

        "title": movie.get(
            "title",
            ""
        ),

        "tagline": movie.get(
            "tagline",
            ""
        ),

        "overview": movie.get(
            "overview",
            ""
        ),

        "release_date": movie.get(
            "release_date",
            ""
        ),

        "rating": movie.get(
            "vote_average",
            0
        ),

        "vote_count": movie.get(
            "vote_count",
            0
        ),

        "runtime": movie.get(
            "runtime",
            0
        ),

        "genres": genres,

        "poster": poster,

        "backdrop": backdrop,

        "actors": actors
    }

    return jsonify(details)


# -----------------------------------------------------
# Start Flask
# -----------------------------------------------------

if __name__ == "__main__":

    app.run(
        debug=True
    )