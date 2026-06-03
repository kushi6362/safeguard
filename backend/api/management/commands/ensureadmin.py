import os
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Creates a superuser from ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD env vars'

    def handle(self, *args, **options):
        username = os.getenv('ADMIN_USERNAME', '').strip()
        email = os.getenv('ADMIN_EMAIL', '').strip()
        password = os.getenv('ADMIN_PASSWORD', '').strip()

        if not username or not password:
            self.stdout.write('ADMIN_USERNAME or ADMIN_PASSWORD not set, skipping')
            return

        if User.objects.filter(username=username).exists():
            self.stdout.write(f'Superuser "{username}" already exists, skipping')
            return

        User.objects.create_superuser(username=username, email=email or f'{username}@example.com', password=password)
        self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" created'))
