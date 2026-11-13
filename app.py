# pyrefly: ignore[missing-import]
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
# pyrefly: ignore[missing-import]
import numpy as np
import os
import json
import datetime
from meteor_model import (
    load_and_preprocess_data,
    load_models,
    predict_shower,
    predict_peak,
    predict_duration,
    get_shower_statistics,
    predict_by_date,
    get_calendar_month_predictions,
    get_model_evaluation_metrics,
    ASTRONOMICAL_SHOWERS
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = BASE_DIR
if os.path.exists(os.path.join(BASE_DIR, '..', 'frontend')):
    static_dir = os.path.join(BASE_DIR, '..', 'frontend')

app = Flask(__name__, static_folder=static_dir, static_url_path='')
CORS(app)

df = None
models = None

def initialize():
    global df, models
    if df is not None and models is not None:
        return
    print("Loading dataset and models...")
    df = load_and_preprocess_data()
    models = load_models()
    print(f"Loaded {len(df)} meteor records and all models.")

# Initialize dataset and models on startup for both Gunicorn and direct execution
initialize()

@app.route('/')
def index():
    return send_from_directory(static_dir, 'index.html')

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'healthy',
        'application': 'METEOR SHOWER – AI-Powered Meteor Shower Prediction System',
        'total_meteors': len(df) if df is not None else 0,
        'models_loaded': models is not None,
        'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()
    })

@app.route('/api/statistics')
def statistics():
    stats = get_shower_statistics(df)
    return jsonify(stats)

@app.route('/api/model-info')
def model_info():
    metrics = get_model_evaluation_metrics()
    return jsonify(metrics)

@app.route('/api/upcoming-showers')
def upcoming_showers():
    return jsonify({'showers': ASTRONOMICAL_SHOWERS})

@app.route('/api/predict/date', methods=['GET', 'POST'])
def predict_date_endpoint():
    try:
        if request.method == 'POST':
            data = request.get_json(force=True) or {}
            date_str = data.get('date')
            year = data.get('year')
            month = data.get('month')
            day = data.get('day')
        else:
            date_str = request.args.get('date')
            year = request.args.get('year')
            month = request.args.get('month')
            day = request.args.get('day')
            
        if date_str:
            parts = date_str.strip().split('-')
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            else:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        elif year and month and day:
            year, month, day = int(year), int(month), int(day)
        else:
            today = datetime.date.today()
            year, month, day = today.year, today.month, today.day
            
        result = predict_by_date(models, year, month, day)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/predict/calendar')
def predict_calendar_endpoint():
    try:
        now = datetime.date.today()
        year = int(request.args.get('year', now.year))
        month = int(request.args.get('month', now.month))
        
        if month < 1 or month > 12:
            return jsonify({'error': 'Invalid month (1-12)'}), 400
            
        result = get_calendar_month_predictions(models, year, month)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/3d-data')
def get_3d_data():
    limit = int(request.args.get('limit', 300))
    shower_filter = request.args.get('shower', '')
    
    filtered_df = df.copy()
    if shower_filter and shower_filter != 'ALL':
        filtered_df = filtered_df[filtered_df['IAU_Shower'] == shower_filter]
        
    sample = filtered_df.sample(n=min(limit, len(filtered_df)), random_state=42) if len(filtered_df) > 0 else filtered_df
    
    meteors_3d = []
    for _, row in sample.iterrows():
        rageo = float(row['RAgeo']) if pd.notna(row['RAgeo']) else 0.0
        decgeo = float(row['DECgeo']) if pd.notna(row['DECgeo']) else 0.0
        vgeo = float(row['Vgeo']) if pd.notna(row['Vgeo']) else 35.0
        peak = float(row['Peak']) if pd.notna(row['Peak']) else 1.0
        duration = float(row['Duration']) if pd.notna(row['Duration']) else 0.5
        mass = float(row['Mass_kg']) if pd.notna(row['Mass_kg']) else 0.0001
        
        lat_beg = float(row['LatBeg']) if pd.notna(row['LatBeg']) else None
        lon_beg = float(row['LonBeg']) if pd.notna(row['LonBeg']) else None
        ht_beg = float(row['HtBeg']) if pd.notna(row['HtBeg']) else 100.0
        lat_end = float(row['LatEnd']) if pd.notna(row['LatEnd']) else None
        lon_end = float(row['LonEnd']) if pd.notna(row['LonEnd']) else None
        ht_end = float(row['HtEnd']) if pd.notna(row['HtEnd']) else 75.0
        
        shower_name = row['IAU_Shower']
        iau_code = row['IAU_Code']
        activity = row.get('shower_activity', 'Sporadic')
        
        # Color coding based on shower and velocity
        if shower_name == 'QUA':
            color = {'r': 0.0, 'g': 0.94, 'b': 1.0}  # Electric Cyan
        elif vgeo > 60:
            color = {'r': 0.3, 'g': 0.8, 'b': 1.0}   # Fast Blue-White
        elif vgeo > 45:
            color = {'r': 0.2, 'g': 1.0, 'b': 0.6}   # Emerald Green
        elif peak < -1.0:
            color = {'r': 1.0, 'g': 0.75, 'b': 0.15} # Bright Golden Fireball
        else:
            color = {'r': 1.0, 'g': 0.45, 'b': 0.2}  # Fiery Orange
            
        meteors_3d.append({
            'id': row['Unique trajectory'],
            'shower': shower_name,
            'iau_code': iau_code,
            'activity': activity,
            'rageo': rageo,
            'decgeo': decgeo,
            'vgeo': vgeo,
            'peak': peak,
            'duration': duration,
            'mass': mass,
            'lat_beg': lat_beg,
            'lon_beg': lon_beg,
            'ht_beg': ht_beg,
            'lat_end': lat_end,
            'lon_end': lon_end,
            'ht_end': ht_end,
            'color': color,
            'size': max(0.04, min(0.18, mass * 120 + 0.05))
        })
    
    return jsonify({'meteors': meteors_3d, 'total_matched': len(filtered_df)})

