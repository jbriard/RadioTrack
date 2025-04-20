from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code39
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
import os
from fastapi import HTTPException, status
from typing import List, Optional, Union
from PIL import Image, ImageDraw, ImageFont
import base64
from datetime import datetime

# Constantes pour les dimensions des cartes CR80
CR80_WIDTH = 85.5 * mm  # Largeur de carte de crédit en mm
CR80_HEIGHT = 54 * mm   # Hauteur de carte de crédit en mm

# Marge interne pour le contenu sur la carte
MARGIN = 5 * mm

# Dimensions relatives pour la position du code-barre sur la carte
BARCODE_HEIGHT = 15 * mm
BARCODE_TOP_POSITION = 20 * mm  # Position depuis le haut de la carte

class BarcodeGenerator:
    def __init__(self):
        """Initialise le générateur de codes-barres"""
        # Enregistrer les polices nécessaires
        try:
            # Essayer d'enregistrer une police robuste pour texte standard
            pdfmetrics.registerFont(TTFont('Arial', 'Arial.ttf'))
            self.font_name = 'Arial'
        except:
            # Fallback sur la police par défaut si Arial n'est pas disponible
            self.font_name = 'Helvetica'
    
    def generate_single_barcode_pdf(self, code: str, label: Optional[str] = None) -> BytesIO:
        """
        Génère un PDF contenant un seul code-barre au format CR80
        
        Args:
            code: Le code à encoder en Code-39
            label: Étiquette optionnelle à afficher sous le code-barre
        
        Returns:
            BytesIO: Flux contenant le PDF généré
        """
        # Créer un buffer pour stocker le PDF
        buffer = BytesIO()
        
        # Créer un document PDF de taille A4
        pdf = canvas.Canvas(buffer, pagesize=A4)
        
        # Position centrée sur la page pour la carte
        x_center = A4[0] / 2
        y_center = A4[1] / 2
        
        # Dessiner la carte centrée sur la page
        self._draw_card(
            pdf=pdf,
            x=x_center - (CR80_WIDTH / 2),
            y=y_center - (CR80_HEIGHT / 2),
            code=code,
            label=label
        )
        
        # Finaliser le PDF
        pdf.showPage()
        pdf.save()
        
        # Rembobiner le buffer pour pouvoir le lire
        buffer.seek(0)
        return buffer
    
    def generate_multiple_barcodes_pdf(self, codes: List[dict]) -> BytesIO:
        """
        Génère un PDF contenant plusieurs codes-barres au format CR80
        
        Args:
            codes: Liste de dictionnaires {code, label} à encoder
        
        Returns:
            BytesIO: Flux contenant le PDF généré
        """
        # Créer un buffer pour stocker le PDF
        buffer = BytesIO()
        
        # Créer un document PDF de taille A4
        pdf = canvas.Canvas(buffer, pagesize=A4)
        
        # Pour la mise en page à une seule carte par ligne, alignée à gauche
        # Définir la marge gauche et la marge supérieure
        margin_left = 20 * mm  # Marge à gauche
        margin_top = 20 * mm   # Marge au sommet
        
        # Espacement vertical entre les cartes
        vertical_spacing = 10 * mm
        
        # Nombre de cartes par page (une seule par ligne)
        cards_per_page = int((A4[1] - 2 * margin_top) // (CR80_HEIGHT + vertical_spacing))
        
        # Ajuster si nécessaire pour éviter des problèmes avec certaines imprimantes
        if cards_per_page < 1:
            cards_per_page = 1
        
        # Tracer les cartes
        page_count = 0
        for i, code_data in enumerate(codes):
            # Calculer la position sur la page
            page_position = i % cards_per_page
            
            # Vérifier si une nouvelle page est nécessaire
            if page_position == 0 and i > 0:
                pdf.showPage()
                page_count += 1
            
            # Dessiner la carte (alignée à gauche, une par ligne)
            x = margin_left
            y = A4[1] - margin_top - ((page_position + 1) * (CR80_HEIGHT + vertical_spacing)) + vertical_spacing
            
            self._draw_card(
                pdf=pdf,
                x=x,
                y=y,
                code=code_data.get("code"),
                label=code_data.get("label")
            )
        
        # Finaliser le PDF
        pdf.showPage()
        pdf.save()
        
        # Rembobiner le buffer pour pouvoir le lire
        buffer.seek(0)
        return buffer
    
    def _draw_card(self, pdf, x, y, code, label=None):
        """
        Dessine une carte CR80 avec code-barre à une position donnée
        
        Args:
            pdf: L'objet canvas ReportLab
            x, y: Position du coin inférieur gauche de la carte
            code: Le code à encoder
            label: Étiquette optionnelle
        """
        # Dessiner le contour de la carte (rectangle aux dimensions CR80)
        pdf.setStrokeColorRGB(0.8, 0.8, 0.8)  # Gris clair
        pdf.setLineWidth(0.5)
        pdf.rect(x, y, CR80_WIDTH, CR80_HEIGHT)
        
        # Dessiner le logo SNSM en haut de la carte (ajuster les dimensions selon votre logo)
        # pdf.drawImage("static/images/Les_Sauveteurs_en_Mer.webp", x + 10*mm, y + CR80_HEIGHT - 20*mm, width=20*mm, height=15*mm)
        
        # Titre de la carte
        pdf.setFont(self.font_name, 12)
        pdf.setFillColorRGB(0, 0.2, 0.4)  # Bleu marine (adapt
        if code.startswith("RAD-"):
            title = "RADIO SNSM"
        elif code.startswith("USR-"):
            title = "PERSONNEL SNSM"
        else:
            title = "CODE-BARRE SNSM"
        
        pdf.drawCentredString(x + CR80_WIDTH/2, y + CR80_HEIGHT - 10*mm, title)
        
        # Générer et dessiner le code-barre
        barcode = code39.Standard39(code, barWidth=0.5*mm, barHeight=BARCODE_HEIGHT, checksum=0)
        barcode.drawOn(pdf, x + MARGIN, y + BARCODE_TOP_POSITION)
        
        # Dessiner le code sous le code-barre
        pdf.setFont(self.font_name, 10)
        pdf.setFillColorRGB(0, 0, 0)  # Noir
        pdf.drawCentredString(x + CR80_WIDTH/2, y + BARCODE_TOP_POSITION - 7*mm, code)
        
        # Information additionnelle si fournie
        if label:
            pdf.setFont(self.font_name, 9)
            # Limiter la longueur du label pour éviter les débordements
            if len(label) > 25:
                label = label[:25] + "..."
            pdf.drawCentredString(x + CR80_WIDTH/2, y + 10*mm, label)
        
        # Date d'impression en bas de la carte
        pdf.setFont(self.font_name, 6)
        pdf.setFillColorRGB(0.5, 0.5, 0.5)  # Gris
        current_date = datetime.now().strftime("%d/%m/%Y")
        pdf.drawCentredString(x + CR80_WIDTH/2, y + 5*mm, f"Généré le {current_date}")
    
    def generate_barcode_image(self, code: str, label: Optional[str] = None) -> str:
        """
        Génère une image PNG du code-barre et retourne son encodage Base64
        Utile pour la prévisualisation dans l'interface web
        
        Args:
            code: Le code à encoder
            label: Étiquette optionnelle
            
        Returns:
            str: L'image encodée en Base64
        """
        # Créer une image vide avec les dimensions de la carte CR80
        # Conversion des mm en pixels (approximativement 3.8 pixels par mm à 96 DPI)
        px_per_mm = 3.8
        width = int(CR80_WIDTH / mm * px_per_mm)
        height = int(CR80_HEIGHT / mm * px_per_mm)
        
        image = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # Dessiner un cadre autour de la carte
        draw.rectangle([(0, 0), (width-1, height-1)], outline=(200, 200, 200), width=2)
        
        # Ajouter un titre
        try:
            font_title = ImageFont.truetype("Arial.ttf", 14)
            font_code = ImageFont.truetype("Arial.ttf", 12)
            font_small = ImageFont.truetype("Arial.ttf", 10)
        except:
            # Fallback sur les polices par défaut
            font_title = ImageFont.load_default()
            font_code = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # Titre basé sur le type de code
        if code.startswith("RAD-"):
            title = "RADIO SNSM"
        elif code.startswith("USR-"):
            title = "PERSONNEL SNSM"
        else:
            title = "CODE-BARRE SNSM"
        
        # Calculer la position du texte centré
        w, h = draw.textsize(title, font=font_title) if hasattr(draw, 'textsize') else (100, 20)
        draw.text(((width-w)/2, 20), title, fill=(0, 51, 102), font=font_title)
        
        # Nous ne pouvons pas générer un vrai code-barre ici, donc simulons-en un
        # Dessiner un rectangle noir pour représenter un code-barre
        barcode_height = int(BARCODE_HEIGHT / mm * px_per_mm)
        barcode_y = int(height / 2 - barcode_height / 2)
        barcode_margin = int(MARGIN / mm * px_per_mm)
        
        # Dessiner des lignes verticales de largeur variable pour simuler un code-barre
        import random
        x = barcode_margin
        while x < width - barcode_margin:
            bar_width = random.randint(2, 8)
            if random.random() > 0.5:  # 50% de chance de dessiner une barre
                draw.rectangle([(x, barcode_y), (x + bar_width, barcode_y + barcode_height)], fill=(0, 0, 0))
            x += bar_width + random.randint(2, 6)
        
        # Afficher le code sous le code-barre
        w, h = draw.textsize(code, font=font_code) if hasattr(draw, 'textsize') else (80, 15)
        draw.text(((width-w)/2, barcode_y + barcode_height + 10), code, fill=(0, 0, 0), font=font_code)
        
        # Afficher le label si fourni
        if label:
            if len(label) > 25:
                label = label[:25] + "..."
            w, h = draw.textsize(label, font=font_small) if hasattr(draw, 'textsize') else (150, 12)
            draw.text(((width-w)/2, height - 40), label, fill=(0, 0, 0), font=font_small)
        
        # Date d'impression en bas
        current_date = f"Généré le {datetime.now().strftime('%d/%m/%Y')}"
        w, h = draw.textsize(current_date, font=font_small) if hasattr(draw, 'textsize') else (100, 10)
        draw.text(((width-w)/2, height - 20), current_date, fill=(128, 128, 128), font=font_small)
        
        # Convertir l'image en base64
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"


# Singleton pour utilisation dans l'application
barcode_generator = BarcodeGenerator()