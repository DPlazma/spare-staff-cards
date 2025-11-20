# Spare Staff Cards Manager

A professional web application to manage spare access cards for staff, featuring RFID integration and a modern interface.

## Features

- **Dashboard Overview:** Real-time view of available and assigned cards.
- **Smart Tap Integration:** 
  - Activate "Tap Mode" to use with RFID readers.
  - Automatically detects if a tapped card should be assigned or returned.
  - Prompts for staff name on assignment.
  - Auto-detects new cards and offers to add them to the system.
- **Card Management:** Add, edit, and delete cards via a dedicated management interface.
- **Persistent Storage:** Uses SQLite to store card data and assignment history.
- **Dockerized:** Ready for deployment in any container environment.

## Deployment with Docker

1. Build the Docker image:
   ```bash
   docker build -t spare-staff-cards .
   ```

2. Run the container (mapping port 3001 and persisting data):
   ```bash
   docker run -d -p 3001:3000 -v "${PWD}/data:/app/data" --name spare-staff-cards-container spare-staff-cards
   ```

3. Open your browser to `http://localhost:3001`

## Usage

1. **Tap Mode:** Click "Activate Tap Mode" and focus the hidden input field (automatically handled). Tap a card on your RFID reader.
   - If the card is **Available**, you will be prompted to enter a staff name.
   - If the card is **Assigned**, it will be automatically returned.
   - If the card is **Unknown**, you will be prompted to add it to the system.
2. **Manual Management:** Click "Manage Cards" to add or remove cards manually.

## Development

If running locally without Docker:

1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3000`
