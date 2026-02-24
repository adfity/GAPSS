from django.apps import AppConfig

class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(setup_site, sender=self)

def setup_site(sender, **kwargs):
    try:
        from django.contrib.sites.models import Site
        import os
        
        domain = os.getenv('SITE_DOMAIN')
        name = os.getenv('SITE_NAME')

        Site.objects.update_or_create(
            id=1,
            defaults={'domain': domain, 'name': name}
        )
    except Exception:
        pass  # Skip kalau tabel belum ada