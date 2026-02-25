from django.urls import path
from . import views
from . import education_views
from . import health_views
from . import economy_views
from core import pangan_views

urlpatterns = [
    # AI DETECTION & FEATURES
    path('features/', views.feature_list, name='feature-list'),
    path('run-detection/', views.run_detection, name='run-detection'),
    path('save-detection/', views.save_detection, name='save-detection'),
    path('features/<str:feature_id>/', views.delete_feature, name='delete-feature'),

    # BOUNDARY DATA
    path('batas-provinsi/', views.batas_provinsi, name='batas-provinsi'),
    path('batas-kabupaten/', views.batas_kabupaten, name='batas-kabupaten'),

    # RBI DATA
    path('rbi-pendidikan/', views.rbi_pendidikan_list, name='rbi-pendidikan'),
    path('rbi-kesehatan/', views.rbi_kesehatan_list, name='rbi-kesehatan'),

    # EDUCATION ANALYSIS
    path('analyze-education-bps/', education_views.analyze_education_bps, name='analyze-education-bps'),
    path('save-education-analysis/', education_views.save_education_analysis, name='save-education-analysis'),
    path('education-analysis/list/', education_views.get_education_analysis_list, name='get-education-analysis-list'),
    path('education-analysis/<str:analysis_id>/', education_views.get_education_analysis_detail, name='get-education-analysis-detail'),
    path('education-analysis/<str:analysis_id>/delete/', education_views.delete_education_analysis, name='delete-education-analysis'),
    path('download-rls-xlsx/', education_views.download_rls_xlsx, name='download-rls-xlsx'),
    path('download-aps-xlsx/', education_views.download_aps_xlsx, name='download-aps-xlsx'),
    path('download-rasio-xlsx/', education_views.download_rasio_xlsx, name='download-rasio-xlsx'),

    # HEALTH ANALYSIS (BPS API)
    path('analyze-health-bps/', health_views.analyze_health_bps, name='analyze-health-bps'),
    path('save-health-analysis/', health_views.save_health_analysis, name='save-health-analysis'),
    path('health-analysis/list/', health_views.get_health_analysis_list, name='get-health-analysis-list'),
    path('health-analysis/<str:analysis_id>/', health_views.get_health_analysis_detail, name='get-health-analysis-detail'),
    path('health-analysis/<str:analysis_id>/delete/', health_views.delete_health_analysis, name='delete-health-analysis'),

    # EKONOMI ANALYSIS (BPS API)
    path('analyze-ekonomi-bps/', economy_views.analyze_ekonomi_bps, name='analyze-ekonomi-bps'),
    path('save-ekonomi-analysis/', economy_views.save_ekonomi_analysis, name='save-ekonomi-analysis'),
    path('ekonomi-analysis/list/', economy_views.get_ekonomi_analysis_list, name='get-ekonomi-analysis-list'),
    path('ekonomi-analysis/<str:analysis_id>/', economy_views.get_ekonomi_analysis_detail, name='get-ekonomi-analysis-detail'),
    path('ekonomi-analysis/<str:analysis_id>/delete/', economy_views.delete_ekonomi_analysis, name='delete-ekonomi-analysis'),

    # FOOD SECURITY ANALYSIS (BPS API — KETAHANAN PANGAN)
    path('debug-bps-pangan/', pangan_views.debug_bps_raw, name='debug-bps-pangan'),
    path('analyze-food-security-bps/', pangan_views.analyze_food_security_bps, name='analyze-food-security-bps'),
    path('analyze-all-provinces-bps/', pangan_views.analyze_all_provinces_bps, name='analyze-all-provinces-bps'),
    path('save-food-security-analysis/', pangan_views.save_food_security_analysis, name='save-food-security-analysis'),
    path('food-security-analysis/list/', pangan_views.get_food_security_analysis_list, name='get-food-security-analysis-list'),
    path('food-security-analysis/<str:analysis_id>/', pangan_views.get_food_security_analysis_detail, name='get-food-security-analysis-detail'),
    path('food-security-analysis/<str:analysis_id>/delete/', pangan_views.delete_food_security_analysis, name='delete-food-security-analysis'),
]