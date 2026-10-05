/* =========================================
   MOVIE RECOMMENDER
   GITHUB PAGES INTERACTIVE DEMO

   This is a lightweight browser version.

   The full Python application uses:
   - SentenceTransformer
   - all-MiniLM-L6-v2
   - movie embeddings
   - cosine similarity
========================================= */


/* =========================================
   GLOBAL DATA
========================================= */

let movies = [];
let currentResults = [];


/* =========================================
   ELEMENTS
========================================= */

const promptInput =
    document.getElementById("prompt");

const recommendButton =
    document.getElementById("recommendButton");

const resultsContainer =
    document.getElementById("results");

const message =
    document.getElementById("message");

const resultCount =
    document.getElementById("resultCount");

const movieModal =
    document.getElementById("movieModal");

const closeModal =
    document.getElementById("closeModal");

const exampleButtons =
    document.querySelectorAll(".example-button");


/* =========================================
   STOP WORDS

   Common words are ignored because they
   don't tell us much about movie content.
========================================= */

const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "he",
    "her",
    "his",
    "i",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "movie",
    "movies",
    "of",
    "on",
    "or",
    "she",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "want",
    "watch",
    "with",
    "about",
    "something",
    "film"
]);


/* =========================================
   RELATED WORDS

   This gives the browser demo a little
   semantic understanding without requiring
   the Python ML model.
========================================= */

const RELATED_WORDS = {

    space: [
        "space",
        "spaceship",
        "planet",
        "alien",
        "astronaut",
        "galaxy",
        "earth",
        "universe",
        "star",
        "mission"
    ],

    science: [
        "science",
        "scientist",
        "technology",
        "experiment",
        "future",
        "robot",
        "space"
    ],

    scifi: [
        "science",
        "space",
        "future",
        "alien",
        "robot",
        "technology",
        "planet",
        "galaxy"
    ],

    adventure: [
        "adventure",
        "journey",
        "mission",
        "quest",
        "explore",
        "exploration",
        "world",
        "travel"
    ],

    survival: [
        "survival",
        "survive",
        "stranded",
        "escape",
        "danger",
        "fight",
        "rescue"
    ],

    romantic: [
        "romantic",
        "romance",
        "love",
        "relationship",
        "couple",
        "boyfriend",
        "girlfriend"
    ],

    romance: [
        "romance",
        "romantic",
        "love",
        "relationship",
        "couple"
    ],

    love: [
        "love",
        "romance",
        "romantic",
        "relationship",
        "couple"
    ],

    funny: [
        "funny",
        "comedy",
        "comic",
        "humor",
        "hilarious"
    ],

    comedy: [
        "comedy",
        "funny",
        "humor",
        "comic"
    ],

    scary: [
        "scary",
        "horror",
        "killer",
        "ghost",
        "monster",
        "terror"
    ],

    horror: [
        "horror",
        "killer",
        "ghost",
        "murder",
        "terror",
        "monster"
    ],

    crime: [
        "crime",
        "criminal",
        "criminals",
        "detective",
        "police",
        "thief",
        "heist",
        "gangster",
        "murder"
    ],

    detective: [
        "detective",
        "investigation",
        "crime",
        "police",
        "case",
        "murder"
    ],

    thriller: [
        "thriller",
        "danger",
        "crime",
        "murder",
        "killer",
        "survival",
        "escape"
    ],

    action: [
        "action",
        "fight",
        "battle",
        "war",
        "mission",
        "hero",
        "enemy"
    ],

    war: [
        "war",
        "battle",
        "soldier",
        "military",
        "fight",
        "army"
    ],

    family: [
        "family",
        "father",
        "mother",
        "son",
        "daughter",
        "parents",
        "children"
    ],

    animated: [
        "animated",
        "animation",
        "animal",
        "animals",
        "adventure",
        "family"
    ],

    animation: [
        "animated",
        "animation",
        "animal",
        "animals"
    ],

    animals: [
        "animals",
        "animal",
        "dog",
        "cat",
        "goat"
    ],

    friendship: [
        "friendship",
        "friend",
        "friends",
        "together"
    ],

    superhero: [
        "superhero",
        "hero",
        "power",
        "powers",
        "villain"
    ],

    mystery: [
        "mystery",
        "mysterious",
        "investigation",
        "detective",
        "secret"
    ],

    fantasy: [
        "fantasy",
        "magic",
        "magical",
        "kingdom",
        "creature",
        "world"
    ]
};


