# METEOR SHOWER – AI-Powered Meteor Shower Prediction System

A futuristic, interactive web application featuring a realistic 3D Earth visualization, animated meteor showers, an AI prediction calendar, and machine learning results powered by a NASA meteor shower dataset.

![Python](https://img.shields.io/badge/Python-3.9+-blue) ![Flask](https://img.shields.io/badge/Flask-3.0-green) ![Three.js](https://img.shields.io/badge/Three.js-3D-orange) ![scikit-learn](https://img.shields.io/badge/scikit--learn-ML-red)

## Features

- **Realistic 3D Earth** – Photorealistic spinning globe with NASA Blue Marble textures, clouds, atmospheric glow, and day/night lighting (Three.js)
- **Animated Meteor Showers** – Falling shooting stars with glowing heads, flame tails, and atmospheric entry effects
- **AI Prediction Calendar** – Select any date to get ML-powered meteor shower activity predictions
- **Random Forest Model** – Trained on 4,700+ NASA meteor observations for shower classification
- **Interactive Controls** – Earth spin rate/direction, meteor speed, radiant direction, zoom, and more
- **Observatory Dashboard** – Real-time meteor statistics, model metrics, and data explorer

## Quick Start (Run on Your Laptop)

### Prerequisites

- **Python 3.9+** installed ([download here](https://www.python.org/downloads/))
- **Git** installed ([download here](https://git-scm.com/downloads))

### Step 1 – Clone the Repository

```bash
git clone https://github.com/subhabhowmik2005-ctrl/Meteor-Shower-Prediction.git
cd Meteor-Shower-Prediction
```

### Step 2 – Create a Virtual Environment (recommended)

**Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3 – Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4 – Run the App

```bash
python app.py
```

### Step 5 – Open in Browser

Open your browser and go to:

```
http://127.0.0.1:5000/
```

That's it! The 3D Earth, meteor animations, and AI predictions will load automatically.

## Project Structure

```
Meteor-Shower-Prediction/
├── app.py                          # Flask backend server & API routes
├── meteor_model.py                 # ML model training & prediction pipeline
├── meteor_2025_with_headers_no_null(2).csv  # NASA meteor dataset
├── requirements.txt                # Python dependencies
├── index.html                      # Main frontend page
├── css/
│   └── style.css                   # Space-themed styling
├── js/
│   └── main.js                     # Three.js 3D scene, meteors, calendar, controls
├── assets/
│   └── textures/                   # NASA Earth texture maps
│       ├── earth_day.jpg
│       ├── earth_normal.jpg
│       ├── earth_specular.jpg
│       ├── earth_clouds_rgba.png
│       └── earth_lights.png
├── meteor_model.pkl                # Trained Random Forest model (auto-generated)
└── peak_features.pkl               # Feature pipeline data (auto-generated)
```

## Technologies Used

- **Backend:** Python, Flask, Flask-CORS
- **ML:** scikit-learn (Random Forest), pandas, NumPy, joblib
- **Frontend:** HTML5, CSS3, JavaScript (ES Modules)
- **3D Visualization:** Three.js (WebGL)
- **Dataset:** NASA Meteor Shower Observations (2025)

## How It Works

1. The Random Forest model is trained on 4,700+ meteor records with features like solar longitude, geocentric velocity, right ascension, declination, and more.
2. When a user selects a date on the calendar, the backend computes astronomical features for that date and runs the trained model to predict which meteor shower (if any) is active and its intensity level.
3. The 3D scene renders a realistic Earth with animated meteors falling from the predicted radiant direction.

## License

This project is for educational and portfolio purposes.
