# SMS Gateway Web UI

A Node.js and Express web application built to send SMS announcements via the capcom6 `android-sms-gateway` SDK.

## Features

- **Send SMS Messages**: Instantly send SMS to single or multiple recipients.
- **Scheduled Messages**: Schedule messages to be sent at a specific date and time.
- **Recurring Messages**: Set up recurring schedules (daily, weekly, monthly) for your messages.
- **Contacts Management**: Save and manage individual contacts or groups for easier message targeting.

## Prerequisites

- [Node.js](https://nodejs.org/) (if running locally)
- [Docker](https://www.docker.com/) and Docker Compose (if running via Docker)
- An account with the [android-sms-gateway](https://sms-gate.app/) service.

## Configuration

The application requires an environment configuration. Create a `.env` file in the root directory (you can copy `.env.example` as a starting point):

```env
PORT=3000
GATEWAY_LOGIN=your_gateway_login_here
GATEWAY_PASSWORD=your_gateway_password_here
GATEWAY_URL=https://api.sms-gate.app/3rdparty/v1
```

### Environment Variables

- `PORT`: The port on which the web server runs (default: `3000`).
- `GATEWAY_LOGIN`: Your android-sms-gateway login.
- `GATEWAY_PASSWORD`: Your android-sms-gateway password.
- `GATEWAY_URL`: The API URL for the gateway (default: `https://api.sms-gate.app/3rdparty/v1`).
- `JOBS_FILE` (Optional): Path to the jobs storage file.
- `CONTACTS_FILE` (Optional): Path to the contacts storage file.

## Running the Application

### Local Setup (Node.js)

1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Access the web interface at `http://localhost:3000`.

### Docker Setup

You can run the application using Docker Compose, which uses the published image on GitHub Container Registry (`ghcr.io`).

1. Ensure your `docker-compose.yml` is configured correctly.
2. Start the container:
   ```bash
   docker compose up -d
   ```
3. Access the web interface at `http://localhost:3000`.

## Storage

- **Jobs**: Scheduled and recurring messages are stored persistently in a local `jobs.json` file.
- **Contacts**: Contacts and groups are stored persistently in a local `contacts.json` file.

## Web Interface

The frontend consists of vanilla HTML, CSS, and JavaScript served statically from the `public` directory.

- **New Message (`/`)**: Form to create and send/schedule a new SMS.
- **Scheduled Messages (`/scheduled.html`)**: View, edit, or delete scheduled and recurring messages.
- **Contacts (`/contacts.html`)**: Add and manage your saved contacts and groups.
