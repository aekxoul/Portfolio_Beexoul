import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Security & Header Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path === '/sw.js') {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Specific route mappings
app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'blog', 'blog.html'));
});

app.get('/blog/', (req, res) => {
  res.sendFile(path.join(__dirname, 'blog', 'blog.html'));
});

app.get('/blog/post', (req, res) => {
  res.sendFile(path.join(__dirname, 'blog', 'assets', 'post', 'post.html'));
});

// Serve static files from root directory with max-age caching
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
}));

// Custom 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
