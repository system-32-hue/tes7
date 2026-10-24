# Roblox API demo

This project is a small Node.js web app ready to be deployed on Render.

## Local run

```bash
npm install
npm start
```

Then open:

- http://localhost:3000/
- http://localhost:3000/api/random
- http://localhost:3000/api/data

## Render deployment

1. Push this repository to GitHub.
2. In Render, create a new Web Service.
3. Connect the repository.
4. Use the following settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Render will automatically use the `PORT` environment variable.

## API routes

- `GET /` — HTML page with usage instructions.
- `GET /api/random` — returns a random number from 0 to 100.
- `POST /api/data` — receives a JSON body like `{ "value": 42 }`.
- `GET /api/data` — returns all submissions stored in memory since the server started.
