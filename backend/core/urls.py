from django.urls import path

from . import views
from . import views_area_scan
from . import waypoint_views
# analisis
from .analysis_views import sdm_views
from .analysis_views import pangan_views
from .analysis_views import sda_views
from .analysis_views import economy_views


# analisis (nanti delet)
from .analysis_views import education_views
from .analysis_views import health_views
from .analysis_views import economy_test_views
# ---------------------------------------


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
    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    # SDM ANALYSIS -
    path('check-sdm-data/',                                 sdm_views.check_sdm_year_data,              name='check-sdm-data'),
    path('analyze-sdm-bps/',                                sdm_views.analyze_sdm_bps,                  name='analyze-sdm-bps'),
    path('save-sdm-analysis/',                              sdm_views.save_sdm_analysis,                name='save-sdm-analysis'),
    path('sdm-analysis/list/',                              sdm_views.get_sdm_analysis_list,            name='get-sdm-analysis-list'),
    path('sdm-analysis/<str:analysis_id>/',                 sdm_views.get_sdm_analysis_detail,          name='get-sdm-analysis-detail'),
    path('sdm-analysis/<str:analysis_id>/delete/',          sdm_views.delete_sdm_analysis,              name='delete-sdm-analysis'),
    path('bank-kebijakan-sdm/',                             sdm_views.get_bank_kebijakan_sdm,           name='bank-kebijakan-sdm'),
    path('bank-kebijakan-sdm/add/',                         sdm_views.add_bank_kebijakan_sdm,           name='add-bank-kebijakan-sdm'),
    path('bank-kebijakan-sdm/<int:kebijakan_id>/update/',   sdm_views.update_bank_kebijakan_sdm,        name='update-bank-kebijakan-sdm'),
    path('bank-kebijakan-sdm/<int:kebijakan_id>/delete/',   sdm_views.delete_bank_kebijakan_sdm,        name='delete-bank-kebijakan-sdm'),
    path('bank-kebijakan-isdm-provinsi/',                   sdm_views.get_bank_kebijakan_isdm_for_provinsi, name='bank-kebijakan-isdm-provinsi'),
    path('sdm-analysis/<str:analysis_id>/provinsi-kebijakan/', sdm_views.patch_provinsi_kebijakan,name='patch-provinsi-kebijakan'),
    # SDM ARIMA v4.0
    path('predict-sdm-arima/',                              sdm_views.predict_sdm_arima,                name='predict-sdm-arima'),
    path('arima-model-info/',                               sdm_views.get_arima_model_info,             name='arima-model-info'),
   
    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    # PANGAN / IKP ANALYSIS
    path('check-pangan-data/',                                  pangan_views.check_pangan_year_data,              name='check-pangan-data'),
    path('analyze-pangan-bps/',                                 pangan_views.analyze_pangan_bps,                  name='analyze-pangan-bps'),
    path('save-pangan-analysis/',                               pangan_views.save_pangan_analysis,                name='save-pangan-analysis'),
    path('pangan-analysis/list/',                               pangan_views.get_pangan_analysis_list,            name='get-pangan-analysis-list'),
    path('pangan-analysis/<str:analysis_id>/',                  pangan_views.get_pangan_analysis_detail,          name='get-pangan-analysis-detail'),
    path('pangan-analysis/<str:analysis_id>/delete/',           pangan_views.delete_pangan_analysis,              name='delete-pangan-analysis'),
    path('bank-kebijakan-ikp/',                                 pangan_views.get_bank_kebijakan_ikp,              name='bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/add/',                             pangan_views.add_bank_kebijakan_ikp,              name='add-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/<int:kebijakan_id>/update/',       pangan_views.update_bank_kebijakan_ikp,           name='update-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/<int:kebijakan_id>/delete/',       pangan_views.delete_bank_kebijakan_ikp,           name='delete-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp-provinsi/',                        pangan_views.get_bank_kebijakan_ikp_for_provinsi, name='bank-kebijakan-ikp-provinsi'),
    path('pangan-analysis/<str:analysis_id>/provinsi-kebijakan/', pangan_views.patch_provinsi_kebijakan_pangan,   name='patch-provinsi-kebijakan-pangan'),
    # PANGAN ARIMA
    path('predict-pangan-arima/',                               pangan_views.predict_pangan_arima,                name='predict-pangan-arima'),
    path('pangan-arima-info/',                                  pangan_views.get_pangan_arima_info,               name='pangan-arima-info'),
    # ---------------------------------------------------------------------------------------------------------


    # ---------------------------------------------------------------------------------------------------------
    # SDA ANALYSIS
    path('check-sda-data/',                         sda_views.check_sda_data,            name='check-sda-data'),
    path('analyze-sda-bps/',                        sda_views.analyze_sda_bps,           name='analyze-sda-bps'),
    path('save-sda-analysis/',                      sda_views.save_sda_analysis,         name='save-sda-analysis'),
    path('sda-analysis/list/',                      sda_views.get_sda_analysis_list,     name='get-sda-analysis-list'),
    path('sda-analysis/<str:analysis_id>/',         sda_views.get_sda_analysis_detail,   name='get-sda-analysis-detail'),
    path('sda-analysis/<str:analysis_id>/delete/',  sda_views.delete_sda_analysis,       name='delete-sda-analysis'),
    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    # EKONOMI ANALYSIS
    path('check-ekon-data/',                          economy_views.check_ekon_year_data,      name='check-ekon-data'),
    path('analyze-ekon-bps/',                         economy_views.analyze_ekon_bps,          name='analyze-ekon-bps'),
    path('save-ekon-analysis/',                       economy_views.save_ekon_analysis,        name='save-ekon-analysis'),
    path('ekon-analysis/list/',                       economy_views.get_ekon_analysis_list,    name='get-ekon-analysis-list'),
    path('ekon-analysis/<str:analysis_id>/',          economy_views.get_ekon_analysis_detail,  name='get-ekon-analysis-detail'),
    path('ekon-analysis/<str:analysis_id>/delete/',   economy_views.delete_ekon_analysis,      name='delete-ekon-analysis'),
    # ---------------------------------------------------------------------------------------------------------



