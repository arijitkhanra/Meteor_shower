import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, mean_squared_error, r2_score
import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, 'meteor_2025_with_headers_no_null(2).csv')
if not os.path.exists(DATASET_PATH):
    DATASET_PATH = os.path.join(BASE_DIR, '..', 'meteor_2025_with_headers_no_null(2).csv')
MODEL_DIR = os.path.join(BASE_DIR, 'models')

def ensure_model_dir():
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)

def load_and_preprocess_data():
    df = pd.read_csv(DATASET_PATH, low_memory=False)
    
    columns = [
        'Unique trajectory', 'Beginning_JD', 'Beginning_Time', 'IAU_Code', 'IAU_Shower',
        'Sol_lon', 'App_LST', 'RAgeo', 'RAgeo_err', 'DECgeo', 'DECgeo_err',
        'LAMgeo', 'LAMgeo_err', 'BETgeo', 'BETgeo_err', 'Vgeo', 'Vgeo_err',
        'LAMhel', 'LAMhel_err', 'BEThel', 'BEThel_err', 'Vhel', 'Vhel_err',
        'a', 'a_err', 'e', 'e_err', 'i', 'i_err', 'peri', 'peri_err',
        'node', 'node_err', 'Pi', 'Pi_err', 'b', 'b_err', 'q', 'q_err',
        'f', 'f_err', 'M', 'M_err', 'Q', 'Q_err', 'n', 'n_err',
        'T', 'T_err', 'TisserandJ', 'TisserandJ_err', 'RAapp', 'RAapp_err',
        'DECapp', 'DECapp_err', 'Azim_E', 'Azim_E_err', 'Elev', 'Elev_err',
        'Vinit', 'Vinit_err', 'Vavg', 'Vavg_err', 'LatBeg', 'LatBeg_err',
        'LonBeg', 'LonBeg_err', 'HtBeg', 'HtBeg_err', 'LatEnd', 'LatEnd_err',
        'LonEnd', 'LonEnd_err', 'HtEnd', 'HtEnd_err', 'Duration', 'Peak',
        'Peak_Ht', 'F', 'Mass_kg', 'Qc', 'MedianFitErr', 'Beg_in', 'End_in',
        'Num', 'Participating'
    ]
    df.columns = columns
    
    numeric_cols = [
        'Sol_lon', 'App_LST', 'RAgeo', 'DECgeo', 'LAMgeo', 'BETgeo', 'Vgeo',
        'LAMhel', 'BEThel', 'Vhel', 'a', 'e', 'i', 'peri', 'node', 'Pi', 'b',
        'q', 'f', 'M', 'Q', 'n', 'T', 'TisserandJ', 'RAapp', 'DECapp',
        'Azim_E', 'Elev', 'Vinit', 'Vavg', 'LatBeg', 'LonBeg', 'HtBeg',
        'LatEnd', 'LonEnd', 'HtEnd', 'Duration', 'Peak', 'Peak_Ht', 'F', 'Mass_kg'
    ]
    
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].median())
    
    df['IAU_Code'] = df['IAU_Code'].astype(str)
    df['IAU_Shower'] = df['IAU_Shower'].astype(str)
    
    df['Shower_Category'] = df['IAU_Code'].apply(lambda x: 'Known' if x != '-1' else 'Sporadic')
    
    return df

