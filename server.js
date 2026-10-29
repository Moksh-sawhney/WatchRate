// WatchRate - Movie Rating and Watch Time Check with Review System
// Express REST API + in-memory storage. Data resets whenever the server restarts.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());                                   // parse JSON request bodies
// Front page first: "/" shows welcome.html, its Enter button opens the main app (index.html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));   // serve the frontend

// ---------- in-memory "database" ----------
const db = { movies: [], ratings: [], reviews: [], watchLogs: [] };
const seq = { movie: 1, rating: 1, review: 1, watch: 1 };   // auto-increment ids

// ---------- helpers ----------
const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isInt = v => Number.isInteger(v);
const validRating = v => isInt(v) && v >= 1 && v <= 5;
const round2 = n => Math.round(n * 100) / 100;
const pct = (watched, duration) => Math.min(100, round2((watched / duration) * 100));
const bad = (res, details) => res.status(400).json({ error: 'Validation failed', details });

function validateMovie(b) {
  const e = [];
  const maxYear = new Date().getFullYear() + 5;
  if (!isStr(b.title)) e.push('title is required (non-empty string)');
  if (!isStr(b.genre)) e.push('genre is required (non-empty string)');
  if (!isInt(b.year) || b.year < 1888 || b.year > maxYear) e.push(`year must be an integer between 1888 and ${maxYear}`);
  if (!isInt(b.duration) || b.duration < 1 || b.duration > 1000) e.push('duration must be an integer between 1 and 1000 (minutes)');
  return e;
}
function validateReview(b) {
  const e = [];
  if (!isStr(b.reviewer)) e.push('reviewer is required (non-empty string)');
  if (!isStr(b.comment)) e.push('comment is required (non-empty string)');
  if (!validRating(b.rating)) e.push('rating must be an integer between 1 and 5');
  return e;
}

// Average rating counts BOTH standalone ratings and the ratings attached to reviews.
function ratingSummary(movieId) {
  const values = [
    ...db.ratings.filter(r => r.movieId === movieId),
    ...db.reviews.filter(r => r.movieId === movieId)
  ].map(r => r.rating);
  const sum = values.reduce((a, b) => a + b, 0);
  return { averageRating: values.length ? round2(sum / values.length) : null, ratingCount: values.length };
}
function watchSummary(movie) {
  const perUser = {};
  db.watchLogs.filter(w => w.movieId === movie.id)
    .forEach(w => { perUser[w.user] = (perUser[w.user] || 0) + w.minutes; });
  const viewers = Object.entries(perUser).map(([user, total]) => ({
    user, totalMinutes: total, completionPercentage: pct(total, movie.duration)
  }));
  const totalMinutes = viewers.reduce((a, v) => a + v.totalMinutes, 0);
  const averageCompletion = viewers.length
    ? round2(viewers.reduce((a, v) => a + v.completionPercentage, 0) / viewers.length) : 0;
  return { movieId: movie.id, title: movie.title, duration: movie.duration, totalMinutes, viewers, averageCompletion };
}
function movieView(m) {
  return {
    ...m,
    ...ratingSummary(m.id),
    reviewCount: db.reviews.filter(r => r.movieId === m.id).length,
    totalMinutesWatched: watchSummary(m).totalMinutes
  };
}

// Any route containing :movieId gets the movie loaded, or a 404 is returned.
app.param('movieId', (req, res, next, id) => {
  const movie = /^\d+$/.test(id) ? db.movies.find(m => m.id === Number(id)) : null;
  if (!movie) return res.status(404).json({ error: `Movie with id ${id} not found` });
  req.movie = movie;
  next();
});

// ---------- 1. MOVIES (CRUD) ----------
app.post('/api/movies', (req, res) => {
  const b = req.body || {};
  const errors = validateMovie(b);
  if (errors.length) return bad(res, errors);
  const movie = { id: seq.movie++, title: b.title.trim(), genre: b.genre.trim(), year: b.year, duration: b.duration };
  db.movies.push(movie);
  res.status(201).json(movieView(movie));
});
app.get('/api/movies', (req, res) => res.json(db.movies.map(movieView)));
app.get('/api/movies/:movieId', (req, res) => res.json(movieView(req.movie)));
app.put('/api/movies/:movieId', (req, res) => {
  const b = req.body || {};
  const errors = validateMovie(b);
  if (errors.length) return bad(res, errors);
  Object.assign(req.movie, { title: b.title.trim(), genre: b.genre.trim(), year: b.year, duration: b.duration });
  res.json(movieView(req.movie));
});
app.delete('/api/movies/:movieId', (req, res) => {
  const id = req.movie.id;
  db.movies = db.movies.filter(m => m.id !== id);
  ['ratings', 'reviews', 'watchLogs'].forEach(k => { db[k] = db[k].filter(x => x.movieId !== id); });
  res.json({ message: `Movie ${id} deleted`, id });
});