# NANTI HAPUS ----------------------------------
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

    # EKONOMI ANALYSIS (BPS API)
    path('check-ekonomi-data/',          economy_test_views.check_ekonomi_year_data,    name='check-ekonomi-data'),
    path('analyze-ekonomi-bps/',         economy_test_views.analyze_ekonomi_bps,        name='analyze-ekonomi-bps'),
    path('save-ekonomi-analysis/',       economy_test_views.save_ekonomi_analysis,      name='save-ekonomi-analysis'),
    path('ekonomi-analysis/list/',       economy_test_views.get_ekonomi_analysis_list,  name='get-ekonomi-analysis-list'),
    path('ekonomi-analysis/<str:analysis_id>/',        economy_test_views.get_ekonomi_analysis_detail, name='get-ekonomi-analysis-detail'),
    path('ekonomi-analysis/<str:analysis_id>/delete/', economy_test_views.delete_ekonomi_analysis,     name='delete-ekonomi-analysis'),
    path('historis-ekonomi/',            economy_test_views.get_historis_ekonomi,       name='historis-ekonomi'),
    path('bank-kebijakan/',              economy_test_views.get_bank_kebijakan2,         name='get-bank-kebijakan'),
    # Download XLSX per indikator ekonomi
    path('download-pdrb-xlsx/',          economy_test_views.download_pdrb_xlsx,         name='download-pdrb-xlsx'),
    path('download-kemiskinan-xlsx/',    economy_test_views.download_kemiskinan_xlsx,   name='download-kemiskinan-xlsx'),
    path('download-investasi-xlsx/',     economy_test_views.download_investasi_xlsx,    name='download-investasi-xlsx'),
