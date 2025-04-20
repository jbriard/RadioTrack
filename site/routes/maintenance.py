from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import csv
import io
from database import get_db, Radio, Maintenance
from auth import get_current_active_user, User

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

# Modèles Pydantic
class MaintenanceResponse(BaseModel):
    id: int
    id_radio: int
    date_debut: datetime
    date_fin: Optional[datetime] = None
    description: str
    operateur: str
    radio: Optional[dict] = None

    class Config:
        orm_mode = True

class MaintenanceStatistics(BaseModel):
    active_count: int
    average_duration: str
    month_count: int

# Routes pour la gestion de la maintenance
@router.get("/statistics", response_model=MaintenanceStatistics)
async def get_maintenance_statistics(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les statistiques de maintenance
    """
    try:
        # Nombre de radios en maintenance
        active_count = db.query(Maintenance).filter(Maintenance.date_fin.is_(None)).count()
        
        # Nombre de maintenances dans le mois en cours
        now = datetime.utcnow()
        start_of_month = datetime(now.year, now.month, 1)
        month_count = db.query(Maintenance).filter(
            Maintenance.date_debut >= start_of_month
        ).count()
        
        # Durée moyenne des maintenances terminées (derniers 90 jours)
        ninety_days_ago = now - timedelta(days=90)
        completed_maintenances = db.query(Maintenance).filter(
            Maintenance.date_fin.isnot(None),
            Maintenance.date_debut >= ninety_days_ago
        ).all()
        
        if completed_maintenances:
            total_duration = 0
            for m in completed_maintenances:
                duration = (m.date_fin - m.date_debut).total_seconds()
                total_duration += duration
            
            avg_seconds = total_duration / len(completed_maintenances)
            avg_days = avg_seconds / (60 * 60 * 24)
            
            if avg_days >= 1:
                avg_duration = f"{avg_days:.1f} jours"
            else:
                avg_hours = avg_seconds / (60 * 60)
                avg_duration = f"{avg_hours:.1f} heures"
        else:
            avg_duration = "N/A"
        
        # Retourner les statistiques
        return {
            "active_count": active_count,
            "average_duration": avg_duration,
            "month_count": month_count
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du calcul des statistiques: {str(e)}"
        )

@router.get("/active")
async def get_active_maintenances(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des maintenances actives
    """
    try:
        # Récupérer les maintenances qui n'ont pas de date de fin
        maintenances = db.query(Maintenance).filter(
            Maintenance.date_fin.is_(None)
        ).all()
        
        # Pour chaque maintenance, ajouter les informations sur la radio
        result = []
        for maintenance in maintenances:
            radio = db.query(Radio).filter(Radio.id == maintenance.id_radio).first()
            
            if radio:
                maintenance_dict = {
                    "id": maintenance.id,
                    "id_radio": maintenance.id_radio,
                    "date_debut": maintenance.date_debut,
                    "date_fin": maintenance.date_fin,
                    "description": maintenance.description,
                    "operateur": maintenance.operateur,
                    "radio": {
                        "id": radio.id,
                        "code_barre": radio.code_barre,
                        "marque": radio.marque,
                        "modele": radio.modele,
                        "numero_serie": radio.numero_serie,
                        "est_geolocalisable": radio.est_geolocalisable
                    }
                }
                result.append(maintenance_dict)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des maintenances actives: {str(e)}"
        )

