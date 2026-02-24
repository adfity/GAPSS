from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .serializers import RegisterSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import MyTokenObtainPairSerializer
from django.shortcuts import redirect
from rest_framework_simplejwt.tokens import RefreshToken

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User berhasil didaftarkan!"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class LoginView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

def social_login_callback(request):
    if request.user.is_authenticated:
        refresh = RefreshToken.for_user(request.user)
        name = request.user.first_name or request.user.username
        
        url = f"http://localhost:3000/callback/?access={str(refresh.access_token)}&refresh={str(refresh)}&name={name}"
        return redirect(url)
    return redirect("http://localhost:3000/login?error=failed")