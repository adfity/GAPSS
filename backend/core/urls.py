from django.urls import path

from . import views
from . import views_area_scan
from . import waypoint_views
# analisis
from .analysis_views import sdm_views
from .analysis_views import pangan_views
from .analysis_views import iska_views
from .analysis_views import ipe_views
from core.analysis_views import usulan_views

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
    path('sdm-analysis/<str:analysis_id>/provinsi-kebijakan/', sdm_views.patch_provinsi_kebijakan,      name='patch-provinsi-kebijakan'),
    path('ols-model-info/',                                 sdm_views.get_ols_model_info,               name='ols-model-info'),
    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    # IKP ANALYSIS
    path('check-ikp-data/',                                   pangan_views.check_ikp_year_data,             name='check-ikp-data'),
    path('analyze-ikp/',                                      pangan_views.analyze_ikp,                     name='analyze-ikp'),
    path('save-ikp-analysis/',                                pangan_views.save_ikp_analysis,               name='save-ikp-analysis'),
    path('ikp-analysis/list/',                                pangan_views.get_ikp_analysis_list,           name='get-ikp-analysis-list'),
    path('ikp-analysis/<str:analysis_id>/',                   pangan_views.get_ikp_analysis_detail,         name='get-ikp-analysis-detail'),
    path('ikp-analysis/<str:analysis_id>/delete/',            pangan_views.delete_ikp_analysis,             name='delete-ikp-analysis'),
    path('bank-kebijakan-ikp/',                               pangan_views.get_bank_kebijakan_ikp,          name='bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/add/',                           pangan_views.add_bank_kebijakan_ikp,          name='add-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/<int:kebijakan_id>/update/',     pangan_views.update_bank_kebijakan_ikp,       name='update-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp/<int:kebijakan_id>/delete/',     pangan_views.delete_bank_kebijakan_ikp,       name='delete-bank-kebijakan-ikp'),
    path('bank-kebijakan-ikp-provinsi/',                      pangan_views.get_bank_kebijakan_ikp_for_provinsi, name='bank-kebijakan-ikp-provinsi'),
    path('ikp-analysis/<str:analysis_id>/provinsi-kebijakan/', pangan_views.patch_provinsi_kebijakan_ikp,   name='patch-provinsi-kebijakan-ikp'),
    path('ols-model-info-ikp/',                               pangan_views.get_ols_model_info_ikp,          name='holt-model-info-ikp'),
    # ---------------------------------------------------------------------------------------------------------


    # ---------------------------------------------------------------------------------------------------------
    # ── ISKA ANALYSIS ──────────────────────────────────────────────────────────
    path('check-iska-data/',                                    iska_views.check_iska_year_data,               name='check-iska-data'),
    path('analyze-iska/',                                       iska_views.analyze_iska,                       name='analyze-iska'),
    path('save-iska-analysis/',                                 iska_views.save_iska_analysis,                 name='save-iska-analysis'),
    path('iska-analysis/list/',                                 iska_views.get_iska_analysis_list,             name='get-iska-analysis-list'),
    path('iska-analysis/<str:analysis_id>/',                    iska_views.get_iska_analysis_detail,           name='get-iska-analysis-detail'),
    path('iska-analysis/<str:analysis_id>/delete/',             iska_views.delete_iska_analysis,               name='delete-iska-analysis'),
    path('bank-kebijakan-iska/',                                iska_views.get_bank_kebijakan_iska,            name='bank-kebijakan-iska'),
    path('bank-kebijakan-iska/add/',                            iska_views.add_bank_kebijakan_iska,            name='add-bank-kebijakan-iska'),
    path('bank-kebijakan-iska/<int:kebijakan_id>/update/',      iska_views.update_bank_kebijakan_iska,         name='update-bank-kebijakan-iska'),
    path('bank-kebijakan-iska/<int:kebijakan_id>/delete/',      iska_views.delete_bank_kebijakan_iska,         name='delete-bank-kebijakan-iska'),
    path('bank-kebijakan-iska-provinsi/',                       iska_views.get_bank_kebijakan_iska_for_provinsi, name='bank-kebijakan-iska-provinsi'),
    path('iska-analysis/<str:analysis_id>/provinsi-kebijakan/', iska_views.patch_provinsi_kebijakan_iska,      name='patch-provinsi-kebijakan-iska'),
    path('ols-model-info-iska/',                                iska_views.get_ols_model_info_iska,            name='ols-model-info-iska'),

    # ---------------------------------------------------------------------------------------------------------

    # ---------------------------------------------------------------------------------------------------------
    # IPE ANALYSIS -
    path('check-ipe-data/',                                 ipe_views.check_ipe_year_data,                  name='check-ipe-data'),
    path('analyze-ipe/',                                    ipe_views.analyze_ipe,                          name='analyze-ipe'),
    path('save-ipe-analysis/',                              ipe_views.save_ipe_analysis,                    name='save-ipe-analysis'),
    path('ipe-analysis/list/',                              ipe_views.get_ipe_analysis_list,                name='get-ipe-analysis-list'),
    path('ipe-analysis/<str:analysis_id>/',                 ipe_views.get_ipe_analysis_detail,              name='get-ipe-analysis-detail'),
    path('ipe-analysis/<str:analysis_id>/delete/',          ipe_views.delete_ipe_analysis,                  name='delete-ipe-analysis'),
    path('bank-kebijakan-ipe/',                             ipe_views.get_bank_kebijakan_ipe,               name='bank-kebijakan-ipe'),
    path('bank-kebijakan-ipe/add/',                         ipe_views.add_bank_kebijakan_ipe,               name='add-bank-kebijakan-ipe'),
    path('bank-kebijakan-ipe/<int:kebijakan_id>/update/',   ipe_views.update_bank_kebijakan_ipe,            name='update-bank-kebijakan-ipe'),
    path('bank-kebijakan-ipe/<int:kebijakan_id>/delete/',   ipe_views.delete_bank_kebijakan_ipe,            name='delete-bank-kebijakan-ipe'),
    path('bank-kebijakan-iipe-provinsi/',                   ipe_views.get_bank_kebijakan_ipe_for_provinsi,  name='bank-kebijakan-iipe-provinsi'),
    path('ipe-analysis/<str:analysis_id>/provinsi-kebijakan/', ipe_views.patch_provinsi_kebijakan_ipe,      name='patch-provinsi-kebijakan'),
    path('ols-model-info/',                                 ipe_views.get_ols_model_info_ipe,               name='ols-model-info'),

    # ── USER: kirim & lihat usulan ──────────────────────────────────────────
    path('usulan/kirim/',                     usulan_views.kirim_usulan_kebijakan,    name='kirim-usulan-kebijakan'),
    path('usulan/saya/',                      usulan_views.list_usulan_saya,          name='list-usulan-saya'),
    # ── ADMIN: kelola usulan ────────────────────────────────────────────────
    path('usulan/admin/list/',                usulan_views.list_usulan_admin,         name='list-usulan-admin'),
    path('usulan/admin/pending-count/',       usulan_views.count_pending_usulan,      name='count-pending-usulan'),
    path('usulan/<int:usulan_id>/',           usulan_views.detail_usulan,             name='detail-usulan'),
    path('usulan/<int:usulan_id>/approve/',   usulan_views.approve_usulan,            name='approve-usulan'),
    path('usulan/<int:usulan_id>/reject/',    usulan_views.reject_usulan,             name='reject-usulan'),

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