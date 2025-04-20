from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta 
import os

from database import get_db, create_tables, User
from auth import (
    authenticate_user, create_access_token, get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, get_password_hash, UserCreate, Token
)

# Import des routes
from routes.radio import router as radio_router
from routes.equipe import router as equipe_router
from routes.personne import router as personne_router
from routes.pret import router as pret_router  # Nouvelle importation pour les prêts
from routes.cfi import router as cfi_router    # Nouvelle importation pour les CFIs
from routes.etiquette import router as etiquette_router
from routes.historique import router as historique_router
from routes.maintenance import router as maintenance_router  # Nouvelle importation pour la maintenance


# Création de l'application FastAPI
app = FastAPI(title="Mon Application FastAPI")

# Ajout des routes API
app.include_router(radio_router)
app.include_router(equipe_router)
app.include_router(personne_router)
app.include_router(pret_router)  # Ajout du routeur pour les prêts
app.include_router(cfi_router)   # Ajout du routeur pour les CFIs
app.include_router(etiquette_router)  # Ajout du routeur pour les étiquettes
app.include_router(historique_router)
app.include_router(maintenance_router)

# Création des tables de base de données
create_tables()

# Configuration des fichiers statiques et des templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Route d'accueil
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Route de login (formulaire)
@app.get("/login", response_class=HTMLResponse)
async def login_form(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

# Route d'authentification (API)
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Création du token JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # Mise à jour de la dernière connexion
    user.last_login = datetime.now()
    db.commit()
    
    # Créer une réponse de redirection avec le statut 303 (See Other)
    # Le code 303 force le navigateur à effectuer une requête GET sur l'URL de redirection
    response = RedirectResponse(url="/dashboard", status_code=303)
    
    # Définition du cookie avec le token
    response.set_cookie(
        key="access_token", 
        value=f"Bearer {access_token}", 
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax"  # Protection contre les attaques CSRF
    )
    
    return response

# Route d'inscription
@app.post("/register")
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Vérification si l'utilisateur existe déjà
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà utilisé")

    # Vérification de l'email
    db_email = db.query(User).filter(User.email == user_data.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    # Création du nouvel utilisateur
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Utilisateur créé avec succès"}

# Route pour le tableau de bord (page d'accueil après connexion)
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "dashboard.html", 
        {"request": request, "user": current_user}
    )

# Route pour la page de gestion des radios
@app.get("/radios", response_class=HTMLResponse)
async def radios_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "radios.html",
        {"request": request, "user": current_user}
    )

# Route pour la page de gestion des équipes
@app.get("/equipes", response_class=HTMLResponse)
async def equipes_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "equipes.html",
        {"request": request, "user": current_user}
    )

# Route pour la page de gestion des personnes
@app.get("/personnes", response_class=HTMLResponse)
async def personnes_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "personnes.html",
        {"request": request, "user": current_user}
    )

# Route pour la page de gestion des prêts/retours
@app.get("/prets", response_class=HTMLResponse)
async def prets_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "prets.html",
        {"request": request, "user": current_user}
    )

# Route pour la page de gestion des CFIs
@app.get("/cfis", response_class=HTMLResponse)
async def cfis_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "cfis.html",
        {"request": request, "user": current_user}
    )

# Route pour la page d'impression d'étiquettes
@app.get("/etiquettes", response_class=HTMLResponse)
async def etiquettes_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "etiquettes.html",
        {"request": request, "user": current_user}
    )


# Route pour la page d'export CSV
@app.get("/export", response_class=HTMLResponse)
async def export_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "export.html",
        {"request": request, "user": current_user}
    )

@app.get("/historique", response_class=HTMLResponse)
async def historique_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "historique.html",
        {"request": request, "user": current_user}
    )

@app.get("/maintenance", response_class=HTMLResponse)
async def maintenance_page(request: Request, current_user: User = Depends(get_current_active_user)):
    return templates.TemplateResponse(
        "maintenance.html",
        {"request": request, "user": current_user}
    )


# Route de déconnexion
@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response

# Point d'entrée pour exécuter avec Uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)