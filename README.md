# League Stats

A League of Legends stats tracker built with Angular 21. Search for summoners, view match history, analyze game performance, and track live games across all regions.

![Angular](https://img.shields.io/badge/Angular-21-dd0031?logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)
![Riot API](https://img.shields.io/badge/Riot%20API-v5-c28f2c)

## Features

- **Summoner Search** — Look up any player by Riot ID (GameName#TagLine) across 11 regions
- **Match History** — Browse past games with detailed stats, builds, and KDA
- **Match Details** — In-depth view with gold graphs, kill feed, and objective timeline
- **Live Game** — See ongoing matches with team compositions and summoner spells
- **Favorites** — Save players locally for quick access
- **Champion Stats** — Per-champion performance breakdown from recent matches

## Supported Regions

EUW, EUNE, NA, KR, BR, JP, OCE, TR, RU, LAN, LAS

## Tech Stack

- Angular 21 (standalone components, signals)
- RxJS for reactive data handling
- Data Dragon API for champion/item assets
- Server-side rendering support (Angular SSR)

## Prerequisites

- Node.js 18+
- Riot Games API Key — get one at [developer.riotgames.com](https://developer.riotgames.com/)

## Getting Started

1. **Clone the repository**

    ```bash
    git clone https://github.com/your-username/League-Stats.git
    cd League-Stats/Frontend
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Set your Riot API Key**

    Windows (PowerShell):

    ```powershell
    $env:RIOT_API_KEY="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    ```

    Linux/macOS:

    ```bash
    export RIOT_API_KEY="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    ```

4. **Start the development server**

    ```bash
    npm start
    ```

5. Open [http://localhost:4200](http://localhost:4200) in your browser

## Project Structure

```
Frontend/
├── src/
│   ├── app/
│   │   ├── components/     # Reusable UI components
│   │   ├── core/           # Services, interceptors, API logic
│   │   │   ├── riot-api.ts
│   │   │   ├── regions.ts
│   │   │   └── services/
│   │   └── pages/          # Route components
│   │       ├── home/
│   │       ├── summoner/
│   │       ├── match/
│   │       ├── live-game/
│   │       └── favorites/
│   └── environments/
└── proxy.conf.json         # API proxy configuration
```

## Scripts

| Command                         | Description                   |
| ------------------------------- | ----------------------------- |
| `npm start`                     | Start dev server on port 4200 |
| `npm run build`                 | Production build              |
| `npm test`                      | Run unit tests with Karma     |
| `npm run serve:ssr:LeagueStats` | Run SSR build                 |

## API Proxy

The app uses a proxy configuration to handle CORS when communicating with Riot's API endpoints. Check [proxy.conf.json](Frontend/proxy.conf.json) for routing details.

## Links

- [Demo Video (YouTube)](https://www.youtube.com/watch?v=JMWoOkIspnk)
- [Documentation](https://docs.google.com/document/d/1br0_ukY_cjxBSkStoSz7EkPGnM5yzg2zWopqgh1tpPk/edit?usp=sharing)
- [Riot Developer Portal](https://developer.riotgames.com/)

## License

This project is for educational purposes. League of Legends and Riot Games are trademarks of Riot Games, Inc.
