"""
train_ikpg_model.py
===================
Script training model Machine Learning untuk IKPG (Indeks Ketahanan Pangan Gabungan).

Jalankan sekali dari terminal:
    python train_ikpg_model.py

Output:
    ai_models/rf_ikpg_model.pkl      ← Random Forest classifier
    ai_models/kmeans_ikpg_model.pkl  ← K-Means cluster validator
    ai_models/model_metadata.json    ← info akurasi, feature importance, dll

Strategi labeling:
    - Label di-generate dari formula rule-based sekarang (bootstrap)
    - RF belajar non-linear interaction antar fitur
    - K-Means memvalidasi tanpa label (unsupervised)

Fitur (4 atau 5 tergantung GeoAI tersedia):
    [produksi_score, kalori_score, insecurity_score, geoai_score (opsional)]
"""

import os
import json
import joblib
import numpy as np
from collections import Counter
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import LeaveOneOut, StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix

# ─────────────────────────────────────────────────────────────
# DATA BPS 2024/2025 (38 provinsi)
# ─────────────────────────────────────────────────────────────

PRODUKSI_TON = {
    "ACEH": 1659966.28, "SUMATERA UTARA": 2204875.51,
    "SUMATERA BARAT": 1356467.93, "RIAU": 222055.71,
    "JAMBI": 281022.05, "SUMATERA SELATAN": 2909411.67,
    "BENGKULU": 272848.55, "LAMPUNG": 2791347.53,
    "KEPULAUAN BANGKA BELITUNG": 77489.79, "KEPULAUAN RIAU": 305.09,
    "JAKARTA": 2306.54, "JAWA BARAT": 8626879.91,
    "JAWA TENGAH": 8891297.05, "DAERAH ISTIMEWA YOGYAKARTA": 452831.77,
    "JAWA TIMUR": 9270435.29, "BANTEN": 1550623.46,
    "BALI": 635473.35, "NUSA TENGGARA BARAT": 1453408.37,
    "NUSA TENGGARA TIMUR": 707792.54, "KALIMANTAN BARAT": 764784.15,
    "KALIMANTAN TENGAH": 366146.82, "KALIMANTAN SELATAN": 1029567.93,
    "KALIMANTAN TIMUR": 249642.90, "KALIMANTAN UTARA": 30079.77,
    "SULAWESI UTARA": 273134.94, "SULAWESI TENGAH": 761936.39,
    "SULAWESI SELATAN": 4818429.39, "SULAWESI TENGGARA": 555836.08,
    "GORONTALO": 234862.88, "SULAWESI BARAT": 318876.59,
    "MALUKU": 91125.35, "MALUKU UTARA": 31232.95,
    "PAPUA BARAT": 20729.15, "PAPUA BARAT DAYA": 988.64,
    "PAPUA": 4609.95, "PAPUA SELATAN": 217789.62,
    "PAPUA TENGAH": 6072.38, "PAPUA PEGUNUNGAN": 42.38,
}

KALORI_KKAL = {
    "ACEH": 2027.78, "SUMATERA UTARA": 2069.98, "SUMATERA BARAT": 2079.39,
    "RIAU": 2033.81, "JAMBI": 2040.04, "SUMATERA SELATAN": 2202.46,
    "BENGKULU": 2059.99, "LAMPUNG": 2037.55,
    "KEPULAUAN BANGKA BELITUNG": 2032.92, "KEPULAUAN RIAU": 2117.91,
    "JAKARTA": 2086.14, "JAWA BARAT": 2084.82, "JAWA TENGAH": 2028.44,
    "DAERAH ISTIMEWA YOGYAKARTA": 2066.00, "JAWA TIMUR": 2091.80,
    "BANTEN": 2147.88, "BALI": 2223.68, "NUSA TENGGARA BARAT": 2447.98,
    "NUSA TENGGARA TIMUR": 1974.01, "KALIMANTAN BARAT": 1893.68,
    "KALIMANTAN TENGAH": 2113.16, "KALIMANTAN SELATAN": 2171.82,
    "KALIMANTAN TIMUR": 1934.48, "KALIMANTAN UTARA": 1870.63,
    "SULAWESI UTARA": 2050.93, "SULAWESI TENGAH": 2016.05,
    "SULAWESI SELATAN": 2092.11, "SULAWESI TENGGARA": 1991.33,
    "GORONTALO": 1986.54, "SULAWESI BARAT": 2065.19,
    "MALUKU": 1852.28, "MALUKU UTARA": 1825.77,
    "PAPUA BARAT": 1813.42, "PAPUA BARAT DAYA": 1800.38,
    "PAPUA": 1744.82, "PAPUA SELATAN": 1874.55,
    "PAPUA TENGAH": 1760.35, "PAPUA PEGUNUNGAN": 2115.15,
}