@app.route('/api/meteors')
def get_meteors():
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    search = request.args.get('search', '')
    shower_filter = request.args.get('shower', '')
    
    filtered = df.copy()
    
    if search:
        filtered = filtered[
            filtered['Unique trajectory'].str.contains(search, case=False) |
            filtered['IAU_Shower'].str.contains(search, case=False)
        ]
    
    if shower_filter and shower_filter != 'ALL':
        filtered = filtered[filtered['IAU_Shower'] == shower_filter]
    
    total = len(filtered)
    start = (page - 1) * per_page
    end = start + per_page
    
    page_data = filtered.iloc[start:end]
    
    result = []
    for _, row in page_data.iterrows():
        result.append({
            'id': row['Unique trajectory'],
            'iau_code': row['IAU_Code'],
            'iau_shower': row['IAU_Shower'],
            'sol_lon': float(row['Sol_lon']) if pd.notna(row['Sol_lon']) else None,
            'rageo': float(row['RAgeo']) if pd.notna(row['RAgeo']) else None,
            'decgeo': float(row['DECgeo']) if pd.notna(row['DECgeo']) else None,
            'vgeo': float(row['Vgeo']) if pd.notna(row['Vgeo']) else None,
            'lat_beg': float(row['LatBeg']) if pd.notna(row['LatBeg']) else None,
            'lon_beg': float(row['LonBeg']) if pd.notna(row['LonBeg']) else None,
            'ht_beg': float(row['HtBeg']) if pd.notna(row['HtBeg']) else None,
            'lat_end': float(row['LatEnd']) if pd.notna(row['LatEnd']) else None,
            'lon_end': float(row['LonEnd']) if pd.notna(row['LonEnd']) else None,
            'ht_end': float(row['HtEnd']) if pd.notna(row['HtEnd']) else None,
            'duration': float(row['Duration']) if pd.notna(row['Duration']) else None,
            'peak': float(row['Peak']) if pd.notna(row['Peak']) else None,
            'peak_ht': float(row['Peak_Ht']) if pd.notna(row['Peak_Ht']) else None,
            'mass_kg': float(row['Mass_kg']) if pd.notna(row['Mass_kg']) else None,
            'a': float(row['a']) if pd.notna(row['a']) else None,
            'e': float(row['e']) if pd.notna(row['e']) else None,
            'i': float(row['i']) if pd.notna(row['i']) else None,
            'category': row['Shower_Category'],
            'activity': row.get('shower_activity', 'Sporadic')
        })
    
    return jsonify({
        'total': total,
        'page': page,
        'per_page': per_page,
        'data': result
    })

@app.route('/api/meteors/<meteor_id>')
def get_meteor_detail(meteor_id):
    row = df[df['Unique trajectory'] == meteor_id]
    if len(row) == 0:
        return jsonify({'error': 'Meteor not found'}), 404
    
    row = row.iloc[0]
    detail = {}
    for col in df.columns:
        val = row[col]
        if pd.notna(val):
            if isinstance(val, (np.integer,)):
                detail[col] = int(val)
            elif isinstance(val, (np.floating,)):
                detail[col] = float(val)
            else:
                detail[col] = str(val)
        else:
            detail[col] = None
    
    return jsonify(detail)

