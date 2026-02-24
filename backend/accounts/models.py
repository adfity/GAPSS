from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Menambahkan pilihan Role
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('user', 'User'),
    )
    
    # Field tambahan sesuai kebutuhan frontend kamu
    email = models.EmailField(unique=True) # Email jadi unik untuk login
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    
    # Kita gunakan Email sebagai username utama untuk login
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return f"{self.email} - {self.role}"