# Estimasi INSECURITY (prevalensi ketidakcukupan pangan %)
# Sumber: BPS Var 1473 2025 — di sini pakai estimasi rasional
INSECURITY_PCT = {
    "ACEH": 8.6, "SUMATERA UTARA": 7.2, "SUMATERA BARAT": 6.1,
    "RIAU": 5.8, "JAMBI": 7.3, "SUMATERA SELATAN": 9.1,
    "BENGKULU": 8.2, "LAMPUNG": 8.9, "KEPULAUAN BANGKA BELITUNG": 5.4,
    "KEPULAUAN RIAU": 4.1, "JAKARTA": 3.2, "JAWA BARAT": 7.8,
    "JAWA TENGAH": 8.6, "DAERAH ISTIMEWA YOGYAKARTA": 6.3,
    "JAWA TIMUR": 8.5, "BANTEN": 6.9, "BALI": 4.2,
    "NUSA TENGGARA BARAT": 14.8, "NUSA TENGGARA TIMUR": 12.1,
    "KALIMANTAN BARAT": 9.4, "KALIMANTAN TENGAH": 6.7,
    "KALIMANTAN SELATAN": 5.2, "KALIMANTAN TIMUR": 4.9,
    "KALIMANTAN UTARA": 5.1, "SULAWESI UTARA": 6.3,
    "SULAWESI TENGAH": 9.8, "SULAWESI SELATAN": 6.8,
    "SULAWESI TENGGARA": 8.1, "GORONTALO": 10.2,
    "SULAWESI BARAT": 11.5, "MALUKU": 14.2, "MALUKU UTARA": 12.8,
    "PAPUA BARAT": 18.3, "PAPUA BARAT DAYA": 20.1,
    "PAPUA": 22.4, "PAPUA SELATAN": 19.6,
    "PAPUA TENGAH": 21.8, "PAPUA PEGUNUNGAN": 24.1,
}

# ─────────────────────────────────────────────────────────────
# SCORING FUNCTIONS (sama persis dengan pangan_views.py)
# ─────────────────────────────────────────────────────────────

def hitung_production_score(nilai, semua):
    vals = list(semua.values())
    mn, mx = min(vals), max(vals)
    if mx == mn:
        return 50.0
    return round(((nilai - mn) / (mx - mn)) * 100, 2)

def hitung_calorie_score(nilai, akg=2100):
    return round(min((nilai / akg) * 100, 100), 2)

def hitung_insecurity_score(nilai):
    return round(max(100 - nilai, 0), 2)

# ─────────────────────────────────────────────────────────────
# BUILD DATASET
# ─────────────────────────────────────────────────────────────

def build_dataset():
    provs = list(PRODUKSI_TON.keys())
    X_rows, y_labels, metadata = [], [], []

    for prov in provs:
        ps  = hitung_production_score(PRODUKSI_TON[prov], PRODUKSI_TON)
        ks  = hitung_calorie_score(KALORI_KKAL[prov])
        ins = hitung_insecurity_score(INSECURITY_PCT[prov])

        # Rule-based IKPG tanpa GeoAI (sebagai bootstrap label)
        ikpg_rule = round(0.60 * ps + 0.20 * ks + 0.20 * ins, 2)
        label = "Tinggi" if ikpg_rule >= 70 else "Sedang" if ikpg_rule >= 40 else "Rendah"

        X_rows.append([ps, ks, ins])
        y_labels.append(label)
        metadata.append({
            "provinsi": prov,
            "produksi_score": ps,
            "kalori_score": ks,
            "insecurity_score": ins,
            "ikpg_rule": ikpg_rule,
            "label_bootstrap": label,
        })

    return np.array(X_rows), y_labels, metadata, provs


# ─────────────────────────────────────────────────────────────
# TRAIN RANDOM FOREST
# ─────────────────────────────────────────────────────────────

