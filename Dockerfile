FROM python:3.13.7-slim


LABEL version="1.0"
LABEL description="Application de gestion des radios SNSM"
LABEL com.example.vendor="SNSM"
LABEL org.opencontainers.image.authors="justin@briard.email"

# Installation des dépendances système pour les bibliothèques Python
RUN apt-get update && apt-get install -y

# Répertoire de travail
WORKDIR /app

# Copie du fichier requirements.txt 
COPY requirements.txt .

# Installation des dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie de tout le code de l'application
COPY site/ .

# Port exposé cohérent avec votre application (8200 par défaut)
EXPOSE 8200

# Commande de démarrage
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8200"]