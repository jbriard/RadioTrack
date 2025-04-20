from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, text
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from database import get_db, Pret, Radio, Personne, Equipe, CFI
from auth import get_current_active_user, User
from io import StringIO
import csv

router = APIRouter(prefix="/api/historique", tags=["historique"])

class PretFilter(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    radio: Optional[int] = None
    personne: Optional[int] = None
    equipe: Optional[int] = None
    cfi: Optional[int] = None
    accessoires: Optional[str] = None
    dateDebut: Optional[str] = None
    dateFin: Optional[str] = None

@router.get("/prets")
async def list_prets(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    radio: Optional[int] = None,
    personne: Optional[int] = None,
    equipe: Optional[int] = None,
    cfi: Optional[int] = None,
    accessoires: Optional[str] = None,
    dateDebut: Optional[str] = None,
    dateFin: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupérer la liste des prêts avec filtres avancés
    """
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    
    # Base de la requête avec les jointures nécessaires
    query = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne).joinedload(Personne.equipe),
        joinedload(Pret.personne).joinedload(Personne.cfi)
    )
    
    # Appliquer les filtres
    if search:
        search_term = f"%{search}%"
        query = query.join(Radio, Pret.id_radio == Radio.id).join(
            Personne, Pret.id_personne == Personne.id
        ).filter(
            or_(
                Radio.code_barre.ilike(search_term),
                Radio.marque.ilike(search_term),
                Radio.modele.ilike(search_term),
                Personne.code_barre.ilike(search_term),
                Personne.nom.ilike(search_term),
                Personne.prenom.ilike(search_term),
                Pret.commentaire.ilike(search_term)
            )
        )
    
    if status:
        now = datetime.now()
        one_week_ago = now - timedelta(days=7)
        
        if status == "active":
            query = query.filter(Pret.date_retour == None)
        elif status == "returned":
            query = query.filter(Pret.date_retour != None)
        elif status == "overdue":
            query = query.filter(and_(
                Pret.date_retour == None,
                Pret.date_emprunt < one_week_ago
            ))
    
    if radio:
        query = query.filter(Pret.id_radio == radio)
    
    if personne:
        query = query.filter(Pret.id_personne == personne)
    
    if equipe:
        query = query.join(Personne, Pret.id_personne == Personne.id).filter(
            Personne.id_equipe == equipe
        )
    
    if cfi:
        query = query.join(Personne, Pret.id_personne == Personne.id).filter(
            Personne.id_cfi == cfi
        )
    
    if accessoires:
        query = query.filter(Pret.accessoires == accessoires)
    
    if dateDebut:
        try:
            date_debut = datetime.strptime(dateDebut, "%Y-%m-%d")
            query = query.filter(Pret.date_emprunt >= date_debut)
        except ValueError:
            pass  # Ignorer les erreurs de format de date
    
    if dateFin:
        try:
            date_fin = datetime.strptime(dateFin, "%Y-%m-%d")
            # Ajouter un jour pour inclure toute la journée
            date_fin = date_fin + timedelta(days=1)
            query = query.filter(Pret.date_emprunt <= date_fin)
        except ValueError:
            pass  # Ignorer les erreurs de format de date
    
    # Compter le nombre total pour la pagination
    total_count = query.count()
    
    # Appliquer le tri et la pagination
    prets = query.order_by(Pret.date_emprunt.desc()).offset(skip).limit(limit).all()
    
    # Convertir les objets SQLAlchemy en dictionnaires
    prets_data = jsonable_encoder(prets)
    
    # Créer une réponse JSON avec l'en-tête personnalisé
    return JSONResponse(
        content=prets_data,
        headers={"X-Total-Count": str(total_count)}
    )

@router.get("/prets/export")
async def export_prets_csv(
    search: Optional[str] = None,
    status: Optional[str] = None,
    radio: Optional[int] = None,
    personne: Optional[int] = None,
    equipe: Optional[int] = None,
    cfi: Optional[int] = None,
    accessoires: Optional[str] = None,
    dateDebut: Optional[str] = None,
    dateFin: Optional[str] = None,
    limit: int = 10000,  # Limite élevée car on veut tous les résultats
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Exporter les prêts au format CSV
    """
    # Base de la requête avec les jointures nécessaires
    query = db.query(Pret).options(
        joinedload(Pret.radio),
        joinedload(Pret.personne).joinedload(Personne.equipe),
        joinedload(Pret.personne).joinedload(Personne.cfi)
    )
    
    # Appliquer les filtres (même logique que list_prets)
    if search:
        search_term = f"%{search}%"
        query = query.join(Radio, Pret.id_radio == Radio.id).join(
            Personne, Pret.id_personne == Personne.id
        ).filter(
            or_(
                Radio.code_barre.ilike(search_term),
                Radio.marque.ilike(search_term),
                Radio.modele.ilike(search_term),
                Personne.code_barre.ilike(search_term),
                Personne.nom.ilike(search_term),
                Personne.prenom.ilike(search_term),
                Pret.commentaire.ilike(search_term)
            )
        )
    
    if status:
        now = datetime.now()
        one_week_ago = now - timedelta(days=7)
        
        if status == "active":
            query = query.filter(Pret.date_retour == None)
        elif status == "returned":
            query = query.filter(Pret.date_retour != None)
        elif status == "overdue":
            query = query.filter(and_(
                Pret.date_retour == None,
                Pret.date_emprunt < one_week_ago
            ))
    
    if radio:
        query = query.filter(Pret.id_radio == radio)
    
    if personne:
        query = query.filter(Pret.id_personne == personne)
    
    if equipe:
        query = query.join(Personne, Pret.id_personne == Personne.id).filter(
            Personne.id_equipe == equipe
        )
    
    if cfi:
        query = query.join(Personne, Pret.id_personne == Personne.id).filter(
            Personne.id_cfi == cfi
        )
    
    if accessoires:
        query = query.filter(Pret.accessoires == accessoires)
    
    if dateDebut:
        try:
            date_debut = datetime.strptime(dateDebut, "%Y-%m-%d")
            query = query.filter(Pret.date_emprunt >= date_debut)
        except ValueError:
            pass
    
    if dateFin:
        try:
            date_fin = datetime.strptime(dateFin, "%Y-%m-%d")
            date_fin = date_fin + timedelta(days=1)
            query = query.filter(Pret.date_emprunt <= date_fin)
        except ValueError:
            pass
    
    # Récupérer les prêts
    prets = query.order_by(Pret.date_emprunt.desc()).limit(limit).all()
    
    # Créer le contenu CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Écrire l'en-tête
    writer.writerow([
        "ID", "Radio", "Modèle", "Emprunteur", "Équipe", "CFI", 
        "Date d'emprunt", "Date de retour", "Durée", "Accessoires", "Commentaire", "Statut"
    ])
    
    # Écrire les données
    for pret in prets:
        # Extraire les informations nécessaires
        radio_code = pret.radio.code_barre if pret.radio else "N/A"
        radio_modele = f"{pret.radio.marque} {pret.radio.modele}" if pret.radio else "N/A"
        
        personne_nom = f"{pret.personne.nom} {pret.personne.prenom}" if pret.personne else "N/A"
        
        equipe_nom = pret.personne.equipe.nom if pret.personne and pret.personne.equipe else "N/A"
        
        cfi_nom = pret.personne.cfi.nom if pret.personne and pret.personne.cfi else "N/A"
        
        date_emprunt = pret.date_emprunt.strftime("%d/%m/%Y %H:%M") if pret.date_emprunt else "N/A"
        date_retour = pret.date_retour.strftime("%d/%m/%Y %H:%M") if pret.date_retour else "Non retourné"
        
        # Calculer la durée
        duree = "En cours"
        if pret.date_retour:
            diff = pret.date_retour - pret.date_emprunt
            days = diff.days
            hours = diff.seconds // 3600
            if days > 0:
                duree = f"{days}j {hours}h"
            else:
                duree = f"{hours}h"
        else:
            diff = datetime.now() - pret.date_emprunt
            days = diff.days
            hours = diff.seconds // 3600
            if days > 0:
                duree = f"{days}j {hours}h (en cours)"
            else:
                duree = f"{hours}h (en cours)"
        
        # Convertir les accessoires
        accessoires_text = "Aucun"
        if pret.accessoires == "oreillettes":
            accessoires_text = "Oreillettes"
        elif pret.accessoires == "micro":
            accessoires_text = "Micro"
        elif pret.accessoires == "les deux":
            accessoires_text = "Oreillettes + Micro"
        
        # Déterminer le statut
        statut = "Retourné"
        if not pret.date_retour:
            now = datetime.now()
            if (now - pret.date_emprunt).days > 7:
                statut = "En retard"
            else:
                statut = "Actif"
        
        writer.writerow([
            pret.id,
            radio_code,
            radio_modele,
            personne_nom,
            equipe_nom,
            cfi_nom,
            date_emprunt,
            date_retour,
            duree,
            accessoires_text,
            pret.commentaire or "",
            statut
        ])
    
    # Retourner le CSV
    output.seek(0)
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=historique_prets.csv"
    
    return response

@router.get("/stats")
async def get_prets_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir des statistiques sur les prêts
    """
    # Nombre total de prêts
    total_prets = db.query(func.count(Pret.id)).scalar()
    
    # Nombre de prêts actifs
    prets_actifs = db.query(func.count(Pret.id)).filter(Pret.date_retour == None).scalar()
    
    # Durée moyenne des prêts terminés
    duree_moyenne_query = db.query(
        func.avg(
            func.extract('epoch', Pret.date_retour) - func.extract('epoch', Pret.date_emprunt)
        ) / 3600  # Convertir en heures
    ).filter(Pret.date_retour != None)
    
    duree_moyenne = duree_moyenne_query.scalar() or 0
    
    # Nombre de prêts de longue durée (plus de 7 jours)
    date_limite = datetime.now() - timedelta(days=7)
    prets_long_terme = db.query(func.count(Pret.id)).filter(
        Pret.date_retour == None,
        Pret.date_emprunt < date_limite
    ).scalar()
    
    return {
        "total_prets": total_prets,
        "prets_actifs": prets_actifs,
        "duree_moyenne_heures": duree_moyenne,
        "prets_long_terme": prets_long_terme
    }

@router.get("/top/radios")
async def get_top_radios(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir le top des radios les plus empruntées
    """
    # Compter les prêts par radio
    top_radios_query = db.query(
        Pret.id_radio,
        func.count(Pret.id).label('count'),
        Radio.code_barre,
        Radio.marque,
        Radio.modele
    ).join(Radio, Pret.id_radio == Radio.id).group_by(
        Pret.id_radio, Radio.code_barre, Radio.marque, Radio.modele
    ).order_by(text('count DESC')).limit(limit)
    
    top_radios = top_radios_query.all()
    
    result = []
    for radio in top_radios:
        result.append({
            "id_radio": radio.id_radio,
            "count": radio.count,
            "code_barre": radio.code_barre,
            "label": f"{radio.code_barre} ({radio.marque} {radio.modele})"
        })
    
    return result

@router.get("/top/emprunteurs")
async def get_top_emprunteurs(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir le top des emprunteurs les plus actifs
    """
    # Compter les prêts par personne
    top_emprunteurs_query = db.query(
        Pret.id_personne,
        func.count(Pret.id).label('count'),
        Personne.code_barre,
        Personne.nom,
        Personne.prenom
    ).join(Personne, Pret.id_personne == Personne.id).group_by(
        Pret.id_personne, Personne.code_barre, Personne.nom, Personne.prenom
    ).order_by(text('count DESC')).limit(limit)
    
    top_emprunteurs = top_emprunteurs_query.all()
    
    result = []
    for personne in top_emprunteurs:
        result.append({
            "id_personne": personne.id_personne,
            "count": personne.count,
            "code_barre": personne.code_barre,
            "label": f"{personne.nom} {personne.prenom}"
        })
    
    return result

@router.get("/duree/equipes")
async def get_duree_par_equipe(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir la durée moyenne des prêts par équipe
    """
    # Durée moyenne par équipe pour les prêts terminés
    duree_par_equipe_query = db.query(
        Personne.id_equipe,
        Equipe.nom.label('equipe_nom'),
        func.avg(
            func.extract('epoch', Pret.date_retour) - func.extract('epoch', Pret.date_emprunt)
        ).label('avg_duration'),
        func.count(Pret.id).label('count')
    ).join(
        Personne, Pret.id_personne == Personne.id
    ).join(
        Equipe, Personne.id_equipe == Equipe.id
    ).filter(
        Pret.date_retour != None
    ).group_by(
        Personne.id_equipe, Equipe.nom
    ).order_by(text('avg_duration DESC'))
    
    durees = duree_par_equipe_query.all()
    
    result = []
    for duree in durees:
        # Convertir en heures
        avg_hours = duree.avg_duration / 3600 if duree.avg_duration else 0
        
        result.append({
            "id_equipe": duree.id_equipe,
            "equipe_nom": duree.equipe_nom,
            "duree_moyenne_heures": avg_hours,
            "count": duree.count
        })
    
    return result

@router.get("/activite/{periode}")
async def get_activite_par_periode(
    periode: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtenir l'activité de prêt par période (jour, semaine, mois)
    """
    # Vérifier la période
    if periode not in ['day', 'week', 'month']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La période doit être 'day', 'week' ou 'month'"
        )
    
    # Déterminer les dates par défaut si non fournies
    end = datetime.now()
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format de date fin invalide (YYYY-MM-DD attendu)"
            )
    
    # Par défaut, on prend les 6 derniers mois
    start = end - timedelta(days=180)
    
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format de date début invalide (YYYY-MM-DD attendu)"
            )
    
    # Construire la requête SQL en fonction de la période
    if periode == 'day':
        # Pour un affichage quotidien
        date_format = "DATE(date_emprunt)"
        date_format_retour = "DATE(date_retour)"
    elif periode == 'week':
        # Pour un affichage hebdomadaire
        # La fonction d'extraction de semaine peut varier selon la base de données
        # Ici on utilise une syntaxe pour SQLite mais à adapter pour PostgreSQL ou MySQL
        date_format = "strftime('%Y-%W', date_emprunt)"
        date_format_retour = "strftime('%Y-%W', date_retour)"
    else:  # month
        # Pour un affichage mensuel
        date_format = "strftime('%Y-%m', date_emprunt)"
        date_format_retour = "strftime('%Y-%m', date_retour)"
    
    # Requête pour les emprunts
    emprunt_query = text(f"""
        SELECT {date_format} as period, COUNT(*) as count
        FROM Pret
        WHERE date_emprunt BETWEEN :start AND :end
        GROUP BY {date_format}
        ORDER BY period
    """)
    
    # Requête pour les retours
    retour_query = text(f"""
        SELECT {date_format_retour} as period, COUNT(*) as count
        FROM Pret
        WHERE date_retour IS NOT NULL
        AND date_retour BETWEEN :start AND :end
        GROUP BY {date_format_retour}
        ORDER BY period
    """)
    
    # Exécuter les requêtes
    emprunts_result = db.execute(emprunt_query, {"start": start, "end": end}).fetchall()
    retours_result = db.execute(retour_query, {"start": start, "end": end}).fetchall()
    
    # Convertir les résultats en dictionnaire
    emprunts = {row[0]: row[1] for row in emprunts_result}
    retours = {row[0]: row[1] for row in retours_result}
    
    # Fusionner les périodes
    periodes = sorted(set(list(emprunts.keys()) + list(retours.keys())))
    
    # Formater le résultat
    result = []
    for p in periodes:
        periode_formatee = p
        # Formatter la période de façon plus lisible si nécessaire
        if periode == 'week':
            # Convertir YYYY-WW en "Semaine WW, YYYY"
            year, week = p.split('-')
            periode_formatee = f"Semaine {week}, {year}"
        elif periode == 'month':
            # Convertir YYYY-MM en "MM/YYYY"
            year, month = p.split('-')
            periode_formatee = f"{month}/{year}"
        
        result.append({
            "period": periode_formatee,
            "emprunts": emprunts.get(p, 0),
            "retours": retours.get(p, 0),
            "raw_period": p  # Pour le tri côté client si nécessaire
        })
    
    return result