from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from .models import Profile, BucketAvatarImage, BucketBannerImage, BucketPersonalImage

ONLINE_THRESHOLD = timedelta(minutes=3)



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email']


class ProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    avatar_url = serializers.SerializerMethodField()
    avatar_urls = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    banner_urls = serializers.SerializerMethodField()
    online_status = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'id', 'user_id', 'uuid', 'display_name', 'age', 'gender', 'bio',
            'avatar_url', 'avatar_urls', 'avatar_x', 'avatar_y',
            'banner_url', 'banner_urls', 'banner_x', 'banner_y',
            'location', 'looking_for', 'interests',
            'compatibility_score', 'online_status', 'type',
        ]
        read_only_fields = [
            'id', 'user_id', 'uuid', 'compatibility_score', 'type',
            'avatar_url', 'avatar_urls', 'banner_url', 'banner_urls',
            'online_status',
        ]

    def get_online_status(self, obj):
        if obj.type == 'ai':
            return obj.online_status
        # Human: online if last_seen within threshold
        if obj.last_seen is None:
            return False
        return (timezone.now() - obj.last_seen) < ONLINE_THRESHOLD

    def _abs_url(self, request, file_field):
        if not file_field:
            return None
        url = file_field.url
        return request.build_absolute_uri(url) if request else url

    def get_avatar_url(self, obj):
        img = obj.active_avatar
        return self._abs_url(self.context.get('request'), img.file if img else None)

    def get_banner_url(self, obj):
        img = obj.active_banner
        return self._abs_url(self.context.get('request'), img.file if img else None)

    def get_avatar_urls(self, obj):
        request = self.context.get('request')
        return [self._abs_url(request, img.file) for img in obj.avatar_images.all()]

    def get_banner_urls(self, obj):
        request = self.context.get('request')
        return [self._abs_url(request, img.file) for img in obj.banner_images.all()]
