# GPX Planner

React frontend + Flask backend. Upload a GPX, predict time/speed, toggle a physics model, and find corridor services (Google Places). Styling is Bootstrap.

## Prereqs
- Python 3.10+
- Node 18+
- (Optional) Google Maps Places API key

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env to set GOOGLE_MAPS_API_KEY if you want corridor search
# optional: set CORS_ORIGINS for your frontend origin(s)

python app.py  # runs on http://localhost:5001
