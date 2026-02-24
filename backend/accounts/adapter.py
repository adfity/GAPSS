from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def get_app(self, request, provider, client_id=None, **kwargs):
        
        try:
            return super().get_app(request, provider, client_id=client_id, **kwargs)
        except Exception:
            pass
        
        # Fallback ke settings/.env
        from allauth.socialaccount.models import SocialApp
        
        provider_config = settings.SOCIALACCOUNT_PROVIDERS.get(provider, {})
        app_config = provider_config.get('APP', {})
        
        app = SocialApp()
        app.provider = provider
        app.client_id = app_config.get('client_id', '')
        app.secret = app_config.get('secret', '')
        app.key = app_config.get('key', '')
        app.name = provider.capitalize()
        
        return app