def train_shower_classifier(df):
    feature_cols = [
        'Sol_lon', 'RAgeo', 'DECgeo', 'Vgeo', 'LAMhel', 'BEThel', 'Vhel',
        'a', 'e', 'i', 'peri', 'node', 'Pi', 'q', 'Q', 'TisserandJ',
        'LatBeg', 'LonBeg', 'HtBeg', 'Duration', 'Peak', 'Vavg', 'Mass_kg'
    ]
    
    known_df = df[df['IAU_Code'] != '-1'].copy()
    
    if len(known_df) < 100:
        print("Warning: Limited known shower data. Using Shower_Category instead.")
        y = df['Shower_Category']
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y)
        X = df[feature_cols].values
    else:
        shower_counts = known_df['IAU_Shower'].value_counts()
        valid_showers = shower_counts[shower_counts >= 3].index
        filtered_df = known_df[known_df['IAU_Shower'].isin(valid_showers)].copy()
        print(f"Using {len(filtered_df)} samples from {len(valid_showers)} shower types (min 3 samples each)")
        
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(filtered_df['IAU_Shower'])
        X = filtered_df[feature_cols].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    class_counts = np.bincount(y_encoded)
    can_stratify = np.all(class_counts >= 2)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded if can_stratify else None
    )
    
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        class_weight='balanced'
    )
    clf.fit(X_train, y_train)
    
    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Shower Classifier Accuracy: {accuracy:.4f}")
    
    ensure_model_dir()
    joblib.dump(clf, os.path.join(MODEL_DIR, 'shower_classifier.pkl'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'shower_scaler.pkl'))
    joblib.dump(label_encoder, os.path.join(MODEL_DIR, 'shower_label_encoder.pkl'))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, 'shower_features.pkl'))
    
    return clf, scaler, label_encoder, feature_cols

def train_peak_intensity_predictor(df):
    feature_cols = [
        'Sol_lon', 'RAgeo', 'DECgeo', 'Vgeo', 'a', 'e', 'i', 'q', 'Q',
        'TisserandJ', 'Duration', 'Vavg', 'Mass_kg', 'HtBeg', 'HtEnd'
    ]
    
    valid_df = df[df['Peak'].notna()].copy()
    valid_df = valid_df[valid_df['Peak'] > -10]
    
    X = valid_df[feature_cols].values
    y = valid_df['Peak'].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    regressor = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    regressor.fit(X_train, y_train)
    
    y_pred = regressor.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"Peak Intensity Predictor - MSE: {mse:.4f}, R2: {r2:.4f}")
    
    ensure_model_dir()
    joblib.dump(regressor, os.path.join(MODEL_DIR, 'peak_regressor.pkl'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'peak_scaler.pkl'))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, 'peak_features.pkl'))
    
    return regressor, scaler, feature_cols

def train_duration_predictor(df):
    feature_cols = [
        'Sol_lon', 'RAgeo', 'DECgeo', 'Vgeo', 'Vhel', 'a', 'e', 'i', 'q',
        'Mass_kg', 'HtBeg', 'HtEnd', 'Peak'
    ]
    
    valid_df = df[df['Duration'].notna() & (df['Duration'] > 0)].copy()
    
    X = valid_df[feature_cols].values
    y = np.log1p(valid_df['Duration'].values)
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )
    
    regressor = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    regressor.fit(X_train, y_train)
    
    y_pred = regressor.predict(X_test)
    mse = mean_squared_error(np.expm1(y_test), np.expm1(y_pred))
    r2 = r2_score(np.expm1(y_test), np.expm1(y_pred))
    print(f"Duration Predictor - MSE: {mse:.4f}, R2: {r2:.4f}")
    
    ensure_model_dir()
    joblib.dump(regressor, os.path.join(MODEL_DIR, 'duration_regressor.pkl'))
    joblib.dump(scaler, os.path.join(MODEL_DIR, 'duration_scaler.pkl'))
    joblib.dump(feature_cols, os.path.join(MODEL_DIR, 'duration_features.pkl'))
    
    return regressor, scaler, feature_cols

