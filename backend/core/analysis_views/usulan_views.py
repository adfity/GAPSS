from rest_framework.decorators import api_view
from rest_framework.response import Response
from pymongo import MongoClient
import psycopg2, psycopg2.extras
import os, json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env')))

MONGO_URI     = os.getenv("MONGO_URI")
DB_MONGO_NAME = os.getenv("DB_MONGO_NAME")
mongo_db      = MongoClient(MONGO_URI)[DB_MONGO_NAME]

def get_pg_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"), port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )

INDEKS_VALID   = ('ISDM', 'IKP')
STATUS_VALID   = ('SANGAT_TINGGI', 'TINGGI', 'SEDANG', 'RENDAH')          # SDM
STATUS_IKP     = ('SANGAT_RENTAN', 'RENTAN', 'AGAK_RENTAN', 'AGAK_TAHAN', 'TAHAN', 'SANGAT_TAHAN')
TIPE_VALID     = ('TAMBAH', 'EDIT', 'PROVINSI')
STATUS_USULAN  = ('PENDING', 'APPROVED', 'REJECTED')

# Mapping koleksi MongoDB & field properties per indeks
MONGO_COLLECTION = {
    'ISDM': 'sdm_analysis',
    'IKP':  'ikp_analysis',
}
MONGO_ANALYSIS_KEY = {
    'ISDM': 'sdm_analysis',
    'IKP':  'ikp_analysis',
}
MONGO_PROV_KEY = {
    'ISDM': 'nama_provinsi',
    'IKP':  'nama_provinsi',
}

# Tabel bank kebijakan per indeks
BANK_TABLE = {
    'ISDM': 'bank_kebijakan',       # kolom status = SANGAT_TINGGI/TINGGI/SEDANG/RENDAH
    'IKP':  'bank_kebijakan_ikp',   # kolom status = SANGAT_RENTAN / ... / SANGAT_TAHAN
}

def _serialize_usulan(row):
    """Konversi row dict dari psycopg2 ke format JSON-friendly."""
    d = dict(row)
    for k in ['dibuat_pada', 'diproses_pada']:
        if d.get(k) and hasattr(d[k], 'isoformat'):
            d[k] = d[k].isoformat()
    return d