@router.get("/history")
async def get_maintenance_history(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_filter: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer l'historique des maintenances avec filtres
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    try:
        # Construire la requête de base
        query = db.query(Maintenance)
        
        # Appliquer les filtres
        if search:
            # Joindre avec la table Radio pour chercher par code barre, marque ou modèle
            query = query.join(Radio, Maintenance.id_radio == Radio.id).filter(
                (Radio.code_barre.ilike(f"%{search}%")) |
                (Radio.marque.ilike(f"%{search}%")) |
                (Radio.modele.ilike(f"%{search}%")) |
                (Maintenance.description.ilike(f"%{search}%")) |
                (Maintenance.operateur.ilike(f"%{search}%"))
            )
        
        if status == "active":
            query = query.filter(Maintenance.date_fin.is_(None))
        elif status == "completed":
            query = query.filter(Maintenance.date_fin.isnot(None))
        
        if date_filter:
            now = datetime.utcnow()
            if date_filter == "week":
                # 7 derniers jours
                date_threshold = now - timedelta(days=7)
            elif date_filter == "month":
                # 30 derniers jours
                date_threshold = now - timedelta(days=30)
            elif date_filter == "three-month":
                # 3 derniers mois
                date_threshold = now - timedelta(days=90)
            elif date_filter == "year":
                # 12 derniers mois
                date_threshold = now - timedelta(days=365)
            else:
                date_threshold = None
            
            if date_threshold:
                query = query.filter(Maintenance.date_debut >= date_threshold)
        
        # Compter le nombre total pour la pagination
        total_count = query.count()
        
        # Appliquer la pagination
        query = query.order_by(Maintenance.date_debut.desc()).offset(skip).limit(limit)
        
        # Exécuter la requête
        maintenances = query.all()
        
        # Pour chaque maintenance, ajouter les informations sur la radio
        result = []
        for maintenance in maintenances:
            radio = db.query(Radio).filter(Radio.id == maintenance.id_radio).first()
            
            if radio:
                maintenance_dict = {
                    "id": maintenance.id,
                    "id_radio": maintenance.id_radio,
                    "date_debut": maintenance.date_debut,
                    "date_fin": maintenance.date_fin,
                    "description": maintenance.description,
                    "operateur": maintenance.operateur,
                    "radio": {
                        "id": radio.id,
                        "code_barre": radio.code_barre,
                        "marque": radio.marque,
                        "modele": radio.modele,
                        "numero_serie": radio.numero_serie,
                        "est_geolocalisable": radio.est_geolocalisable
                    }
                }
                result.append(maintenance_dict)
        
        # Convertir en JSON et ajouter l'en-tête personnalisé
        result_json = jsonable_encoder(result)
        
        return JSONResponse(
            content=result_json,
            headers={"X-Total-Count": str(total_count)}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération de l'historique des maintenances: {str(e)}"
        )

@router.get("/{maintenance_id}")
async def get_maintenance_details(
    maintenance_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer les détails d'une maintenance spécifique
    """
    try:
        # Récupérer la maintenance
        maintenance = db.query(Maintenance).filter(Maintenance.id == maintenance_id).first()
        
        if not maintenance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Maintenance avec l'ID {maintenance_id} non trouvée"
            )
        
        # Récupérer la radio associée
        radio = db.query(Radio).filter(Radio.id == maintenance.id_radio).first()
        
        if not radio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Radio associée à cette maintenance non trouvée"
            )
        
        # Construire la réponse
        result = {
            "id": maintenance.id,
            "id_radio": maintenance.id_radio,
            "date_debut": maintenance.date_debut,
            "date_fin": maintenance.date_fin,
            "description": maintenance.description,
            "operateur": maintenance.operateur,
            "radio": {
                "id": radio.id,
                "code_barre": radio.code_barre,
                "marque": radio.marque,
                "modele": radio.modele,
                "numero_serie": radio.numero_serie,
                "est_geolocalisable": radio.est_geolocalisable
            }
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des détails de la maintenance: {str(e)}"
        )

@router.get("/export", response_class=Response)
async def export_maintenance_history(
    search: Optional[str] = None,
    status: Optional[str] = None,
    date_filter: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Exporter l'historique des maintenances au format CSV
    """
    try:
        # Construire la requête avec les mêmes filtres que get_maintenance_history
        query = db.query(Maintenance).join(Radio, Maintenance.id_radio == Radio.id)
        
        # Appliquer les filtres
        if search:
            query = query.filter(
                (Radio.code_barre.ilike(f"%{search}%")) |
                (Radio.marque.ilike(f"%{search}%")) |
                (Radio.modele.ilike(f"%{search}%")) |
                (Maintenance.description.ilike(f"%{search}%")) |
                (Maintenance.operateur.ilike(f"%{search}%"))
            )
        
        if status == "active":
            query = query.filter(Maintenance.date_fin.is_(None))
        elif status == "completed":
            query = query.filter(Maintenance.date_fin.isnot(None))
        
        if date_filter:
            now = datetime.utcnow()
            if date_filter == "week":
                date_threshold = now - timedelta(days=7)
            elif date_filter == "month":
                date_threshold = now - timedelta(days=30)
            elif date_filter == "three-month":
                date_threshold = now - timedelta(days=90)
            elif date_filter == "year":
                date_threshold = now - timedelta(days=365)
            else:
                date_threshold = None
            
            if date_threshold:
                query = query.filter(Maintenance.date_debut >= date_threshold)
        
        # Exécuter la requête
        maintenances = query.order_by(Maintenance.date_debut.desc()).all()
        
        # Créer le buffer pour le CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Écrire l'en-tête du CSV
        writer.writerow([
            "ID", "Code Radio", "Marque", "Modèle", "Description", 
            "Opérateur", "Date de début", "Date de fin", "Durée", "Statut"
        ])
        
        # Écrire les données
        for maintenance in maintenances:
            radio = db.query(Radio).filter(Radio.id == maintenance.id_radio).first()
            
            if radio:
                # Formater les dates
                date_debut = maintenance.date_debut.strftime("%d/%m/%Y %H:%M")
                date_fin = maintenance.date_fin.strftime("%d/%m/%Y %H:%M") if maintenance.date_fin else ""
                
                # Calculer la durée
                if maintenance.date_fin:
                    duration = maintenance.date_fin - maintenance.date_debut
                    days = duration.days
                    hours = duration.seconds // 3600
                    
                    if days > 0:
                        duration_str = f"{days} jour(s) {hours} heure(s)"
                    else:
                        duration_str = f"{hours} heure(s)"
                else:
                    now = datetime.utcnow()
                    duration = now - maintenance.date_debut
                    days = duration.days
                    hours = duration.seconds // 3600
                    
                    if days > 0:
                        duration_str = f"{days} jour(s) {hours} heure(s) (en cours)"
                    else:
                        duration_str = f"{hours} heure(s) (en cours)"
                
                # Déterminer le statut
                statut = "Terminée" if maintenance.date_fin else "En cours"
                
                # Écrire la ligne
                writer.writerow([
                    maintenance.id,
                    radio.code_barre,
                    radio.marque,
                    radio.modele,
                    maintenance.description,
                    maintenance.operateur,
                    date_debut,
                    date_fin,
                    duration_str,
                    statut
                ])
        
        # Préparer le contenu pour le téléchargement
        output.seek(0)
        content = output.getvalue()
        
        # Définir un nom de fichier avec la date actuelle
        current_date = datetime.now().strftime("%Y%m%d")
        filename = f"historique_maintenance_{current_date}.csv"
        
        # Retourner le CSV comme un téléchargement
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': 'text/csv; charset=utf-8'
        }
        
        return Response(content=content, headers=headers)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'export des données: {str(e)}"
        )