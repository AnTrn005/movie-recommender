async function search() {
    const prompt = document.getElementById("prompt").value;

    const res = await fetch("/recommend", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
    });

    const movies = await res.json();
    const container = document.getElementById("results");

    container.innerHTML = "";

    movies.forEach(movie => {
        const div = document.createElement("div");
        div.className = "movie";

        div.innerHTML = `
            <img src="${movie.poster}" />
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p>${movie.plot}</p>
            </div>
        `;

        container.appendChild(div);
    });
}