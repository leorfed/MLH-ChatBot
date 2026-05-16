from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Profile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(blank=True, max_length=100)),
                ('age', models.IntegerField(default=20)),
                ('gender', models.CharField(blank=True, max_length=50)),
                ('bio', models.TextField(blank=True)),
                ('avatar_url', models.URLField(blank=True)),
                ('location', models.CharField(blank=True, max_length=100)),
                ('looking_for', models.CharField(blank=True, max_length=100)),
                ('interests', models.JSONField(default=list)),
                ('compatibility_score', models.FloatField(default=0)),
                ('online_status', models.BooleanField(default=True)),
                ('type', models.CharField(
                    choices=[('human', 'Human'), ('ai', 'AI')],
                    default='human',
                    max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
