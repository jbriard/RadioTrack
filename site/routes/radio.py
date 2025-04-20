from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from database import get_db, Radio, Maintenance, Pret
from auth import get_current_active_user, User

router = APIRouter(prefix="/api/radios", tags=["radios"])

# Modèles Pydantic pour la validation et la sérialisation des données
class RadioBase(BaseModel):
    marque: str
    modele: str
    numero_serie: str
    est_geolocalisable: bool = False

class RadioCreate(RadioBase):
    pass

class RadioUpdate(RadioBase):
    marque: Optional[str] = None
    modele: Optional[str] = None
    numero_serie: Optional[str] = None
    est_geolocalisable: Optional[bool] = None

class MaintenanceCreate(BaseModel):
    description: str
    operateur: str

class PretResponse(BaseModel):
    id: int
    date_emprunt: datetime
    date_retour: Optional[datetime] = None

    class Config:
        orm_mode = True

class MaintenanceResponse(BaseModel):
    id: int
    description: str
    operateur: str
    date_debut: datetime
    date_fin: Optional[datetime] = None

    class Config:
        orm_mode = True

class RadioResponse(RadioBase):
    id: int
    code_barre: str
    en_maintenance: bool
    date_creation: datetime
    date_modification: datetime

    class Config:
        orm_mode = True

class RadioDetailResponse(RadioResponse):
    maintenances: List[MaintenanceResponse] = []
    prets: List[PretResponse] = []
    
    class Config:
        orm_mode = True

# Fonction utilitaire pour vérifier si une radio existe
def get_radio(db: Session, radio_id: int):
    radio = db.query(Radio).filter(Radio.id == radio_id).first()
    if not radio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Radio avec l'ID {radio_id} non trouvée"
        )
    return radio

# Routes pour la gestion des radios
@router.get("/", response_model=List[RadioResponse])
async def list_radios(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    maintenance: Optional[bool] = None,
    en_pret: Optional[bool] = None,
    disponible: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des radios avec filtres optionnels
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    query = db.query(Radio)
    
    # Appliquer les filtres si fournis
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Radio.code_barre.ilike(search_term)) | 
            (Radio.marque.ilike(search_term)) | 
            (Radio.modele.ilike(search_term))
        )
    
    if maintenance is not None:
        query = query.filter(Radio.en_maintenance == maintenance)
    
    # Nouveau filtre pour les radios en prêt
    if en_pret is not None and en_pret:
        # Sous-requête pour trouver les radios qui ont au moins un prêt actif
        subquery = db.query(Pret.id_radio).filter(Pret.date_retour.is_(None)).distinct().subquery()
        query = query.filter(Radio.id.in_(subquery))
    
    # Filtre pour les radios disponibles (ni en prêt, ni en maintenance)
    if disponible is not None and disponible:
        # Sous-requête pour exclure les radios en prêt
        pret_subquery = db.query(Pret.id_radio).filter(Pret.date_retour.is_(None)).distinct().subquery()
        query = query.filter(~Radio.id.in_(pret_subquery)).filter(Radio.en_maintenance == False)
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer pagination
    radios = query.offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    radios_data = jsonable_encoder(radios)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=radios_data,
        headers={"X-Total-Count": str(total_count)}
    )


