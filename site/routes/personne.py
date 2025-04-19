from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db, Personne, CFI, Equipe, Pret
from auth import get_current_active_user, User
from typing import Optional, Union
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/personnes", tags=["personnes"])

# Modèles Pydantic pour la validation et la sérialisation des données
class PersonneBase(BaseModel):
    nom: str
    prenom: str
    id_cfi: Optional[int] = None
    id_equipe: Optional[int] = Field(default=None, nullable=True)

class PersonneCreate(PersonneBase):
    pass

class PersonneUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    id_cfi: Optional[int] = None
    id_equipe: Optional[int] = None

class CFIResponse(BaseModel):
    id: int
    nom: str
    
    class Config:
        orm_mode = True

class EquipeResponse(BaseModel):
    id: int
    nom: str
    categorie: str
    
    class Config:
        orm_mode = True

class PersonneResponse(PersonneBase):
    id: int
    code_barre: str
    date_creation: datetime
    date_modification: datetime
    cfi: Optional[CFIResponse] = None
    equipe: Optional[EquipeResponse] = None

    class Config:
        orm_mode = True

class PretResponse(BaseModel):
    id: int
    date_emprunt: datetime
    date_retour: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class PersonneDetailResponse(PersonneResponse):
    prets: List[PretResponse] = []
    
    class Config:
        orm_mode = True

# Fonction utilitaire pour vérifier si une personne existe
def get_personne(db: Session, personne_id: int):
    personne = db.query(Personne).filter(Personne.id == personne_id).first()
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée"
        )
    return personne

# Routes pour la gestion des personnes
@router.get("/", response_model=List[PersonneResponse])
async def list_personnes(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    equipe_id: Optional[int] = None,
    cfi_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des personnes avec filtres optionnels
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    query = db.query(Personne).join(Equipe, Personne.id_equipe == Equipe.id, isouter=True)
    
    # Appliquer les filtres si fournis
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Personne.nom.ilike(search_term)) | 
            (Personne.prenom.ilike(search_term)) |
            (Personne.code_barre.ilike(search_term))
        )
    
    if equipe_id:
        query = query.filter(Personne.id_equipe == equipe_id)
    
    if cfi_id:
        query = query.filter(Personne.id_cfi == cfi_id)
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer pagination
    personnes = query.offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    personnes_data = jsonable_encoder(personnes)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=personnes_data,
        headers={"X-Total-Count": str(total_count)}
    )

@router.get("/{personne_id}", response_model=PersonneDetailResponse)
async def get_personne_details(
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'une personne spécifique
    """
    personne = db.query(Personne).filter(Personne.id == personne_id).first()
    
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée"
        )
    
    return personne

@router.post("/", response_model=PersonneResponse, status_code=status.HTTP_201_CREATED)
async def create_personne(
    personne_data: PersonneCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer une nouvelle personne
    """
    # Vérifier si l'équipe existe si un id_equipe est fourni
    if personne_data.id_equipe is not None:
        equipe = db.query(Equipe).filter(Equipe.id == personne_data.id_equipe).first()
        if not equipe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Équipe avec l'ID {personne_data.id_equipe} non trouvée"
            )
    
    # Vérifier si le CFI existe s'il est fourni
    if personne_data.id_cfi:
        cfi = db.query(CFI).filter(CFI.id == personne_data.id_cfi).first()
        if not cfi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CFI avec l'ID {personne_data.id_cfi} non trouvé"
            )
    print(f"id_equipe reçu: {personne_data.id_equipe}")

    # Créer la nouvelle personne
    new_personne = Personne(
        nom=personne_data.nom,
        prenom=personne_data.prenom,
        id_cfi=personne_data.id_cfi,
        id_equipe=personne_data.id_equipe,
        code_barre=None  # Sera généré automatiquement par le trigger
    )
    
    db.add(new_personne)
    db.flush()  # Pour exécuter le trigger qui génère le code-barre
    db.commit()
    db.refresh(new_personne)
    
    return new_personne

@router.put("/{personne_id}", response_model=PersonneResponse)
async def update_personne(
    personne_id: int,
    personne_data: PersonneUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour une personne existante
    """
    personne = get_personne(db, personne_id)
    
    # Vérifier si des prêts actifs existent
    active_loans = db.query(Pret).filter(
        Pret.id_personne == personne_id,
        Pret.date_retour.is_(None)
    ).first()
    
    # Mettre à jour les champs fournis
    update_data = personne_data.dict(exclude_unset=True)
    
    # Vérifications supplémentaires si nécessaire
    if "id_equipe" in update_data and update_data["id_equipe"] is not None:
        equipe = db.query(Equipe).filter(Equipe.id == update_data["id_equipe"]).first()
        if not equipe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Équipe avec l'ID {update_data['id_equipe']} non trouvée"
            )
    
    if "id_cfi" in update_data and update_data["id_cfi"] is not None:
        cfi = db.query(CFI).filter(CFI.id == update_data["id_cfi"]).first()
        if not cfi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CFI avec l'ID {update_data['id_cfi']} non trouvé"
            )
    
    for key, value in update_data.items():
        setattr(personne, key, value)
    
    db.commit()
    db.refresh(personne)
    
    return personne

@router.delete("/{personne_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_personne(
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprimer une personne
    """
    personne = get_personne(db, personne_id)
    
    # Vérifier s'il y a des prêts associés
    prets = db.query(Pret).filter(Pret.id_personne == personne_id).first()
    if prets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer une personne ayant un historique de prêts"
        )
    
    # Supprimer la personne
    db.delete(personne)
    db.commit()
    
    return None

# Routes supplémentaires

@router.get("/{personne_id}/prets", response_model=List[PretResponse])
async def get_personne_prets(
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir l'historique des prêts d'une personne
    """
    # Vérifier si la personne existe
    get_personne(db, personne_id)
    
    # Récupérer l'historique des prêts
    prets = db.query(Pret).filter(
        Pret.id_personne == personne_id
    ).order_by(Pret.date_emprunt.desc()).all()
    
    return prets

@router.get("/{personne_id}/prets/actifs", response_model=List[PretResponse])
async def get_personne_prets_actifs(
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir les prêts actifs d'une personne
    """
    # Vérifier si la personne existe
    get_personne(db, personne_id)
    
    # Récupérer les prêts actifs
    prets_actifs = db.query(Pret).filter(
        Pret.id_personne == personne_id,
        Pret.date_retour.is_(None)
    ).order_by(Pret.date_emprunt.desc()).all()
    
    return prets_actifs