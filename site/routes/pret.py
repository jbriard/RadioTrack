from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db, Pret, Radio, Personne
from auth import get_current_active_user, User

router = APIRouter(prefix="/api/prets", tags=["prets"])

# Modèles Pydantic pour la validation et la sérialisation des données
class PretBase(BaseModel):
    id_radio: int
    id_personne: int
    accessoires: str = "aucun"  # Valeur par défaut
    commentaire: Optional[str] = None

class PretCreate(PretBase):
    pass

class PretUpdate(BaseModel):
    commentaire: Optional[str] = None

class RadioResponse(BaseModel):
    id: int
    code_barre: str
    marque: str
    modele: str
    
    class Config:
        from_attributes = True  # Pydantic V2 - anciennement orm_mode = True

class PersonneResponse(BaseModel):
    id: int
    code_barre: str
    nom: str
    prenom: str
    
    class Config:
        from_attributes = True  # Pydantic V2 - anciennement orm_mode = True

class PretResponse(PretBase):
    id: int
    date_emprunt: datetime
    date_retour: Optional[datetime] = None
    radio: Optional[RadioResponse] = None
    personne: Optional[PersonneResponse] = None
    
    class Config:
        from_attributes = True  # Pydantic V2 - anciennement orm_mode = True

# Fonction utilitaire pour vérifier si un prêt existe
def get_pret(db: Session, pret_id: int):
    pret = db.query(Pret).filter(Pret.id == pret_id).first()
    if not pret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prêt avec l'ID {pret_id} non trouvé"
        )
    return pret

# Routes pour la gestion des prêts
@router.get("/", response_model=List[PretResponse])
async def list_prets(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    actif: Optional[bool] = None,
    id_personne: Optional[int] = None,
    id_radio: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des prêts avec filtres optionnels
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    # Utiliser joinedload pour charger les relations radio et personne en une seule requête
    query = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    )
    
    # Appliquer les filtres si fournis
    if search:
        # Recherche dans les commentaires ou via les relations
        search_term = f"%{search}%"
        query = query.join(Radio, Pret.id_radio == Radio.id).join(
            Personne, Pret.id_personne == Personne.id
        ).filter(
            (Pret.commentaire.ilike(search_term)) | 
            (Radio.code_barre.ilike(search_term)) |
            (Personne.nom.ilike(search_term)) |
            (Personne.prenom.ilike(search_term))
        )
    
    if actif is not None:
        if actif:
            query = query.filter(Pret.date_retour.is_(None))
        else:
            query = query.filter(Pret.date_retour.isnot(None))
    
    if id_personne:
        query = query.filter(Pret.id_personne == id_personne)
    
    if id_radio:
        query = query.filter(Pret.id_radio == id_radio)
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer pagination
    prets = query.order_by(Pret.date_emprunt.desc()).offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    prets_data = jsonable_encoder(prets)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=prets_data,
        headers={"X-Total-Count": str(total_count)}
    )

@router.get("/{pret_id}", response_model=PretResponse)
async def get_pret_details(
    pret_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'un prêt spécifique
    """
    # Utiliser joinedload pour charger les relations en une seule requête
    pret = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(Pret.id == pret_id).first()
    
    if not pret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prêt avec l'ID {pret_id} non trouvé"
        )
    
    return pret

@router.post("/", response_model=PretResponse, status_code=status.HTTP_201_CREATED)
async def create_pret(
    pret_data: PretCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer un nouveau prêt (emprunter une radio)
    """
    # Vérifier si la radio existe
    radio = db.query(Radio).filter(Radio.id == pret_data.id_radio).first()
    if not radio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Radio avec l'ID {pret_data.id_radio} non trouvée"
        )
    
    # Vérifier si la personne existe
    personne = db.query(Personne).filter(Personne.id == pret_data.id_personne).first()
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {pret_data.id_personne} non trouvée"
        )
    
    # Vérifier si la radio est disponible (pas en maintenance et pas déjà en prêt)
    if radio.en_maintenance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette radio est actuellement en maintenance et ne peut pas être empruntée"
        )
    
    active_loan = db.query(Pret).filter(
        Pret.id_radio == pret_data.id_radio,
        Pret.date_retour.is_(None)
    ).first()
    
    if active_loan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette radio est déjà en prêt"
        )
    
    # Valider les accessoires
    valid_accessoires = ['oreillettes', 'micro', 'les deux', 'aucun']
    if pret_data.accessoires not in valid_accessoires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Les accessoires doivent être l'un des suivants: {', '.join(valid_accessoires)}"
        )
    
    # Créer le nouveau prêt
    new_pret = Pret(
        id_radio=pret_data.id_radio,
        id_personne=pret_data.id_personne,
        accessoires=pret_data.accessoires,
        commentaire=pret_data.commentaire,
        date_emprunt=datetime.now(),
        date_retour=None
    )
    
    db.add(new_pret)
    db.commit()
    db.refresh(new_pret)
    
    # Recharger le prêt avec ses relations pour la réponse
    pret_with_relations = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(Pret.id == new_pret.id).first()
    
    return pret_with_relations

@router.put("/{pret_id}/retour", response_model=PretResponse)
async def return_radio(
    pret_id: int,
    pret_update: Optional[PretUpdate] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Enregistrer le retour d'une radio
    """
    pret = get_pret(db, pret_id)
    
    # Vérifier si le prêt est déjà terminé
    if pret.date_retour is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette radio a déjà été retournée"
        )
    
    # Mettre à jour la date de retour
    pret.date_retour = datetime.now()
    
    # Mettre à jour le commentaire si fourni
    if pret_update and pret_update.commentaire is not None:
        pret.commentaire = pret_update.commentaire
    
    db.commit()
    
    # Recharger le prêt avec ses relations pour la réponse
    pret_with_relations = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(Pret.id == pret.id).first()
    
    return pret_with_relations

@router.put("/{pret_id}", response_model=PretResponse)
async def update_pret(
    pret_id: int,
    pret_update: PretUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour un prêt existant (uniquement le commentaire)
    """
    pret = get_pret(db, pret_id)
    
    # Mettre à jour uniquement le commentaire
    if pret_update.commentaire is not None:
        pret.commentaire = pret_update.commentaire
    
    db.commit()
    
    # Recharger le prêt avec ses relations pour la réponse
    pret_with_relations = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(Pret.id == pret.id).first()
    
    return pret_with_relations

@router.get("/radio/{radio_id}/actif", response_model=Optional[PretResponse])
async def get_active_loan_for_radio(
    radio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer le prêt actif pour une radio spécifique (s'il existe)
    """
    # Vérifier si la radio existe
    radio = db.query(Radio).filter(Radio.id == radio_id).first()
    if not radio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Radio avec l'ID {radio_id} non trouvée"
        )
    
    # Rechercher un prêt actif pour cette radio
    active_loan = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(
        Pret.id_radio == radio_id,
        Pret.date_retour.is_(None)
    ).first()
    
    return active_loan

@router.get("/personne/{personne_id}/actifs", response_model=List[PretResponse])
async def get_active_loans_for_personne(
    personne_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer tous les prêts actifs pour une personne spécifique
    """
    # Vérifier si la personne existe
    personne = db.query(Personne).filter(Personne.id == personne_id).first()
    if not personne:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Personne avec l'ID {personne_id} non trouvée"
        )
    
    # Rechercher tous les prêts actifs pour cette personne
    active_loans = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne)
    ).filter(
        Pret.id_personne == personne_id,
        Pret.date_retour.is_(None)
    ).all()
    
    return active_loans