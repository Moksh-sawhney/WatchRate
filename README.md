# WatchRate

**Movie Rating and Watch Time Check with Review System**

A small web application built with Node.js and Express. It stores everything in memory (data resets when the server restarts), serves a simple HTML/CSS/JS frontend from the same server, and exposes a REST API that is tested with Postman and Newman.

## Features

- **Movies**: create, read all, read one, update, delete (title, genre, year, duration in minutes).
- **Ratings**: 1 to 5 per movie, with the average calculated.
- **Reviews**: add, edit and delete a review (reviewer, comment, rating).
- **Watch time**: log minutes per user per movie, with total minutes and completion percentage.
- **Validation**: `400` bad input, `404` missing movie/review, `201` created.

## Project structure

```
WatchRate/
├── server.js                                   Express API + static file server
├── package.json                                Project info, dependencies, npm scripts
├── public/
│   └── index.html                              Frontend (HTML + CSS + JS in one file)
├── WatchRate_API_Suite.postman_collection.json Postman collection (v2.1)
├── WatchRate_Local.postman_environment.json    Postman environment (baseUrl)
├── testdata.json                               Data file for data-driven runs
└── README.md
```

## Run it in VS Code

1. Install **Node.js (LTS)** from https://nodejs.org and check it: open a terminal and run `node -v`.
2. In VS Code choose **File > Open Folder...** and select the `WatchRate` folder.
3. Open the terminal: **Terminal > New Terminal** (shortcut `` Ctrl+` ``).
4. Install dependencies (first time only). If a `node_modules` folder is already present in the download, delete it first, then run:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm start
   ```
   You should see `WatchRate running at http://localhost:3000`.
6. Open http://localhost:3000 in your browser to use the frontend. The API lives under http://localhost:3000/api.
7. Stop the server with `Ctrl+C`. Restarting clears all data.

## Import into Postman

1. Open Postman and click **Import**.
2. Drag in (or browse to) both files:
   - `WatchRate_API_Suite.postman_collection.json`
   - `WatchRate_Local.postman_environment.json`
3. In the top-right environment dropdown, select **WatchRate Local** (`baseUrl = http://localhost:3000`).
4. Make sure the server is running (`npm start`).
5. Right-click the collection **WatchRate API Suite** > **Run collection** > **Run**. The folders run in order: Movies CRUD, Ratings, Reviews, Watch Time, Negative Tests, Cleanup, Data Driven Tests.

The collection chains requests with collection variables: **Create Movie** saves `movieId`, **Add Review** saves `reviewId`, and every later request uses `{{movieId}}` / `{{reviewId}}`.

### Data-driven run in Postman

In the Collection Runner pick the folder **Data Driven Tests**, click **Select File** under *Data*, choose `testdata.json`, and run. There are 9 iterations (3 valid, 6 invalid). Each row has an `expectedStatus` that the test script checks.

## Run with Newman (command line)

Newman and the htmlextra reporter are already listed in `package.json`, so `npm install` installs them. With the server running in one terminal, open a **second** terminal and run:

```bash
# Full suite, HTML report
npx newman run WatchRate_API_Suite.postman_collection.json -e WatchRate_Local.postman_environment.json -r htmlextra --reporter-htmlextra-export reports/WatchRate-report.html

# Data-driven run (only the Data Driven Tests folder)
npx newman run WatchRate_API_Suite.postman_collection.json -e WatchRate_Local.postman_environment.json -d testdata.json --folder "Data Driven Tests" -r htmlextra --reporter-htmlextra-export reports/WatchRate-data-report.html
```

Open `reports/WatchRate-report.html` in a browser to see the report. Shortcuts: `npm run test:api`, `npm run test:data`, `npm run report`.

> Restart the server before a new run if you want a perfectly clean state. The suite also deletes the data it creates.

## API reference

| Method | Endpoint | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/movies` | `title, genre, year, duration` | 201 | 400 |
| GET | `/api/movies` | | 200 | |
| GET | `/api/movies/:id` | | 200 | 404 |
| PUT | `/api/movies/:id` | `title, genre, year, duration` | 200 | 400, 404 |
| DELETE | `/api/movies/:id` | | 200 | 404 |
| POST | `/api/movies/:id/ratings` | `rating (1-5), user (optional)` | 201 | 400, 404 |
| GET | `/api/movies/:id/ratings` | | 200 (`averageRating`, `ratingCount`) | 404 |
| POST | `/api/movies/:id/reviews` | `reviewer, comment, rating` | 201 | 400, 404 |
| GET | `/api/movies/:id/reviews` | | 200 | 404 |
| PUT | `/api/movies/:id/reviews/:reviewId` | `reviewer, comment, rating` | 200 | 400, 404 |
| DELETE | `/api/movies/:id/reviews/:reviewId` | | 200 | 404 |
| POST | `/api/movies/:id/watch` | `user, minutes (1-1440)` | 201 | 400, 404 |
| GET | `/api/movies/:id/watch` | | 200 (total, viewers, completion) | 404 |
| GET | `/api/movies/:id/watch/:user` | | 200 | 404 |

Validation rules: title and genre are non-empty strings; year is an integer from 1888 to current year + 5; duration is an integer from 1 to 1000; ratings are integers 1 to 5. Error responses look like `{ "error": "Validation failed", "details": ["..."] }`.

## What each file does (viva notes)

**server.js** is the whole backend. It creates the Express app, enables `express.json()` to read JSON bodies, and serves the `public` folder as static files. Data lives in four JavaScript arrays (movies, ratings, reviews, watchLogs), which is the "in-memory storage". `app.param('movieId')` runs for every route containing `:movieId` and returns 404 if the movie does not exist, so that check is written once. Validation functions return a list of problems, and the route replies `400` if the list is not empty. Helper functions compute the average rating and the watch totals. A final error handler turns malformed JSON into a `400`. Deleting a movie also deletes its ratings, reviews and watch logs (cascade).

**package.json** names the project `watchrate`, lists `express` as the dependency and `newman` plus `newman-reporter-htmlextra` as dev dependencies, and defines the `npm start`, `test:api`, `test:data` and `report` scripts.

**public/index.html** is the frontend. It holds the HTML, CSS and JavaScript in one file and talks to the API with `fetch`. It lists movies as ticket-style cards, lets you add, edit and delete movies, and shows the selected movie's rating buttons, review form and list, and watch-time log with progress bars. Server error messages are shown in a toast.

**WatchRate_API_Suite.postman_collection.json** is the automated test suite. Every request has test scripts (`pm.test`) that check status codes and response bodies. Chaining works through collection variables (`movieId`, `reviewId`) set with `pm.collectionVariables.set`. It includes negative tests (400 and 404 cases) and a data-driven folder. A collection-level script checks every response is JSON and under 1000 ms.

**WatchRate_Local.postman_environment.json** stores `baseUrl = http://localhost:3000`, so the same collection can point at another server by changing one value.

**testdata.json** is an array of 9 rows (title, genre, year, duration, expectedStatus). Newman or the Collection Runner runs the "Create Movie (data-driven)" request once per row, which is what "data-driven testing" means.

**README.md** is this file.

### Likely viva questions

- **Why in-memory storage?** It needs no database setup and keeps the focus on API design and testing. The drawback is that data is lost on restart; a real system would use MongoDB or MySQL.
- **How is the average rating calculated?** It is the mean of all standalone ratings plus the ratings inside reviews, rounded to 2 decimals. It is `null` when there are no ratings.
- **How is completion percentage calculated?** `total minutes watched by the user / movie duration * 100`, capped at 100.
- **Why 400 vs 404?** 400 means the client sent bad data; 404 means the movie or review does not exist; 201 means a resource was created.
- **How are requests chained in Postman?** A test script saves the id from the create response into a collection variable, and later requests use `{{movieId}}`.
- **What does Newman do?** It is Postman's command-line runner, so the same collection can run in a terminal or CI pipeline; htmlextra turns the results into an HTML report.