/* =========================================
   LOAD MOVIE DATA
========================================= */

async function loadMovies() {

    message.textContent =
        "Loading movie database...";

    recommendButton.disabled = true;

    try {

        const response =
            await fetch("movies.json");

        if (!response.ok) {

            throw new Error(
                "Could not load movies.json."
            );

        }

        movies =
            await response.json();


        message.textContent =
            `${movies.length.toLocaleString()} movies loaded. Describe what you want to watch.`;

    }

    catch (error) {

        console.error(error);

        message.textContent =
            "Could not load the movie database. Run this page through a local server instead of opening index.html directly.";

    }

    finally {

        recommendButton.disabled = false;

    }

}


/* =========================================
   NORMALIZE TEXT
========================================= */

function normalizeText(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/* =========================================
   TOKENIZE PROMPT
========================================= */

function tokenize(text) {

    return normalizeText(text)
        .split(" ")
        .filter(function(word) {

            return (
                word.length > 1 &&
                !STOP_WORDS.has(word)
            );

        });

}


/* =========================================
   BASIC WORD STEM

   Helps matches like:
   explore -> exploration
   survive -> survival
========================================= */

function stem(word) {

    let value = word;

    const endings = [
        "ing",
        "tion",
        "ions",
        "ed",
        "es",
        "s"
    ];

    for (const ending of endings) {

        if (
            value.endsWith(ending) &&
            value.length >
                ending.length + 3
        ) {

            value =
                value.slice(
                    0,
                    -ending.length
                );

            break;

        }

    }

    return value;

}


/* =========================================
   EXPAND QUERY

   Example:
   "space" also searches for
   planet, galaxy, astronaut, etc.
========================================= */

function expandQuery(tokens) {

    const expanded =
        new Map();


    tokens.forEach(function(token) {

        expanded.set(
            token,
            Math.max(
                expanded.get(token) || 0,
                3
            )
        );


        const tokenStem =
            stem(token);

        expanded.set(
            tokenStem,
            Math.max(
                expanded.get(tokenStem) || 0,
                2
            )
        );


        const related =
            RELATED_WORDS[token];

        if (related) {

            related.forEach(function(word) {

                expanded.set(
                    word,
                    Math.max(
                        expanded.get(word) || 0,
                        1
                    )
                );

            });

        }

    });


    return expanded;

}


/* =========================================
   SCORE MOVIE
========================================= */

function scoreMovie(movie, queryTerms) {

    const title =
        normalizeText(movie.title);

    const overview =
        normalizeText(movie.overview);

    const combined =
        `${title} ${overview}`;


    let score = 0;

    let matches = 0;


    queryTerms.forEach(
        function(weight, term) {

            if (!term) {
                return;
            }


            const termStem =
                stem(term);


            /* -----------------------------
               TITLE MATCH

               Title matches receive a
               larger weight.
            ----------------------------- */

            if (
                title.includes(term)
            ) {

                score +=
                    8 * weight;

                matches++;

            }


            /* -----------------------------
               OVERVIEW EXACT MATCH
            ----------------------------- */

            if (
                overview.includes(term)
            ) {

                score +=
                    4 * weight;

                matches++;

            }


            /* -----------------------------
               STEM MATCH
            ----------------------------- */

            if (
                termStem.length >= 4 &&
                combined.includes(termStem)
            ) {

                score +=
                    1.5 * weight;

            }

        }
    );


    /* -------------------------------------
       Reward movies matching several
       different ideas from the prompt.
    ------------------------------------- */

    if (matches >= 2) {

        score +=
            matches * 2;

    }


    /* -------------------------------------
       Tiny popularity tie-breaker.

       Popularity should never overpower
       text relevance.
    ------------------------------------- */

    const popularity =
        Number(movie.popularity || 0);

    score +=
        Math.min(
            Math.log10(popularity + 1) * 0.15,
            0.5
        );


    return score;

}


/* =========================================
   RECOMMEND MOVIES
========================================= */

function recommendMovies(prompt) {

    const tokens =
        tokenize(prompt);


    if (tokens.length === 0) {

        return [];

    }


    const queryTerms =
        expandQuery(tokens);


    const scored =
        movies.map(function(movie) {

            return {
                ...movie,

                demoScore:
                    scoreMovie(
                        movie,
                        queryTerms
                    )
            };

        });


    scored.sort(
        function(a, b) {

            if (
                b.demoScore !==
                a.demoScore
            ) {

                return (
                    b.demoScore -
                    a.demoScore
                );

            }


            return (
                Number(
                    b.popularity || 0
                ) -
                Number(
                    a.popularity || 0
                )
            );

        }
    );


    /*
       Only keep movies that actually
       matched something.
    */

    return scored
        .filter(function(movie) {

            return movie.demoScore > 1;

        })
        .slice(0, 24);

}


/* =========================================
   RECOMMEND BUTTON
========================================= */

function getRecommendations() {

    const prompt =
        promptInput.value.trim();


    if (!prompt) {

        message.textContent =
            "Please describe what you want to watch.";

        promptInput.focus();

        return;

    }


    if (movies.length === 0) {

        message.textContent =
            "Movie database is still loading.";

        return;

    }


    message.textContent =
        "Finding movies...";


    recommendButton.disabled = true;


    /*
       Small timeout allows the browser
       to update the message before doing
       the scoring work.
    */

    setTimeout(function() {

        currentResults =
            recommendMovies(prompt);


        displayMovies(
            currentResults
        );


        if (
            currentResults.length === 0
        ) {

            message.textContent =
                "No strong matches found. Try describing the genre, story, setting, or mood.";

        }

        else {

            message.textContent =
                `Found ${currentResults.length} recommendations.`;

        }


        resultCount.textContent =
            currentResults.length
                ? `${currentResults.length} results`
                : "";


        recommendButton.disabled =
            false;

    }, 50);

}


/* =========================================
   DISPLAY MOVIES
========================================= */

function displayMovies(movieList) {

    resultsContainer.innerHTML = "";


    if (movieList.length === 0) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-results";

        empty.innerHTML = `
            <h3>No recommendations found</h3>
            <p>
                Try a different description.
            </p>
        `;

        resultsContainer.appendChild(
            empty
        );

        return;

    }


    /*
       Highest score is used to turn the
       demo score into a relative match %.

       This is NOT the ML similarity score.
    */

    const highestScore =
        Math.max(
            ...movieList.map(
                movie =>
                    movie.demoScore
            )
        );


    movieList.forEach(
        function(movie) {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "movie-card";


            /* POSTER CONTAINER */

            const posterContainer =
                document.createElement(
                    "div"
                );

            posterContainer.className =
                "poster-container";


            /* POSTER */

            const poster =
                document.createElement(
                    "img"
                );

            poster.className =
                "movie-poster";

            poster.loading =
                "lazy";

            poster.alt =
                `${movie.title} poster`;


            if (movie.poster) {

                poster.src =
                    movie.poster;

            }

            else {

                poster.src =
                    createPlaceholder(
                        movie.title
                    );

            }


            poster.onerror =
                function() {

                    this.onerror = null;

                    this.src =
                        createPlaceholder(
                            movie.title
                        );

                };


            /* MATCH BADGE */

            const match =
                document.createElement(
                    "span"
                );

            match.className =
                "match-badge";


            const percent =
                Math.max(
                    1,
                    Math.round(
                        (
                            movie.demoScore /
                            highestScore
                        ) * 100
                    )
                );


            match.textContent =
                `${percent}% relative match`;


            posterContainer.appendChild(
                poster
            );

            posterContainer.appendChild(
                match
            );


            /* INFORMATION */

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "movie-card-info";


            const title =
                document.createElement(
                    "h3"
                );

            title.textContent =
                movie.title ||
                "Untitled";


            const release =
                document.createElement(
                    "p"
                );

            release.className =
                "release-date";

            release.textContent =
                getYear(
                    movie.release_date
                );


            const description =
                document.createElement(
                    "p"
                );

            description.className =
                "movie-description";

            description.textContent =
                movie.overview ||
                "No description available.";


            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "details-button";

            button.textContent =
                "View Details";


            button.addEventListener(
                "click",
                function(event) {

                    event.stopPropagation();

                    showMovieDetails(
                        movie
                    );

                }
            );


            card.addEventListener(
                "click",
                function() {

                    showMovieDetails(
                        movie
                    );

                }
            );


            info.appendChild(
                title
            );

            info.appendChild(
                release
            );

            info.appendChild(
                description
            );

            info.appendChild(
                button
            );


            card.appendChild(
                posterContainer
            );

            card.appendChild(
                info
            );


            resultsContainer.appendChild(
                card
            );

        }
    );

}


