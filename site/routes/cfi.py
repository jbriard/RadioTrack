from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db, CFI, Personne
from auth import get_current_active_user, User

router = APIRouter(prefix="/api/cfis", tags=["cfis"])

# Modèles Pydantic pour la validation et la sérialisation des données
class CFIBase(BaseModel):
    nom: str
    responsable: str
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None

class CFICreate(CFIBase):
    pass

class CFIUpdate(BaseModel):
    nom: Optional[str] = None
    responsable: Optional[str] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None

class PersonneBase(BaseModel):
    id: int
    code_barre: str
    nom: str
    prenom: str

    class Config:
        orm_mode = True

class CFIResponse(CFIBase):
    id: int
    date_creation: datetime
    date_modification: datetime

    class Config:
        orm_mode = True

class CFIDetailResponse(CFIResponse):
    personnes: List[PersonneBase] = []
    
    class Config:
        orm_mode = True

# Fonction utilitaire pour vérifier si un CFI existe
def get_cfi(db: Session, cfi_id: int):
    cfi = db.query(CFI).filter(CFI.id == cfi_id).first()
    if not cfi:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CFI avec l'ID {cfi_id} non trouvé"
        )
    return cfi

# Routes pour la gestion des CFIs
@router.get("/", response_model=List[CFIResponse])
async def list_cfis(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des CFIs avec filtres optionnels
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    query = db.query(CFI)
    
    # Appliquer le filtre de recherche si fourni
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (CFI.nom.ilike(search_term)) | 
            (CFI.responsable.ilike(search_term)) |
            (CFI.email.ilike(search_term))
        )
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer pagination
    cfis = query.offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    cfis_data = jsonable_encoder(cfis)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=cfis_data,
        headers={"X-Total-Count": str(total_count)}
    )

@router.get("/{cfi_id}", response_model=CFIDetailResponse)
async def get_cfi_details(
    cfi_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'un CFI spécifique avec ses membres
    """
    cfi = get_cfi(db, cfi_id)
    
    # Chercher les personnes associées à ce CFI
    personnes = db.query(Personne).filter(Personne.id_cfi == cfi_id).all()
    
    # Créer la réponse avec les détails et les personnes
    response = CFIDetailResponse(
        id=cfi.id,
        nom=cfi.nom,
        responsable=cfi.responsable,
        adresse=cfi.adresse,
        telephone=cfi.telephone,
        email=cfi.email,
        date_creation=cfi.date_creation,
        date_modification=cfi.date_modification,
        personnes=[PersonneBase(
            id=personne.id,
            code_barre=personne.code_barre,
            nom=personne.nom,
            prenom=personne.prenom
        ) for personne in personnes]
    )
    
    return response

@router.post("/", response_model=CFIResponse, status_code=status.HTTP_201_CREATED)
async def create_cfi(
    cfi_data: CFICreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer un nouveau CFI
    """
    # Vérifier si un CFI avec le même nom existe déjà
    existing_cfi = db.query(CFI).filter(CFI.nom == cfi_data.nom).first()
    if existing_cfi:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un CFI avec ce nom existe déjà"
        )
    
    # Créer le nouveau CFI
    new_cfi = CFI(
        nom=cfi_data.nom,
        responsable=cfi_data.responsable,
        adresse=cfi_data.adresse,
        telephone=cfi_data.telephone,
        email=cfi_data.email
    )
    
    db.add(new_cfi)
    db.commit()
    db.refresh(new_cfi)
    
    return new_cfi

@router.put("/{cfi_id}", response_model=CFIResponse)
async def update_cfi(
    cfi_id: int,
    cfi_data: CFIUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour un CFI existant
    """
    cfi = get_cfi(db, cfi_id)
    
    # Mettre à jour les champs fournis
    update_data = cfi_data.dict(exclude_unset=True)
    
    if "nom" in update_data:
        # Vérifier si un autre CFI avec le même nom existe déjà
        existing_cfi = db.query(CFI).filter(
            CFI.nom == update_data["nom"], 
            CFI.id != cfi_id
        ).first()
        if existing_cfi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un CFI avec ce nom existe déjà"
            )
    
    for key, value in update_data.items():
        setattr(cfi, key, value)
    
    db.commit()
    db.refresh(cfi)
    
    return cfi

@router.delete("/{cfi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cfi(
    cfi_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprimer un CFI
    """
    cfi = get_cfi(db, cfi_id)
    
    # Vérifier s'il y a des personnes associées
    membres = db.query(Personne).filter(Personne.id_cfi == cfi_id).first()
    if membres:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer un CFI ayant des personnes associées"
        )
    
    # Supprimer le CFI
    db.delete(cfi)
    db.commit()
    
    return None

# Routes pour la gestion des membres du CFI
@router.get("/{cfi_id}/membres", response_model=List[PersonneBase])
async def get_cfi_membres(
    cfi_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir la liste des membres d'un CFI
    """
    # Vérifier si le CFI existe
    get_cfi(db, cfi_id)
    
    # Récupérer les membres
    membres = db.query(Personne).filter(Personne.id_cfi == cfi_id).all()
    
    return membres

@router.post("/{cfi_id}/membres/{personne_id}", status_code=status.HTTP_200_OK)
async def add_membre_to_cfi(
    cfi_id: int,
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Ajouter un membre à un CFI
    """
    # Vérifier si le CFI existe
    get_cfi(db, cfi_id)
    
    # Vérifier si la personne existe
    personne = db.query(Personne).filter(Personne.id == personne_id).first()
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée"
        )
    
    # Mettre à jour le CFI de la personne
    personne.id_cfi = cfi_id
    db.commit()
    
    return {"message": "Membre ajouté au CFI avec succès"}

@router.delete("/{cfi_id}/membres/{personne_id}", status_code=status.HTTP_200_OK)
async def remove_membre_from_cfi(
    cfi_id: int,
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retirer un membre d'un CFI (sans le supprimer de la base de données)
    """
    # Vérifier si le CFI existe
    get_cfi(db, cfi_id)
    
    # Vérifier si la personne existe et appartient à ce CFI
    personne = db.query(Personne).filter(
        Personne.id == personne_id,
        Personne.id_cfi == cfi_id
    ).first()
    
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée dans ce CFI"
        )
    
    # Définir le CFI comme null
    personne.id_cfi = None
    db.commit()
    
    return {"message": "Membre retiré du CFI avec succès"}