@router.get("/{radio_id}", response_model=RadioDetailResponse)
async def get_radio_details(
    radio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'une radio spécifique
    """
    radio = get_radio(db, radio_id)
    
    # Récupérer les prêts associés à cette radio
    prets = db.query(Pret).filter(Pret.id_radio == radio_id).order_by(Pret.date_emprunt.desc()).all()
    radio.prets = prets
    
    return radio

@router.post("/", response_model=RadioResponse, status_code=status.HTTP_201_CREATED)
async def create_radio(
    radio_data: RadioCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Créer une nouvelle radio
    """
    
    # Créer la nouvelle radio
    new_radio = Radio(
        marque=radio_data.marque,
        modele=radio_data.modele,
        numero_serie=radio_data.numero_serie,
        est_geolocalisable=radio_data.est_geolocalisable,
        code_barre=None  # Sera généré automatiquement par le trigger
    )
    
    db.add(new_radio)
    # Flush pour exécuter l'insertion et générer le code-barre
    db.flush()  
    # Commit pour confirmer les changements
    db.commit()
    db.refresh(new_radio)
    
    return new_radio

@router.put("/{radio_id}", response_model=RadioResponse)
async def update_radio(
    radio_id: int,
    radio_data: RadioUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre à jour une radio existante
    """
    radio = get_radio(db, radio_id)
    
    # Vérifier si des prêts actifs existent
    active_loans = db.query(Pret).filter(
        Pret.id_radio == radio_id,
        Pret.date_retour.is_(None)
    ).first()
    
    if active_loans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de modifier une radio actuellement en prêt"
        )
    
    # Mettre à jour les champs fournis
    update_data = radio_data.dict(exclude_unset=True)
    
    
    for key, value in update_data.items():
        setattr(radio, key, value)
    
    db.commit()
    db.refresh(radio)
    
    return radio

@router.delete("/{radio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_radio(
    radio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Supprimer une radio
    """
    radio = get_radio(db, radio_id)
    
    # Vérifier s'il y a des prêts associés
    loans = db.query(Pret).filter(Pret.id_radio == radio_id).first()
    if loans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer une radio ayant un historique de prêts"
        )
    
    # Supprimer d'abord toutes les maintenances associées
    db.query(Maintenance).filter(Maintenance.id_radio == radio_id).delete()
    
    # Supprimer la radio
    db.delete(radio)
    db.commit()
    
    return None

# Routes pour la gestion de la maintenance
@router.post("/{radio_id}/maintenance", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def start_maintenance(
    radio_id: int,
    maintenance_data: MaintenanceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mettre une radio en maintenance
    """
    radio = get_radio(db, radio_id)
    
    # Vérifier si la radio est déjà en maintenance
    if radio.en_maintenance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette radio est déjà en maintenance"
        )
    
    # Vérifier si la radio est actuellement en prêt
    active_loan = db.query(Pret).filter(
        Pret.id_radio == radio_id,
        Pret.date_retour.is_(None)
    ).first()
    
    if active_loan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de mettre en maintenance une radio actuellement en prêt"
        )
    
    # Créer la maintenance
    maintenance = Maintenance(
        id_radio=radio_id,
        description=maintenance_data.description,
        operateur=maintenance_data.operateur
    )
    
    db.add(maintenance)
    db.commit()
    db.refresh(maintenance)
    
    # Mettre à jour le statut de la radio (le trigger devrait s'en charger)
    radio.en_maintenance = True
    db.commit()
    
    return maintenance

@router.put("/{radio_id}/maintenance/{maintenance_id}/end", response_model=MaintenanceResponse)
async def end_maintenance(
    radio_id: int,
    maintenance_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Terminer une maintenance en cours
    """
    # Vérifier si la radio existe
    radio = get_radio(db, radio_id)
    
    # Récupérer la maintenance
    maintenance = db.query(Maintenance).filter(
        Maintenance.id == maintenance_id,
        Maintenance.id_radio == radio_id
    ).first()
    
    if not maintenance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance non trouvée"
        )
    
    if maintenance.date_fin is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette maintenance est déjà terminée"
        )
    
    # Mettre à jour la date de fin
    maintenance.date_fin = datetime.now()
    
    # Vérifier s'il y a d'autres maintenances actives pour cette radio
    other_active_maintenance = db.query(Maintenance).filter(
        Maintenance.id_radio == radio_id,
        Maintenance.id != maintenance_id,
        Maintenance.date_fin.is_(None)
    ).first()
    
    # Si aucune autre maintenance active, mettre à jour le statut de la radio
    if not other_active_maintenance:
        radio.en_maintenance = False
    
    db.commit()
    db.refresh(maintenance)
    
    return maintenance

@router.get("/{radio_id}/maintenance", response_model=List[MaintenanceResponse])
async def get_maintenance_history(
    radio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir l'historique des maintenances d'une radio
    """
    # Vérifier si la radio existe
    get_radio(db, radio_id)
    
    # Récupérer l'historique des maintenances
    maintenances = db.query(Maintenance).filter(
        Maintenance.id_radio == radio_id
    ).order_by(Maintenance.date_debut.desc()).all()
    
    return maintenances

# Nouvelle route pour vérifier si une radio est en prêt
@router.get("/{radio_id}/en-pret", response_model=bool)
async def is_radio_loaned(
    radio_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Vérifier si une radio est actuellement en prêt
    """
    # Vérifier si la radio existe
    get_radio(db, radio_id)
    
    # Vérifier si la radio a un prêt actif
    active_loan = db.query(Pret).filter(
        Pret.id_radio == radio_id,
        Pret.date_retour.is_(None)
    ).first()
    
    return active_loan is not None