def load_models():
    ensure_model_dir()
    
    required_models = [
        'shower_classifier.pkl', 'shower_scaler.pkl', 'shower_label_encoder.pkl', 'shower_features.pkl',
        'peak_regressor.pkl', 'peak_scaler.pkl', 'peak_features.pkl',
        'duration_regressor.pkl', 'duration_scaler.pkl', 'duration_features.pkl'
    ]
    
    model_dir = BASE_DIR
    if all(os.path.exists(os.path.join(BASE_DIR, m)) for m in required_models):
        model_dir = BASE_DIR
    elif os.path.exists(MODEL_DIR) and all(os.path.exists(os.path.join(MODEL_DIR, m)) for m in required_models):
        model_dir = MODEL_DIR
    else:
        print("Training models...")
        df = load_and_preprocess_data()
        train_shower_classifier(df)
        train_peak_intensity_predictor(df)
        train_duration_predictor(df)
        model_dir = MODEL_DIR if os.path.exists(os.path.join(MODEL_DIR, 'shower_classifier.pkl')) else BASE_DIR
        print("Models trained successfully!")
    
    models = {
        'shower_clf': joblib.load(os.path.join(model_dir, 'shower_classifier.pkl')),
        'shower_scaler': joblib.load(os.path.join(model_dir, 'shower_scaler.pkl')),
        'shower_le': joblib.load(os.path.join(model_dir, 'shower_label_encoder.pkl')),
        'shower_features': joblib.load(os.path.join(model_dir, 'shower_features.pkl')),
        'peak_reg': joblib.load(os.path.join(model_dir, 'peak_regressor.pkl')),
        'peak_scaler': joblib.load(os.path.join(model_dir, 'peak_scaler.pkl')),
        'peak_features': joblib.load(os.path.join(model_dir, 'peak_features.pkl')),
        'dur_reg': joblib.load(os.path.join(model_dir, 'duration_regressor.pkl')),
        'dur_scaler': joblib.load(os.path.join(model_dir, 'duration_scaler.pkl')),
        'dur_features': joblib.load(os.path.join(model_dir, 'duration_features.pkl')),
    }
    
    return models

def predict_shower(models, input_data):
    features = np.array([[input_data.get(f, 0) for f in models['shower_features']]])
    scaled = models['shower_scaler'].transform(features)
    prediction = models['shower_clf'].predict(scaled)
    probabilities = models['shower_clf'].predict_proba(scaled)
    
    shower_name = models['shower_le'].inverse_transform(prediction)[0]
    classes = models['shower_le'].classes_
    proba_dict = {cls: float(prob) for cls, prob in zip(classes, probabilities[0])}
    top_predictions = sorted(proba_dict.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        'predicted_shower': shower_name,
        'confidence': float(np.max(probabilities)),
        'top_predictions': top_predictions
    }

def predict_peak(models, input_data):
    features = np.array([[input_data.get(f, 0) for f in models['peak_features']]])
    scaled = models['peak_scaler'].transform(features)
    prediction = models['peak_reg'].predict(scaled)
    return float(prediction[0])

def predict_duration(models, input_data):
    features = np.array([[input_data.get(f, 0) for f in models['dur_features']]])
    scaled = models['dur_scaler'].transform(features)
    prediction = models['dur_reg'].predict(scaled)
    return float(np.expm1(prediction[0]))

def get_shower_statistics(df):
    known_showers = df[df['IAU_Code'] != '-1']
    shower_counts = known_showers['IAU_Shower'].value_counts().head(15)
    
    stats = {
        'total_meteors': len(df),
        'known_showers': len(known_showers),
        'sporadic': len(df) - len(known_showers),
        'unique_showers': known_showers['IAU_Shower'].nunique(),
        'top_showers': [
            {'name': name, 'count': int(count)}
            for name, count in shower_counts.items()
        ],
        'avg_peak': float(df['Peak'].median()),
        'avg_duration': float(df['Duration'].median()),
        'avg_velocity': float(df['Vgeo'].median()),
        'avg_mass': float(df['Mass_kg'].median())
    }
    return stats

if __name__ == '__main__':
    df = load_and_preprocess_data()
    print(f"Dataset loaded: {len(df)} meteors")
    print(f"Known showers: {df[df['IAU_Code'] != '-1']['IAU_Shower'].nunique()} unique types")
    train_shower_classifier(df)
    train_peak_intensity_predictor(df)
    train_duration_predictor(df)
    print("All models trained and saved.")
