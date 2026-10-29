# CampusBooks — Student-to-student used textbook marketplace

A full-stack marketplace demo built with React + Vite, Express, and SQLite. Students can register/sign in, list books, search/filter by branch/semester/subject, request a book, manage requests, and message sellers.

## Requirements
- Node.js 20+
- npm

## Run locally
Open two terminals:

### 1) Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
API runs at http://localhost:4000. The SQLite database is created automatically at `server/data/marketplace.db`; demo listings are seeded on first run.

### 2) Frontend
```bash
cd client
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173).

Demo account (seeded):
- Email: `demo@campusbooks.local`
- Password: `DemoPass123!`

Register your own account to test seller flows. Use a different email for a second account to test messaging/request flows.

## Main features
- JWT authentication and bcrypt password hashing
- Create, edit, delete, and browse listings (owners only for edit/delete)
- Search by title, author, subject, and keyword; filter by branch, semester, condition, and price
- Request a book, view incoming/outgoing requests, accept/reject requests
- One-to-one listing chat with polling refresh
- SQLite persistence
- Responsive UI

## Production notes
This is a runnable educational MVP, not a production deployment. Before public launch, add rate limiting, email verification/password reset, image upload storage, moderation/reporting, CSRF/security headers, structured logging, and a managed database. Set a long random `JWT_SECRET` and use HTTPS. The chat endpoint polls for new messages rather than using WebSockets.
