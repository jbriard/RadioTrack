from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db, Equipe, Personne
from auth import get_current_active_user, User

router = APIRouter(prefix="/api/equipes", tags=["equipes"])

# Modèles Pydantic pour la validation et la sérialisation des données
class EquipeBase(BaseModel):
    nom: str
    categorie: str

class EquipeCreate(EquipeBase):
    pass

class EquipeUpdate(BaseModel):
    nom: Optional[str] = None
    categorie: Optional[str] = None

class PersonneBase(BaseModel):
    id: int
    code_barre: str
    nom: str
    prenom: str

    class Config:
        orm_mode = True

class EquipeResponse(EquipeBase):
    id: int
    date_creation: datetime
    date_modification: datetime

    class Config:
        orm_mode = True

class EquipeDetailResponse(EquipeResponse):
    membres: List[PersonneBase] = []
    
    class Config:
        orm_mode = True

# Fonction utilitaire pour vérifier si une équipe existe
def get_equipe(db: Session, equipe_id: int):
    equipe = db.query(Equipe).filter(Equipe.id == equipe_id).first()
    if not equipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Équipe avec l'ID {equipe_id} non trouvée"
        )
    return equipe

# Routes pour la gestion des équipes
@router.get("/", response_model=List[EquipeResponse])
async def list_equipes(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    categorie: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des équipes avec filtres optionnels
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    query = db.query(Equipe)
    
    # Appliquer les filtres si fournis
    if search:
        search_term = f"%{search}%"
        query = query.filter(Equipe.nom.ilike(search_term))
    
    if categorie:
        query = query.filter(Equipe.categorie == categorie)
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer pagination
    equipes = query.offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    equipes_data = jsonable_encoder(equipes)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=equipes_data,
        headers={"X-Total-Count": str(total_count)}
    )

@router.get("/{equipe_id}", response_model=EquipeDetailResponse)
async def get_equipe_details(
    equipe_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'une équipe spécifique avec ses membres
    """
    equipe = get_equipe(db, equipe_id)
    
    # Chercher les membres de l'équipe
    membres = db.query(Personne).filter(Personne.id_equipe == equipe_id).all()
    
    # Créer la réponse avec les détails et les membres
    response = EquipeDetailResponse(
        id=equipe.id,
        nom=equipe.nom,
        categorie=equipe.categorie,
        date_creation=equipe.date_creation,
        date_modification=equipe.date_modification,
        membres=[PersonneBase(
            id=membre.id,
            code_barre=membre.code_barre,
            nom=membre.nom,
            prenom=membre.prenom
        ) for membre in membres]
    )
    
    return response

@router.post("/", response_model=EquipeResponse, status_code=status.HTTP_201_CREATED)
async def create_equipe(
    equipe_data: EquipeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer une nouvelle équipe
    """
    # Valider la catégorie
    valid_categories = ['secours', 'logistique', 'direction', 'externe']
    if equipe_data.categorie not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La catégorie doit être l'une des suivantes: {', '.join(valid_categories)}"
        )
    
    # Vérifier si une équipe avec le même nom existe déjà
    existing_equipe = db.query(Equipe).filter(Equipe.nom == equipe_data.nom).first()
    if existing_equipe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une équipe avec ce nom existe déjà"
        )
    
    # Créer la nouvelle équipe
    new_equipe = Equipe(
        nom=equipe_data.nom,
        categorie=equipe_data.categorie
    )
    
    db.add(new_equipe)
    db.commit()
    db.refresh(new_equipe)
    
    return new_equipe

@router.put("/{equipe_id}", response_model=EquipeResponse)
async def update_equipe(
    equipe_id: int,
    equipe_data: EquipeUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour une équipe existante
    """
    equipe = get_equipe(db, equipe_id)
    
    # Mettre à jour les champs fournis
    update_data = equipe_data.dict(exclude_unset=True)
    
    if "categorie" in update_data:
        valid_categories = ['secours', 'logistique', 'direction', 'externe']
        if update_data["categorie"] not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La catégorie doit être l'une des suivantes: {', '.join(valid_categories)}"
            )
    
    if "nom" in update_data:
        # Vérifier si une autre équipe avec le même nom existe déjà
        existing_equipe = db.query(Equipe).filter(
            Equipe.nom == update_data["nom"], 
            Equipe.id != equipe_id
        ).first()
        if existing_equipe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une équipe avec ce nom existe déjà"
            )
    
    for key, value in update_data.items():
        setattr(equipe, key, value)
    
    db.commit()
    db.refresh(equipe)
    
    return equipe

@router.delete("/{equipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipe(
    equipe_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprimer une équipe
    """
    equipe = get_equipe(db, equipe_id)
    
    # Vérifier s'il y a des membres associés
    members = db.query(Personne).filter(Personne.id_equipe == equipe_id).first()
    if members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer une équipe ayant des membres associés"
        )
    
    # Supprimer l'équipe
    db.delete(equipe)
    db.commit()
    
    return None

# Routes pour la gestion des membres de l'équipe
@router.get("/{equipe_id}/membres", response_model=List[PersonneBase])
async def get_equipe_membres(
    equipe_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir la liste des membres d'une équipe
    """
    # Vérifier si l'équipe existe
    get_equipe(db, equipe_id)
    
    # Récupérer les membres
    membres = db.query(Personne).filter(Personne.id_equipe == equipe_id).all()
    
    return membres

@router.post("/{equipe_id}/membres/{personne_id}", status_code=status.HTTP_200_OK)
async def add_membre_to_equipe(
    equipe_id: int,
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Ajouter un membre à une équipe
    """
    # Vérifier si l'équipe existe
    get_equipe(db, equipe_id)
    
    # Vérifier si la personne existe
    personne = db.query(Personne).filter(Personne.id == personne_id).first()
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée"
        )
    
    # Mettre à jour l'équipe de la personne
    personne.id_equipe = equipe_id
    db.commit()
    
    return {"message": "Membre ajouté à l'équipe avec succès"}

@router.delete("/{equipe_id}/membres/{personne_id}", status_code=status.HTTP_200_OK)
async def remove_membre_from_equipe(
    equipe_id: int,
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retirer un membre d'une équipe (sans le supprimer de la base de données)
    """
    # Vérifier si l'équipe existe
    get_equipe(db, equipe_id)
    
    # Vérifier si la personne existe et appartient à cette équipe
    personne = db.query(Personne).filter(
        Personne.id == personne_id,
        Personne.id_equipe == equipe_id
    ).first()
    
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée dans cette équipe"
        )
    
    # Définir une équipe par défaut ou null selon la logique de votre application
    # Ici, nous utiliserons null (None)
    personne.id_equipe = None
    db.commit()
    
    return {"message": "Membre retiré de l'équipe avec succès"}