# CattleMO

CattleMO is an IoT livestock-monitoring system for tracking cattle location, analyzing grazing patterns, managing animal records, and understanding milk production through a web dashboard.

## Highlights

- Ingest live telemetry and GPS data from ESP devices.
- Track cattle location on an interactive map.
- Create and visualize grazing zones.
- Discover grazing zones automatically with DBSCAN clustering over GPS observations.
- Calculate cluster bounding boxes to show the geographic extent of discovered grazing areas.
- Manage animal profiles, including node association, details, and milk-yield history.
- Analyze morning, evening, and total milk production with per-animal and fleet-level charts.
- Review recent tracking logs and GPS connectivity information.

## Built with

- Next.js and TypeScript
- React and Tailwind CSS
- Flask and Python
- MongoDB
- ESP firmware
- Leaflet and React Leaflet
- Chart.js
- scikit-learn and DBSCAN clustering

## Project structure

- `frontend/` — Next.js dashboard for live tracking, maps, grazing zones, animal records, and analytics.
- `backend/` — Flask API, MongoDB data layer, telemetry ingestion, and DBSCAN-based GPS cluster analysis.
- `esp-codes/` — Device firmware for collecting and sending livestock telemetry.

## Project status

The repository contains deployment configuration for the backend, but no public application URL has been configured yet.

## License

No repository license has been selected yet. Please contact the repository owner before reusing the project outside the terms permitted by applicable copyright law.

## Contact

Created by [Kedar Pravin Damale](https://github.com/KedarDamale).