/* =========================================
   MOVIE DETAILS
========================================= */

function showMovieDetails(movie) {

    const detailPoster =
        document.getElementById(
            "detailPoster"
        );


    if (movie.poster) {

        detailPoster.src =
            movie.poster;

        detailPoster.style.display =
            "block";

    }

    else {

        detailPoster.style.display =
            "none";

    }


    document.getElementById(
        "detailTitle"
    ).textContent =
        movie.title ||
        "Untitled";


    document.getElementById(
        "detailDate"
    ).textContent =
        movie.release_date
            ? `Release: ${movie.release_date}`
            : "Release date unavailable";


    const popularity =
        Number(
            movie.popularity || 0
        );


    document.getElementById(
        "detailPopularity"
    ).textContent =
        popularity
            ? `Popularity: ${popularity.toFixed(1)}`
            : "";


    document.getElementById(
        "detailOverview"
    ).textContent =
        movie.overview ||
        "No overview available.";


    document.getElementById(
        "detailSimilarity"
    ).textContent =
        "Browser demo recommendation";


    movieModal.classList.add(
        "show"
    );


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================
   CLOSE MODAL
========================================= */

function closeMovieModal() {

    movieModal.classList.remove(
        "show"
    );

    document.body.classList.remove(
        "modal-open"
    );

}


closeModal.addEventListener(
    "click",
    closeMovieModal
);


movieModal.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            movieModal
        ) {

            closeMovieModal();

        }

    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Escape" &&
            movieModal.classList.contains(
                "show"
            )
        ) {

            closeMovieModal();

        }

    }
);