# NANTI HAPUS ----------------------------------


    # ---------------------------------------------------------------------------------------------------------
    # AREA SCAN (GeoAI SAS Planet style) -
    path('area-scan/start/',    views_area_scan.area_scan_session,      name='area-scan-start'),
    path('area-scan/status/',   views_area_scan.area_scan_status,       name='area-scan-status'),
    path('area-scan/summary/',  views_area_scan.area_scan_summary,      name='area-scan-summary'),
    path('area-scan/sessions/', views_area_scan.area_scan_sessions_list, name='area-scan-sessions'),
    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    #  WAYPOINT PENDIDIKAN 
    path('waypoint/pendidikan/',              waypoint_views.waypoint_pendidikan),
    path('waypoint/pendidikan/sd/',           waypoint_views.waypoint_sd),
    path('waypoint/pendidikan/smp/',          waypoint_views.waypoint_smp),
    path('waypoint/pendidikan/sma/',          waypoint_views.waypoint_sma),
    path('waypoint/pendidikan/smk/',          waypoint_views.waypoint_smk),
    path('waypoint/pendidikan/kindergarten/', waypoint_views.waypoint_kindergarten),
    path('waypoint/pendidikan/college/',      waypoint_views.waypoint_college),
    path('waypoint/pendidikan/university/',   waypoint_views.waypoint_university),
 
    #  WAYPOINT KESEHATAN
    path('waypoint/kesehatan/',              waypoint_views.waypoint_kesehatan),
    path('waypoint/kesehatan/hospital/',     waypoint_views.waypoint_hospital),
    path('waypoint/kesehatan/clinic/',       waypoint_views.waypoint_clinic),
    path('waypoint/kesehatan/health-post/',  waypoint_views.waypoint_health_post),
    path('waypoint/kesehatan/pharmacy/',     waypoint_views.waypoint_pharmacy),
 
    #  WAYPOINT KANTOR PEMERINTAHAN
    path('waypoint/pemerintahan/',                   waypoint_views.waypoint_pemerintahan),
    path('waypoint/pemerintahan/townhall/',          waypoint_views.waypoint_townhall),
    path('waypoint/pemerintahan/village-office/',    waypoint_views.waypoint_village_office),
    path('waypoint/pemerintahan/government-office/', waypoint_views.waypoint_government_office),
    path('waypoint/pemerintahan/ministry/',          waypoint_views.waypoint_ministry),
    path('waypoint/pemerintahan/police/',            waypoint_views.waypoint_police),
    path('waypoint/pemerintahan/fire-station/',      waypoint_views.waypoint_fire_station),
    path('waypoint/pemerintahan/courthouse/',        waypoint_views.waypoint_courthouse),
    path('waypoint/pemerintahan/customs/',           waypoint_views.waypoint_customs),
    path('waypoint/pemerintahan/immigration/',       waypoint_views.waypoint_immigration),
    path('waypoint/pemerintahan/tax-office/',        waypoint_views.waypoint_tax_office),
    path('waypoint/pemerintahan/legislative/',       waypoint_views.waypoint_legislative),
 
    #  WAYPOINT MBG
    path('waypoint/mbg/',                  waypoint_views.waypoint_mbg),
    path('waypoint/mbg/community-centre/', waypoint_views.waypoint_mbg_community_centre),
    path('waypoint/mbg/kitchen/',          waypoint_views.waypoint_mbg_kitchen),
    path('waypoint/mbg/food-centre/',      waypoint_views.waypoint_mbg_food_centre),
    path('waypoint/mbg/nutrition-centre/', waypoint_views.waypoint_mbg_nutrition_centre),
    path('waypoint/mbg/canteen/',          waypoint_views.waypoint_mbg_canteen),
 
    #  WAYPOINT PERTAHANAN 
    path('waypoint/pertahanan/',               waypoint_views.waypoint_pertahanan),
    path('waypoint/pertahanan/base/',          waypoint_views.waypoint_military_base),
    path('waypoint/pertahanan/barracks/',      waypoint_views.waypoint_military_barracks),
    path('waypoint/pertahanan/checkpoint/',    waypoint_views.waypoint_military_checkpoint),
    path('waypoint/pertahanan/office/',        waypoint_views.waypoint_military_office),
    path('waypoint/pertahanan/training-area/', waypoint_views.waypoint_military_training),
    path('waypoint/pertahanan/airfield/',      waypoint_views.waypoint_airfield),
    path('waypoint/pertahanan/naval-base/',    waypoint_views.waypoint_naval_base),
    # ---------------------------------------------------------------------------------------------------------
]