def train_random_forest(X, y_labels):
    print("\n" + "="*50)
    print("TRAINING RANDOM FOREST (3 Fitur BPS)")
    print("="*50)

    le = LabelEncoder()
    y  = le.fit_transform(y_labels)

    print(f"Kelas: {le.classes_}")
    print(f"Distribusi: {Counter(y_labels)}")

    # Model utama — 3 fitur BPS
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        min_samples_split=3,
        min_samples_leaf=2,
        max_features="sqrt",
        class_weight="balanced",  # handle imbalanced classes
        random_state=42,
        oob_score=True,           # out-of-bag estimate
    )

    # Cross-validation (LOO karena data kecil = 38)
    loo    = LeaveOneOut()
    scores = cross_val_score(rf, X, y, cv=loo, scoring="accuracy")
    print(f"\nLOO Cross-Validation Accuracy: {scores.mean():.1%} ± {scores.std():.1%}")

    # Train final model
    rf.fit(X, y)
    print(f"OOB Score: {rf.oob_score_:.1%}")

    # Feature importance
    fi     = rf.feature_importances_
    fi_pct = {n: round(float(v)*100, 1)
              for n, v in zip(["produksi_score","kalori_score","insecurity_score"], fi)}
    print(f"\nFeature Importance (RF-learned, bukan manual):")
    for name, pct in fi_pct.items():
        bar = "█" * int(pct / 3)
        print(f"  {name:22s}: {pct:5.1f}% {bar}")

    # Classification report
    y_pred = rf.predict(X)
    print(f"\nClassification Report (Training):")
    print(classification_report(y, y_pred, target_names=le.classes_))

    return rf, le, fi_pct, scores.mean()


# ─────────────────────────────────────────────────────────────
# TRAIN K-MEANS (unsupervised validator)
# ─────────────────────────────────────────────────────────────

def train_kmeans(X, provs):
    print("\n" + "="*50)
    print("TRAINING K-MEANS (Unsupervised Validator, k=3)")
    print("="*50)

    scaler = StandardScaler()
    X_sc   = scaler.fit_transform(X)

    km = KMeans(n_clusters=3, random_state=42, n_init=20, max_iter=300)
    km.fit(X_sc)

    # Map cluster ke label ketahanan berdasarkan centroid produksi (fitur dominan)
    centroids     = scaler.inverse_transform(km.cluster_centers_)
    cluster_order = np.argsort(centroids[:, 0])  # sort by produksi_score

    cluster_labels = {}
    label_names    = ["Rendah", "Sedang", "Tinggi"]
    for rank, c_idx in enumerate(cluster_order):
        cluster_labels[int(c_idx)] = label_names[rank]

    print(f"\nCluster assignment:")
    for c_idx, lbl in cluster_labels.items():
        prov_in = [provs[i] for i, c in enumerate(km.labels_) if c == c_idx]
        print(f"  Cluster {c_idx} → '{lbl}': {', '.join(prov_in[:5])}{'...' if len(prov_in)>5 else ''}")

    print(f"\nInertia: {km.inertia_:.1f}")

    return km, scaler, cluster_labels


# ─────────────────────────────────────────────────────────────
# TRAIN RF WITH GEOAI (4 fitur — untuk prediksi real-time)
# ─────────────────────────────────────────────────────────────

def train_rf_with_geoai(rf_base, le):
    """
    RF untuk kasus dengan GeoAI.
    Karena tidak punya data GeoAI historis per provinsi, kita simulate
    berbagai skenario GeoAI untuk augmentasi dataset.
    """
    print("\n" + "="*50)
    print("TRAINING RF + GEOAI (4 Fitur — Augmented)")
    print("="*50)

    provs  = list(PRODUKSI_TON.keys())
    X_aug, y_aug = [], []

    for prov in provs:
        ps  = hitung_production_score(PRODUKSI_TON[prov], PRODUKSI_TON)
        ks  = hitung_calorie_score(KALORI_KKAL[prov])
        ins = hitung_insecurity_score(INSECURITY_PCT[prov])

        # Augmentasi: 5 skenario GeoAI per provinsi
        for geoai_sim in [10, 30, 50, 65, 80]:
            ikpg_sim = 0.50 * geoai_sim + 0.30 * ps + 0.10 * ks + 0.10 * ins
            label = "Tinggi" if ikpg_sim >= 70 else "Sedang" if ikpg_sim >= 40 else "Rendah"
            X_aug.append([ps, ks, ins, geoai_sim])
            y_aug.append(label)

    X_aug = np.array(X_aug)
    le_aug = LabelEncoder()
    y_enc  = le_aug.fit_transform(y_aug)

    print(f"Dataset augmented: {len(X_aug)} samples (38 prov × 5 skenario GeoAI)")
    print(f"Distribusi: {Counter(y_aug)}")

    rf_geoai = RandomForestClassifier(
        n_estimators=200, max_depth=8, min_samples_split=5,
        min_samples_leaf=2, max_features="sqrt",
        class_weight="balanced", random_state=42, oob_score=True,
    )

    # StratifiedKFold karena dataset lebih besar
    cv     = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(rf_geoai, X_aug, y_enc, cv=cv, scoring="accuracy")
    print(f"\n5-Fold CV Accuracy: {scores.mean():.1%} ± {scores.std():.1%}")

    rf_geoai.fit(X_aug, y_enc)
    print(f"OOB Score: {rf_geoai.oob_score_:.1%}")

    fi4    = rf_geoai.feature_importances_
    fi_pct = {n: round(float(v)*100, 1)
              for n, v in zip(["produksi_score","kalori_score","insecurity_score","geoai_score"], fi4)}
    print(f"\nFeature Importance (4 fitur):")
    for name, pct in fi_pct.items():
        bar = "█" * int(pct / 3)
        print(f"  {name:22s}: {pct:5.1f}% {bar}")

    return rf_geoai, le_aug, fi_pct, scores.mean()


