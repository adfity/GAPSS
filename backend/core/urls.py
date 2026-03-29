from django.urls import path
from . import views
from . import education_views
from . import health_views
from . import economy_views
from core import pangan_views
from . import views_area_scan

from core.scripts.waypoint_pendidikan import (
    WaypointPendidikanView,
    WaypointSchoolView,
    WaypointKindergartenView,
    WaypointCollegeView,
    WaypointUniversityView,
)

urlpatterns = [
    # AI DETECTION & FEATURES -
    path('features/', views.feature_list, name='feature-list'),
    path('run-detection/', views.run_detection, name='run-detection'),
    path('save-detection/', views.save_detection, name='save-detection'),
    path('features/<str:feature_id>/', views.delete_feature, name='delete-feature'),

    # BOUNDARY DATA -
    path('batas-provinsi/', views.batas_provinsi, name='batas-provinsi'),
    path('batas-kabupaten/', views.batas_kabupaten, name='batas-kabupaten'),

    # RBI DATA -
    path('rbi-pendidikan/', views.rbi_pendidikan_list, name='rbi-pendidikan'),
    path('rbi-kesehatan/', views.rbi_kesehatan_list, name='rbi-kesehatan'),

    # EDUCATION ANALYSIS -
    path('check-year-data/', education_views.check_year_data, name='check-year-data'),
    path('analyze-education-bps/', education_views.analyze_education_bps, name='analyze-education-bps'),
    path('save-education-analysis/', education_views.save_education_analysis, name='save-education-analysis'),
    path('education-analysis/list/', education_views.get_education_analysis_list, name='get-education-analysis-list'),
    path('education-analysis/<str:analysis_id>/', education_views.get_education_analysis_detail, name='get-education-analysis-detail'),
    path('education-analysis/<str:analysis_id>/delete/', education_views.delete_education_analysis, name='delete-education-analysis'),
    path('download-rls-xlsx/', education_views.download_rls_xlsx, name='download-rls-xlsx'),
    path('download-aps-xlsx/', education_views.download_aps_xlsx, name='download-aps-xlsx'),
    path('download-rasio-xlsx/', education_views.download_rasio_xlsx, name='download-rasio-xlsx'),

    # HEALTH ANALYSIS (BPS API) -
    path('check-health-data/', health_views.check_health_year_data, name='check-health-data'),
    path('analyze-health-bps/', health_views.analyze_health_bps,  name='analyze-health-bps'),
    path('save-health-analysis/', health_views.save_health_analysis, name='save-health-analysis'),
    path('health-analysis/list/', health_views.get_health_analysis_list, name='get-health-analysis-list'),
    path('health-analysis/<str:analysis_id>/', health_views.get_health_analysis_detail, name='get-health-analysis-detail'),
    path('health-analysis/<str:analysis_id>/delete/', health_views.delete_health_analysis, name='delete-health-analysis'),
    path('download-ahh-xlsx/', health_views.download_ahh_xlsx,  name='download-ahh-xlsx'),
    path('download-imunisasi-xlsx/', health_views.download_imunisasi_xlsx, name='download-imunisasi-xlsx'),
    path('download-sanitasi-xlsx/', health_views.download_sanitasi_xlsx,  name='download-sanitasi-xlsx'),

    # EKONOMI ANALYSIS (BPS API) -
    path('analyze-ekonomi-bps/', economy_views.analyze_ekonomi_bps, name='analyze-ekonomi-bps'),
    path('save-ekonomi-analysis/', economy_views.save_ekonomi_analysis, name='save-ekonomi-analysis'),
    path('ekonomi-analysis/list/', economy_views.get_ekonomi_analysis_list, name='get-ekonomi-analysis-list'),
    path('ekonomi-analysis/<str:analysis_id>/', economy_views.get_ekonomi_analysis_detail, name='get-ekonomi-analysis-detail'),
    path('ekonomi-analysis/<str:analysis_id>/delete/', economy_views.delete_ekonomi_analysis, name='delete-ekonomi-analysis'),
    path('historis-ekonomi/', economy_views.get_historis_ekonomi, name='historis-ekonomi'),

    # PANGAN: Cek data & analisis -
    path('check-year-data-pangan/',  pangan_views.check_year_data_pangan, name='check_year_data_pangan'),

    # Endpoint utama — auto-route ke BPS atau AI berdasarkan tahun
    path('analyze-pangan-bps/',      pangan_views.analyze_pangan_bps, name='analyze_pangan_bps'),

    # Endpoint AI langsung (bisa dipanggil eksplisit jika perlu)
    path('analyze-pangan-ai/',       pangan_views.analyze_pangan_ai, name='analyze_pangan_ai'),

    # Info model AI yang aktif
    path('pangan-ai-model-info/',    pangan_views.get_ai_model_info, name='pangan_ai_model_info'),

    # PANGAN: CRUD simpan / list / detail / hapus
    path('save-pangan-analysis/',    pangan_views.save_pangan_analysis, name='save_pangan_analysis'),
    path('pangan-analysis/list/',    pangan_views.get_pangan_analysis_list,name='get_pangan_analysis_list'),
    path('pangan-analysis/<str:analysis_id>/',        pangan_views.get_pangan_analysis_detail, name='get_pangan_analysis_detail'),
    path('pangan-analysis/<str:analysis_id>/delete/', pangan_views.delete_pangan_analysis, name='delete_pangan_analysis'),

    # PANGAN: Download dataset xlsx
    path('download-padi-xlsx/',      pangan_views.download_padi_xlsx, name='download_padi_xlsx'),
    path('download-konsumsi-xlsx/',  pangan_views.download_konsumsi_xlsx, name='download_konsumsi_xlsx'),
    path('download-penduduk-xlsx/',  pangan_views.download_penduduk_xlsx, name='download_penduduk_xlsx'),
    path('download-ikp-xlsx/',       pangan_views.download_ikp_xlsx, name='download_ikp_xlsx'),

    
    # AREA SCAN (GeoAI SAS Planet style) -
    path('area-scan/start/',    views_area_scan.area_scan_session,      name='area-scan-start'),
    path('area-scan/status/',   views_area_scan.area_scan_status,       name='area-scan-status'),
    path('area-scan/summary/',  views_area_scan.area_scan_summary,      name='area-scan-summary'),
    path('area-scan/sessions/', views_area_scan.area_scan_sessions_list, name='area-scan-sessions'),

     # ── WAYPOINT PENDIDIKAN ──────────────────────────────────────────────────
    # Semua kategori sekaligus
    path('waypoint/pendidikan/',             WaypointPendidikanView.as_view()),
    # Per sub-kategori
    path('waypoint/pendidikan/school/',      WaypointSchoolView.as_view()),
    path('waypoint/pendidikan/kindergarten/',WaypointKindergartenView.as_view()),
    path('waypoint/pendidikan/college/',     WaypointCollegeView.as_view()),
    path('waypoint/pendidikan/university/',  WaypointUniversityView.as_view()),
]
