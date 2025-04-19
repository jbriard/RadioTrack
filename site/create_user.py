from passlib.context import CryptContext

# Configuration du contexte de hachage (identique à celui de votre auth.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fonction pour générer le hash
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# Exemple d'utilisation
password = "admin"
hashed_password = get_password_hash(password)
print(f"Mot de passe d'origine: {password}")
print(f"Hash du mot de passe: {hashed_password}")
