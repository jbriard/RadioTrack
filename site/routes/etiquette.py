from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from database import get_db, Radio, Personne, Equipe
from auth import get_current_active_user, User
from barcode_generator import barcode_generator
import json

router = APIRouter(prefix="/api/etiquettes", tags=["etiquettes"])

@router.get("/preview")
async def generate_barcode_preview(
    code: str,
    label: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Génère une prévisualisation d'un code-barre au format Base64
    """
    try:
        image_base64 = barcode_generator.generate_barcode_image(code, label)
        return {"image": image_base64}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération de la prévisualisation: {str(e)}"
        )

@router.get("/single", response_class=StreamingResponse)
async def generate_single_barcode(
    code: str,
    label: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Génère un PDF contenant un seul code-barre
    """
    try:
        pdf_buffer = barcode_generator.generate_single_barcode_pdf(code, label)
        
        # Créer un nom de fichier basé sur le code
        filename = f"barcode_{code.replace('-', '_')}.pdf"
        
        # Retourner le PDF comme un téléchargement
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            pdf_buffer, 
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du PDF: {str(e)}"
        )

@router.post("/multiple", response_class=StreamingResponse)
async def generate_multiple_barcodes(
    codes: List[dict],
    current_user: User = Depends(get_current_active_user)
):
    """
    Génère un PDF contenant plusieurs codes-barres
    """
    try:
        # Vérifier le format des données
        for code_data in codes:
            if "code" not in code_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Chaque élément doit contenir un champ 'code'"
                )
        
        pdf_buffer = barcode_generator.generate_multiple_barcodes_pdf(codes)
        
        # Créer un nom de fichier
        filename = f"multiple_barcodes_{len(codes)}.pdf"
        
        # Retourner le PDF comme un téléchargement
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            pdf_buffer, 
            media_type="application/pdf",
            headers=headers
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du PDF: {str(e)}"
        )

@router.get("/radios")
async def get_radios_for_barcodes(
    search: Optional[str] = None,
    disponible: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupère les informations des radios pour générer des codes-barres
    """
    try:
        query = db.query(Radio)
        
        # Appliquer les filtres
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Radio.code_barre.ilike(search_term)) | 
                (Radio.marque.ilike(search_term)) | 
                (Radio.modele.ilike(search_term))
            )
        
        # Filtrer les radios disponibles si demandé
        if disponible:
            query = query.filter(Radio.en_maintenance == False)
            
            # Cette partie est plus complexe car on doit vérifier les prêts actifs
            # Pour plus de simplicité ici, on pourrait créer une vue ou ajouter un champ virtuel
            # Je vais simplifier cela pour l'exemple, mais en production il faudrait optimiser cette requête
        
        # Récupérer les radios
        radios = query.all()
        
        # Formater les données pour l'interface
        result = []
        for radio in radios:
            result.append({
                "id": radio.id,
                "code": radio.code_barre,
                "label": f"{radio.marque} {radio.modele}",
                "details": {
                    "marque": radio.marque,
                    "modele": radio.modele,
                    "numero_serie": radio.numero_serie,
                    "est_geolocalisable": radio.est_geolocalisable,
                    "en_maintenance": radio.en_maintenance
                }
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des radios: {str(e)}"
        )

@router.get("/personnes")
async def get_personnes_for_barcodes(
    search: Optional[str] = None,
    equipe_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupère les informations des personnes pour générer des codes-barres
    """
    try:
        query = db.query(Personne)
        
        # Appliquer les filtres
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Personne.code_barre.ilike(search_term)) | 
                (Personne.nom.ilike(search_term)) | 
                (Personne.prenom.ilike(search_term))
            )
        
        if equipe_id:
            query = query.filter(Personne.id_equipe == equipe_id)
        
        # Récupérer les personnes
        personnes = query.all()
        
        # Formater les données pour l'interface
        result = []
        for personne in personnes:
            # Récupérer le nom de l'équipe si disponible
            equipe_nom = None
            if personne.id_equipe and personne.equipe:
                equipe_nom = personne.equipe.nom
            
            result.append({
                "id": personne.id,
                "code": personne.code_barre,
                "label": f"{personne.nom} {personne.prenom}",
                "details": {
                    "nom": personne.nom,
                    "prenom": personne.prenom,
                    "equipe": equipe_nom,
                    "id_equipe": personne.id_equipe
                }
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des personnes: {str(e)}"
        )

@router.get("/equipes")
async def get_equipes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Récupère la liste des équipes pour le filtre
    """
    try:
        equipes = db.query(Equipe).all()
        
        result = []
        for equipe in equipes:
            result.append({
                "id": equipe.id,
                "nom": equipe.nom,
                "categorie": equipe.categorie
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération des équipes: {str(e)}"
        )

@router.get("/all-radios", response_class=StreamingResponse)
async def generate_all_radios_barcodes(
    disponible: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Génère un PDF avec les codes-barres de toutes les radios ou des radios disponibles
    """
    try:
        query = db.query(Radio)
        
        # Filtrer les radios disponibles si demandé
        if disponible:
            query = query.filter(Radio.en_maintenance == False)
        
        radios = query.all()
        
        if not radios:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucune radio trouvée"
            )
        
        # Préparer les données pour la génération du PDF
        codes = []
        for radio in radios:
            codes.append({
                "code": radio.code_barre,
                "label": f"{radio.marque} {radio.modele}"
            })
        
        # Générer le PDF
        pdf_buffer = barcode_generator.generate_multiple_barcodes_pdf(codes)
        
        # Créer un nom de fichier
        filename = "radios_barcodes.pdf"
        if disponible:
            filename = "radios_disponibles_barcodes.pdf"
        
        # Retourner le PDF comme un téléchargement
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            pdf_buffer, 
            media_type="application/pdf",
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du PDF: {str(e)}"
        )

@router.get("/all-personnes", response_class=StreamingResponse)
async def generate_all_personnes_barcodes(
    equipe_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Génère un PDF avec les codes-barres de toutes les personnes ou des personnes d'une équipe spécifique
    """
    try:
        query = db.query(Personne)
        
        # Filtrer par équipe si demandé
        if equipe_id:
            query = query.filter(Personne.id_equipe == equipe_id)
            
            # Vérifier si l'équipe existe
            equipe = db.query(Equipe).filter(Equipe.id == equipe_id).first()
            if not equipe:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Équipe avec l'ID {equipe_id} non trouvée"
                )
        
        personnes = query.all()
        
        if not personnes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucune personne trouvée"
            )
        
        # Préparer les données pour la génération du PDF
        codes = []
        for personne in personnes:
            codes.append({
                "code": personne.code_barre,
                "label": f"{personne.nom} {personne.prenom}"
            })
        
        # Générer le PDF
        pdf_buffer = barcode_generator.generate_multiple_barcodes_pdf(codes)
        
        # Créer un nom de fichier
        filename = "personnes_barcodes.pdf"
        if equipe_id:
            equipe_name = db.query(Equipe).filter(Equipe.id == equipe_id).first().nom
            filename = f"equipe_{equipe_name}_barcodes.pdf"
        
        # Retourner le PDF comme un téléchargement
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            pdf_buffer, 
            media_type="application/pdf",
            headers=headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du PDF: {str(e)}"
        )