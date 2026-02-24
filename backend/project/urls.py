from django.contrib import admin
from django.urls import path, include
from accounts.views import social_login_callback

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('accounts/social/callback/', social_login_callback, name='social_callback'),
    
    path('accounts/', include('allauth.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/', include('core.urls')),
]