@app.route('/api/showers')
def get_showers():
    known_df = df[df['IAU_Code'] != '-1']
    showers = known_df.groupby('IAU_Shower').agg({
        'Unique trajectory': 'count',
        'Peak': 'median',
        'Duration': 'median',
        'Vgeo': 'median',
        'Mass_kg': 'median',
        'Sol_lon': ['min', 'max']
    }).round(4)
    
    showers.columns = ['_'.join(col).strip() for col in showers.columns.values]
    showers = showers.reset_index()
    showers = showers.sort_values('Unique trajectory_count', ascending=False)
    
    result = []
    for _, row in showers.iterrows():
        result.append({
            'name': row['IAU_Shower'],
            'count': int(row['Unique trajectory_count']),
            'avg_peak': float(row['Peak_median']) if pd.notna(row['Peak_median']) else None,
            'avg_duration': float(row['Duration_median']) if pd.notna(row['Duration_median']) else None,
            'avg_velocity': float(row['Vgeo_median']) if pd.notna(row['Vgeo_median']) else None,
            'avg_mass': float(row['Mass_kg_median']) if pd.notna(row['Mass_kg_median']) else None,
            'sol_lon_min': float(row['Sol_lon_min']) if pd.notna(row['Sol_lon_min']) else None,
            'sol_lon_max': float(row['Sol_lon_max']) if pd.notna(row['Sol_lon_max']) else None
        })
    
    return jsonify(result)

@app.route('/api/predict/shower', methods=['POST'])
def predict_shower_endpoint():
    try:
        input_data = request.json
        result = predict_shower(models, input_data)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/predict/peak', methods=['POST'])
def predict_peak_endpoint():
    try:
        input_data = request.json
        peak = predict_peak(models, input_data)
        return jsonify({
            'predicted_peak_magnitude': peak,
            'interpretation': 'Lower value = Brighter meteor'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/predict/duration', methods=['POST'])
def predict_duration_endpoint():
    try:
        input_data = request.json
        duration = predict_duration(models, input_data)
        return jsonify({
            'predicted_duration_seconds': duration,
            'predicted_duration_formatted': f"{duration:.2f}s"
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/predict/comprehensive', methods=['POST'])
def predict_comprehensive():
    try:
        input_data = request.json
        shower_result = predict_shower(models, input_data)
        peak = predict_peak(models, input_data)
        duration = predict_duration(models, input_data)
        
        vgeo = float(input_data.get('Vgeo', 35))
        mass = float(input_data.get('Mass_kg', 0.0001))
        energy_joules = 0.5 * mass * (vgeo * 1000)**2
        energy_tnt_kg = energy_joules / 4.184e6
        
        if peak < -4:
            peak_class = 'Superbolide'
        elif peak < 0:
            peak_class = 'Bright'
        elif peak < 3:
            peak_class = 'Normal'
        else:
            peak_class = 'Faint'
            
        dur_class = 'Long' if duration > 1.0 else ('Medium' if duration > 0.4 else 'Short')
        risk_level = 'High' if energy_joules > 1e6 else ('Moderate' if energy_joules > 1e4 else 'Minimal')
        
        return jsonify({
            'shower_prediction': shower_result,
            'peak_magnitude': {
                'value': peak,
                'intensity_class': peak_class
            },
            'duration': {
                'seconds': duration,
                'formatted': f"{duration:.2f}s",
                'class': dur_class
            },
            'estimated_energy_joules': energy_joules,
            'estimated_energy_tnt_kg': energy_tnt_kg,
            'risk_assessment': {
                'level': risk_level,
                'note': 'Based on estimated kinetic energy'
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/timeline')
def get_timeline():
    sol_lon_range = np.arange(280.0, 283.0, 0.2)
    timeline = []
    known_df = df[df['IAU_Code'] != '-1']
    
    for sol in sol_lon_range:
        in_range = known_df[
            (known_df['Sol_lon'] >= sol) & (known_df['Sol_lon'] < sol + 0.2)
        ]
        if len(in_range) > 0:
            top_shower = in_range['IAU_Shower'].value_counts().idxmax()
            timeline.append({
                'sol_lon': round(float(sol), 2),
                'count': len(in_range),
                'top_shower': top_shower,
                'avg_peak': float(in_range['Peak'].median()),
                'avg_velocity': float(in_range['Vgeo'].median())
            })
        else:
            timeline.append({
                'sol_lon': round(float(sol), 2),
                'count': 0,
                'top_shower': 'None',
                'avg_peak': None,
                'avg_velocity': None
            })
    
    return jsonify(timeline)

@app.route('/api/orbital_elements')
def get_orbital_elements():
    limit = int(request.args.get('limit', 200))
    sample = df.sample(n=min(limit, len(df)), random_state=42)
    
    orbits = []
    for _, row in sample.iterrows():
        orbits.append({
            'id': row['Unique trajectory'],
            'shower': row['IAU_Shower'],
            'a': float(row['a']) if pd.notna(row['a']) else None,
            'e': float(row['e']) if pd.notna(row['e']) else None,
            'i': float(row['i']) if pd.notna(row['i']) else None,
            'peri': float(row['peri']) if pd.notna(row['peri']) else None,
            'node': float(row['node']) if pd.notna(row['node']) else None,
            'q': float(row['q']) if pd.notna(row['q']) else None,
            'Q': float(row['Q']) if pd.notna(row['Q']) else None,
            'TisserandJ': float(row['TisserandJ']) if pd.notna(row['TisserandJ']) else None,
            'vhel': float(row['Vhel']) if pd.notna(row['Vhel']) else None
        })
    
    return jsonify({'orbits': orbits})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