/* =========================================
   BUTTON EVENTS
========================================= */

recommendButton.addEventListener(
    "click",
    getRecommendations
);


/*
   Command + Enter on Mac
   Ctrl + Enter on Windows
*/

promptInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            (
                event.metaKey ||
                event.ctrlKey
            )
        ) {

            getRecommendations();

        }

    }
);


/* =========================================
   EXAMPLE PROMPTS
========================================= */

exampleButtons.forEach(
    function(button) {

        button.addEventListener(
            "click",
            function() {

                promptInput.value =
                    button.dataset.prompt;

                getRecommendations();

            }
        );

    }
);


/* =========================================
   HELPERS
========================================= */

function getYear(date) {

    if (!date) {

        return "Unknown year";

    }


    const year =
        String(date).substring(
            0,
            4
        );


    return year || "Unknown year";

}


/*
   Generates a poster placeholder without
   depending on another website.
*/

function createPlaceholder(title) {

    const safeTitle =
        String(title || "No Poster")
            .replace(
                /[<>&'"]/g,
                ""
            )
            .substring(
                0,
                35
            );


    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="300"
            height="450"
        >

            <rect
                width="100%"
                height="100%"
                fill="#292929"
            />

            <text
                x="50%"
                y="50%"
                fill="#888888"
                font-size="18"
                font-family="Arial"
                text-anchor="middle"
                dominant-baseline="middle"
            >
                ${safeTitle}
            </text>

        </svg>
    `;


    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );

}


/* =========================================
   START
========================================= */

loadMovies();