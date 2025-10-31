# Planalityk

**Planalityk** is a web-based GPX route planner and analyzer for cyclists, runners, and adventurers.  
It helps users draw, upload, and analyze routes with realistic performance insights — including speed, elevation, physics-based ETA predictions, and even auto-generated route videos.

---

## Features

### Route Planning
- Interactive **click-to-draw route editor** with undo/redo  
- Snaps to roads & bike paths  
- Real-time distance and elevation gain  
- One-click **GPX export**

### GPX Analysis
- Upload an existing GPX file for full analysis  
- Physics-aware ETA predictions (taking into account grade, wind, rider mass, CdA, Crr)  
- Speed & grade charts with data filtering  
- Split breakdowns and performance analytics  
- Places overlay: cafés, water stations, rest stops, bike shops  
- Printable **DOCX report**

### Video & Report Generation
- Generate a **3D flyover route video** from your GPX data  
- Download analysis charts and reports directly from the browser

---

## Technology Stack

- **Frontend:** React, React Router, Bootstrap 5, Bootstrap Icons  
- **Charts:** Chart.js  
- **Map & Geospatial:** Turf.js  
- **Server (API endpoints):** Express.js or compatible backend (handles file upload, video generation, and analytics)  
- **Format Support:** GPX, JSON, DOCX, MP4  
- **Styling:** Bootstrap + custom CSS animations  

---