# ─────────────────────────────────────────────────────────────────────────────
# USER: Kirim usulan kebijakan (universal — ISDM & IKP)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def kirim_usulan_kebijakan(request):
    """
    User mengirim usulan tambah / edit kebijakan bank global, atau
    usulan edit rekomendasi per provinsi.

    Body wajib:
      indeks            : 'ISDM' | 'IKP'  (default 'ISDM')
      tipe              : 'TAMBAH' | 'EDIT' | 'PROVINSI'
      catatan_user      : string (opsional)

    Jika TAMBAH:
      status_kebijakan, prioritas, pilar_kebijakan, isu_strategis,
      kebijakan, rekomendasi_program, indikator_terkait

    Jika EDIT:
      kebijakan_id (int) + field yang sama dengan TAMBAH (partial OK)

    Jika PROVINSI:
      analysis_id       : str
      nama_provinsi     : str
      rekomendasi_provinsi : list  (array pilar-aksi lengkap)
    """
    data   = request.data
    tipe   = data.get('tipe', '').upper()
    indeks = data.get('indeks', 'ISDM').upper()

    if indeks not in INDEKS_VALID:
        return Response({"error": f"indeks harus salah satu dari: {', '.join(INDEKS_VALID)}"}, status=400)
    if tipe not in TIPE_VALID:
        return Response({"error": f"tipe harus salah satu dari: {', '.join(TIPE_VALID)}"}, status=400)

    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        data_lama     = None
        kebijakan_id  = None
        analysis_id   = None
        nama_provinsi = None
        rek_provinsi  = None

        # ── EDIT: ambil snapshot data lama ──────────────────────────────────
        if tipe == 'EDIT':
            kebijakan_id = data.get('kebijakan_id')
            if not kebijakan_id:
                return Response({"error": "kebijakan_id wajib untuk tipe EDIT"}, status=400)
            tabel = BANK_TABLE[indeks]
            cur.execute(f"SELECT * FROM {tabel} WHERE id=%s", (kebijakan_id,))
            lama = cur.fetchone()
            if not lama:
                return Response({"error": "Kebijakan tidak ditemukan"}, status=404)
            data_lama = dict(lama)

        # ── PROVINSI ────────────────────────────────────────────────────────
        elif tipe == 'PROVINSI':
            analysis_id   = data.get('analysis_id')
            nama_provinsi = data.get('nama_provinsi', '').strip().upper()
            rek_provinsi  = data.get('rekomendasi_provinsi')
            if not analysis_id or not nama_provinsi:
                return Response({"error": "analysis_id dan nama_provinsi wajib untuk tipe PROVINSI"}, status=400)
            if not isinstance(rek_provinsi, list):
                return Response({"error": "rekomendasi_provinsi harus berupa array"}, status=400)

        # ── Insert usulan ────────────────────────────────────────────────────
        cur.execute("""
            INSERT INTO usulan_kebijakan (
                indeks, tipe, status,
                kebijakan_id,
                analysis_id, nama_provinsi,
                status_kebijakan, prioritas, pilar_kebijakan,
                isu_strategis, kebijakan, rekomendasi_program, indikator_terkait,
                rekomendasi_provinsi,
                catatan_user, dibuat_oleh, dibuat_pada, data_lama
            ) VALUES (
                %s, %s, 'PENDING',
                %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s,
                %s, %s, NOW(), %s
            ) RETURNING id
        """, (
            indeks, tipe,
            kebijakan_id,
            analysis_id, nama_provinsi,
            data.get('status_kebijakan'),
            data.get('prioritas'),
            data.get('pilar_kebijakan'),
            data.get('isu_strategis'),
            data.get('kebijakan'),
            data.get('rekomendasi_program'),
            data.get('indikator_terkait'),
            json.dumps(rek_provinsi) if rek_provinsi else None,
            data.get('catatan_user'),
            data.get('dibuat_oleh', 'user'),
            json.dumps(data_lama) if data_lama else None,
        ))
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        return Response({
            "status": "success",
            "id":     new_id,
            "pesan":  "Usulan berhasil dikirim dan menunggu persetujuan Admin.",
            "tipe":   tipe,
            "indeks": indeks,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# USER: Lihat usulan milik sendiri
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def list_usulan_saya(request):
    """
    Query params: indeks (ISDM|IKP), status, tipe, dibuat_oleh
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        indeks = request.GET.get('indeks', 'ISDM').upper()
        q      = "SELECT * FROM usulan_kebijakan WHERE indeks=%s"
        params = [indeks]

        dibuat_oleh = request.GET.get('dibuat_oleh')
        if dibuat_oleh:
            q += " AND dibuat_oleh=%s"; params.append(dibuat_oleh)

        sf = request.GET.get('status', '').upper()
        if sf in STATUS_USULAN:
            q += " AND status=%s"; params.append(sf)

        tf = request.GET.get('tipe', '').upper()
        if tf in TIPE_VALID:
            q += " AND tipe=%s"; params.append(tf)

        q += " ORDER BY dibuat_pada DESC LIMIT 100"
        cur.execute(q, params)
        rows = [_serialize_usulan(r) for r in cur.fetchall()]
        cur.close()
        return Response({"status": "success", "count": len(rows), "results": rows})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: Lihat semua usulan
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def list_usulan_admin(request):
    """
    Query params: indeks (ISDM|IKP), status, tipe
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        indeks = request.GET.get('indeks', 'ISDM').upper()
        q      = "SELECT * FROM usulan_kebijakan WHERE indeks=%s"
        params = [indeks]

        sf = request.GET.get('status', 'PENDING').upper()
        if sf in STATUS_USULAN:
            q += " AND status=%s"; params.append(sf)

        tf = request.GET.get('tipe', '').upper()
        if tf in TIPE_VALID:
            q += " AND tipe=%s"; params.append(tf)

        q += " ORDER BY dibuat_pada DESC"
        cur.execute(q, params)
        rows = [_serialize_usulan(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT COUNT(*) FROM usulan_kebijakan WHERE status='PENDING' AND indeks=%s",
            (indeks,)
        )
        pending_count = cur.fetchone()['count']
        cur.close()

        return Response({
            "status":        "success",
            "count":         len(rows),
            "pending_count": pending_count,
            "results":       rows,
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: Approve usulan
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def approve_usulan(request, usulan_id):
    """
    - TAMBAH  → insert ke bank_kebijakan / bank_kebijakan_ikp
    - EDIT    → update bank_kebijakan / bank_kebijakan_ikp
    - PROVINSI→ patch rekomendasi di MongoDB (sdm_analysis / ikp_analysis)
    Body: catatan_admin (opsional)
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT * FROM usulan_kebijakan WHERE id=%s", (usulan_id,))
        usulan = cur.fetchone()
        if not usulan:
            return Response({"error": "Usulan tidak ditemukan"}, status=404)
        if usulan['status'] != 'PENDING':
            return Response({"error": f"Usulan sudah {usulan['status']}"}, status=400)

        tipe    = usulan['tipe']
        indeks  = usulan['indeks']
        catatan = request.data.get('catatan_admin', '')
        tabel   = BANK_TABLE.get(indeks, 'bank_kebijakan')
        result_detail = {}

        # ── TAMBAH ──────────────────────────────────────────────────────────
        if tipe == 'TAMBAH':
            cur.execute(f"""
                INSERT INTO {tabel}
                    (status, prioritas, pilar_kebijakan, isu_strategis,
                     kebijakan, rekomendasi_program, indikator_terkait)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (
                usulan['status_kebijakan'] or ('SEDANG' if indeks == 'ISDM' else 'AGAK_RENTAN'),
                usulan['prioritas'] or 3,
                usulan['pilar_kebijakan'] or 'Umum',
                usulan['isu_strategis'],
                usulan['kebijakan'],
                usulan['rekomendasi_program'],
                usulan['indikator_terkait'] or ('ALL' if indeks == 'ISDM' else 'KETERSEDIAAN'),
            ))
            new_id = cur.fetchone()['id']
            result_detail = {"kebijakan_id_baru": new_id}

        # ── EDIT ────────────────────────────────────────────────────────────
        elif tipe == 'EDIT':
            kid = usulan['kebijakan_id']
            if not kid:
                return Response({"error": "kebijakan_id tidak ditemukan di usulan"}, status=400)
            fields, vals = [], []
            col_map = {
                'status_kebijakan': 'status',
                'prioritas':        'prioritas',
                'pilar_kebijakan':  'pilar_kebijakan',
                'isu_strategis':    'isu_strategis',
                'kebijakan':        'kebijakan',
                'rekomendasi_program': 'rekomendasi_program',
                'indikator_terkait': 'indikator_terkait',
            }
            for usulan_col, db_col in col_map.items():
                if usulan.get(usulan_col) is not None:
                    fields.append(f"{db_col}=%s")
                    vals.append(usulan[usulan_col])
            if not fields:
                return Response({"error": "Tidak ada field yang diubah"}, status=400)
            vals.append(kid)
            cur.execute(f"UPDATE {tabel} SET {', '.join(fields)} WHERE id=%s", vals)
            result_detail = {"kebijakan_id_diedit": kid}

        # ── PROVINSI ────────────────────────────────────────────────────────
        elif tipe == 'PROVINSI':
            analysis_id   = usulan['analysis_id']
            nama_provinsi = usulan['nama_provinsi']
            rek_baru      = usulan['rekomendasi_provinsi']  # JSONB → dict/list

            if not analysis_id or not nama_provinsi or rek_baru is None:
                return Response({"error": "Data provinsi tidak lengkap di usulan"}, status=400)

            collection_name = MONGO_COLLECTION.get(indeks, 'sdm_analysis')
            props_key       = MONGO_ANALYSIS_KEY.get(indeks, 'sdm_analysis')

            doc = mongo_db[collection_name].find_one({'analysis_id': analysis_id})
            if not doc:
                return Response({"error": "Analysis tidak ditemukan di MongoDB"}, status=404)

            features = doc.get('matched_features', {}).get('features', [])
            updated  = False
            now      = datetime.now().isoformat()
            for feat in features:
                props = feat.get('properties', {}).get(props_key, {})
                if props.get('nama_provinsi', '').upper().strip() == nama_provinsi.upper().strip():
                    props.update({
                        'rekomendasi':              rek_baru,
                        'rekomendasi_edited':        True,
                        'rekomendasi_edited_at':     now,
                        'rekomendasi_approved_by':   'admin',
                    })
                    feat['properties'][props_key] = props
                    updated = True
                    break

            if not updated:
                return Response({"error": f"Provinsi '{nama_provinsi}' tidak ditemukan"}, status=404)

            mongo_db[collection_name].update_one(
                {'analysis_id': analysis_id},
                {'$set': {'matched_features.features': features}}
            )
            result_detail = {"provinsi": nama_provinsi, "analysis_id": analysis_id, "indeks": indeks}

        # ── Update status usulan ─────────────────────────────────────────────
        cur.execute("""
            UPDATE usulan_kebijakan
            SET status='APPROVED', catatan_admin=%s,
                diproses_oleh='admin', diproses_pada=NOW()
            WHERE id=%s
        """, (catatan, usulan_id))
        conn.commit()
        cur.close()

        return Response({
            "status": "success",
            "pesan":  "Usulan disetujui dan diterapkan.",
            "tipe":   tipe,
            "indeks": indeks,
            **result_detail,
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        if conn: conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: Reject usulan
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
def reject_usulan(request, usulan_id):
    """Wajib sertakan catatan_admin sebagai alasan penolakan."""
    catatan = request.data.get('catatan_admin', '').strip()
    if not catatan:
        return Response({"error": "catatan_admin wajib diisi sebagai alasan penolakan"}, status=400)

    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        cur.execute("SELECT status FROM usulan_kebijakan WHERE id=%s", (usulan_id,))
        row = cur.fetchone()
        if not row:
            return Response({"error": "Usulan tidak ditemukan"}, status=404)
        if row[0] != 'PENDING':
            return Response({"error": f"Usulan sudah {row[0]}"}, status=400)

        cur.execute("""
            UPDATE usulan_kebijakan
            SET status='REJECTED', catatan_admin=%s,
                diproses_oleh='admin', diproses_pada=NOW()
            WHERE id=%s
        """, (catatan, usulan_id))
        conn.commit()
        cur.close()
        return Response({"status": "success", "pesan": "Usulan ditolak."})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: Detail satu usulan
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def detail_usulan(request, usulan_id):
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM usulan_kebijakan WHERE id=%s", (usulan_id,))
        row = cur.fetchone()
        if not row:
            return Response({"error": "Tidak ditemukan"}, status=404)
        cur.close()
        return Response({"status": "success", "data": _serialize_usulan(row)})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: Badge count pending
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
def count_pending_usulan(request):
    """
    Endpoint ringan untuk polling badge notifikasi admin.
    Query param: indeks (ISDM|IKP|ALL)
    Jika indeks=ALL → jumlahkan semua indeks.
    """
    conn = None
    try:
        conn = get_pg_connection()
        cur  = conn.cursor()
        indeks = request.GET.get('indeks', 'ISDM').upper()
        if indeks == 'ALL':
            cur.execute("SELECT COUNT(*) FROM usulan_kebijakan WHERE status='PENDING'")
        else:
            cur.execute(
                "SELECT COUNT(*) FROM usulan_kebijakan WHERE status='PENDING' AND indeks=%s",
                (indeks,)
            )
        count = cur.fetchone()[0]
        cur.close()
        return Response({"pending": count, "indeks": indeks})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if conn: conn.close()