// ---------- 2. RATINGS ----------
app.post('/api/movies/:movieId/ratings', (req, res) => {
  const b = req.body || {};
  if (!validRating(b.rating)) return bad(res, ['rating must be an integer between 1 and 5']);
  if (b.user !== undefined && !isStr(b.user)) return bad(res, ['user must be a non-empty string when provided']);
  const rating = { id: seq.rating++, movieId: req.movie.id, user: b.user ? b.user.trim() : 'anonymous', rating: b.rating };
  db.ratings.push(rating);
  res.status(201).json({ rating, ...ratingSummary(req.movie.id) });
});
app.get('/api/movies/:movieId/ratings', (req, res) => {
  res.json({ movieId: req.movie.id, ...ratingSummary(req.movie.id) });
});

// ---------- 3. REVIEWS ----------
app.post('/api/movies/:movieId/reviews', (req, res) => {
  const b = req.body || {};
  const errors = validateReview(b);
  if (errors.length) return bad(res, errors);
  const now = new Date().toISOString();
  const review = { id: seq.review++, movieId: req.movie.id, reviewer: b.reviewer.trim(), comment: b.comment.trim(), rating: b.rating, createdAt: now, updatedAt: now };
  db.reviews.push(review);
  res.status(201).json(review);
});
app.get('/api/movies/:movieId/reviews', (req, res) => {
  res.json(db.reviews.filter(r => r.movieId === req.movie.id));
});
function findReview(req, res) {
  const r = /^\d+$/.test(req.params.reviewId)
    ? db.reviews.find(x => x.id === Number(req.params.reviewId) && x.movieId === req.movie.id) : null;
  if (!r) res.status(404).json({ error: `Review with id ${req.params.reviewId} not found for movie ${req.movie.id}` });
  return r;
}
app.put('/api/movies/:movieId/reviews/:reviewId', (req, res) => {
  const review = findReview(req, res);
  if (!review) return;
  const b = req.body || {};
  const errors = validateReview(b);
  if (errors.length) return bad(res, errors);
  Object.assign(review, { reviewer: b.reviewer.trim(), comment: b.comment.trim(), rating: b.rating, updatedAt: new Date().toISOString() });
  res.json(review);
});
app.delete('/api/movies/:movieId/reviews/:reviewId', (req, res) => {
  const review = findReview(req, res);
  if (!review) return;
  db.reviews = db.reviews.filter(r => r.id !== review.id);
  res.json({ message: `Review ${review.id} deleted`, id: review.id });
});

// ---------- 4. WATCH TIME ----------
app.post('/api/movies/:movieId/watch', (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (!isStr(b.user)) errors.push('user is required (non-empty string)');
  if (!isInt(b.minutes) || b.minutes < 1 || b.minutes > 1440) errors.push('minutes must be an integer between 1 and 1440');
  if (errors.length) return bad(res, errors);
  const entry = { id: seq.watch++, movieId: req.movie.id, user: b.user.trim(), minutes: b.minutes, loggedAt: new Date().toISOString() };
  db.watchLogs.push(entry);
  const mine = watchSummary(req.movie).viewers.find(v => v.user === entry.user);
  res.status(201).json({ entry, userTotalMinutes: mine.totalMinutes, completionPercentage: mine.completionPercentage });
});
app.get('/api/movies/:movieId/watch', (req, res) => res.json(watchSummary(req.movie)));
app.get('/api/movies/:movieId/watch/:user', (req, res) => {
  const v = watchSummary(req.movie).viewers.find(x => x.user === req.params.user);
  if (!v) return res.status(404).json({ error: `No watch time logged by "${req.params.user}" for movie ${req.movie.id}` });
  res.json({ movieId: req.movie.id, duration: req.movie.duration, ...v });
});

// ---------- fallbacks ----------
app.use('/api', (req, res) => res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`WatchRate running at http://localhost:${PORT}`));
}
module.exports = app;