# ─────────────────────────────────────────────────────────────
# SAVE MODELS
# ─────────────────────────────────────────────────────────────

def save_models(output_dir, rf3, le3, fi3, acc3, rf4, le4, fi4, acc4, km, scaler, cluster_labels, metadata):
    os.makedirs(output_dir, exist_ok=True)

    # Save RF 3 fitur (tanpa GeoAI)
    joblib.dump({"model": rf3, "label_encoder": le3}, os.path.join(output_dir, "rf_ikpg_model.pkl"))

    # Save RF 4 fitur (dengan GeoAI)
    joblib.dump({"model": rf4, "label_encoder": le4}, os.path.join(output_dir, "rf_ikpg_geoai_model.pkl"))

    # Save K-Means
    joblib.dump({"model": km, "scaler": scaler, "cluster_labels": cluster_labels},
                os.path.join(output_dir, "kmeans_ikpg_model.pkl"))

    # Metadata JSON
    meta = {
        "trained_at":          datetime.now().isoformat(),
        "sklearn_version":     __import__("sklearn").__version__,
        "total_provinces":     len(metadata),
        "rf_3feat": {
            "fitur":           ["produksi_score", "kalori_score", "insecurity_score"],
            "loo_accuracy":    round(float(acc3), 4),
            "feature_importance": fi3,
            "n_estimators":    200,
            "digunakan_jika":  "GeoAI tidak tersedia",
        },
        "rf_4feat": {
            "fitur":           ["produksi_score", "kalori_score", "insecurity_score", "geoai_score"],
            "cv5_accuracy":    round(float(acc4), 4),
            "feature_importance": fi4,
            "n_estimators":    200,
            "digunakan_jika":  "GeoAI tersedia",
            "augmented":       True,
        },
        "kmeans": {
            "k":               3,
            "cluster_labels":  cluster_labels,
            "fitur":           ["produksi_score", "kalori_score", "insecurity_score"],
            "normalized":      True,
        },
        "label_strategy":      "bootstrap_from_rule_based",
        "label_threshold":     {"Tinggi": "IKPG >= 70", "Sedang": "40 <= IKPG < 70", "Rendah": "IKPG < 40"},
        "training_data_source": {
            "produksi":        "BPS mms/557, 2024",
            "kalori":          "BPS Var 951, 2025",
            "insecurity":      "BPS Var 1473, 2025 (estimasi)",
        },
        "provinsi_training":   [m["provinsi"] for m in metadata],
        "dataset_sample":      metadata[:5],
    }

    meta_path = os.path.join(output_dir, "model_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*50}")
    print("MODEL TERSIMPAN:")
    for fname in ["rf_ikpg_model.pkl", "rf_ikpg_geoai_model.pkl", "kmeans_ikpg_model.pkl", "model_metadata.json"]:
        path = os.path.join(output_dir, fname)
        size = os.path.getsize(path) / 1024
        print(f"  ✓ {fname:35s} ({size:.1f} KB)")
    print(f"\nLokasi: {os.path.abspath(output_dir)}")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "ai_models")

    print("IKPG Machine Learning Training Script")
    print("Random Forest + K-Means | Bootstrap Labels dari BPS 2024/2025")
    print("="*50)

    # Build dataset
    X, y_labels, metadata, provs = build_dataset()

    # Train RF 3 fitur (tanpa GeoAI)
    rf3, le3, fi3, acc3 = train_random_forest(X, y_labels)

    # Train K-Means (unsupervised)
    km, scaler, cluster_labels = train_kmeans(X, provs)

    # Train RF 4 fitur (dengan GeoAI, augmented)
    rf4, le4, fi4, acc4 = train_rf_with_geoai(rf3, le3)

    # Save semua model
    save_models(OUTPUT_DIR, rf3, le3, fi3, acc3, rf4, le4, fi4, acc4,
                km, scaler, cluster_labels, metadata)

    print("\n✅ Training selesai. Jalankan server Django untuk menggunakan model.")
    print("   Endpoint baru: POST /api/predict-ikpg-ml/")