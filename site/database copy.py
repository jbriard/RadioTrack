from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, CheckConstraint, event, DDL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.schema import Index, UniqueConstraint
from datetime import datetime
import os

# Création de la connexion à la base de données
DATABASE_URL = "sqlite:///./radio_tracker.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Définition des modèles SQLAlchemy
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class CFI(Base):
    __tablename__ = "CFI"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String, nullable=False)
    responsable = Column(String, nullable=False)
    adresse = Column(String)
    telephone = Column(String)
    email = Column(String)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    personnes = relationship("Personne", back_populates="cfi")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_cfi_nom', 'nom'),
    )

class Equipe(Base):
    __tablename__ = "Equipe"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    nom = Column(String, nullable=False)
    categorie = Column(String, CheckConstraint("categorie IN ('secours', 'logistique', 'direction', 'externe')"), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    membres = relationship("Personne", back_populates="equipe")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_equipe_nom', 'nom'),
        Index('idx_equipe_categorie', 'categorie'),
    )

class Personne(Base):
    __tablename__ = "Personne"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code_barre = Column(String, unique=True)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    id_cfi = Column(Integer, ForeignKey("CFI.id"), nullable=True)
    id_equipe = Column(Integer, ForeignKey("Equipe.id"), nullable=True)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cfi = relationship("CFI", back_populates="personnes")
    equipe = relationship("Equipe", back_populates="membres")
    prets = relationship("Pret", back_populates="personne")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_personne_nom_prenom', 'nom', 'prenom'),
        Index('idx_personne_code_barre', 'code_barre'),
        Index('idx_personne_id_cfi', 'id_cfi'),
        Index('idx_personne_id_equipe', 'id_equipe'),
    )

class Radio(Base):
    __tablename__ = "Radio"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code_barre = Column(String, unique=True)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    numero_serie = Column(String)
    est_geolocalisable = Column(Boolean, default=False, nullable=False)
    # La colonne accessoires a été retirée car elle est maintenant dans la table Pret
    en_maintenance = Column(Boolean, default=False, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    prets = relationship("Pret", back_populates="radio")
    maintenances = relationship("Maintenance", back_populates="radio")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_radio_code_barre', 'code_barre'),
        Index('idx_radio_marque_modele', 'marque', 'modele'),
        Index('idx_radio_maintenance', 'en_maintenance'),
    )

class Pret(Base):
    __tablename__ = "Pret"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    id_radio = Column(Integer, ForeignKey("Radio.id"), nullable=False)
    id_personne = Column(Integer, ForeignKey("Personne.id"), nullable=False)
    date_emprunt = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_retour = Column(DateTime, nullable=True)
    commentaire = Column(Text, nullable=True)
    # Nouvelle colonne pour les accessoires
    accessoires = Column(String, CheckConstraint("accessoires IN ('oreillettes', 'micro', 'les deux', 'aucun')"), 
                         nullable=False, default="aucun")
    
    radio = relationship("Radio", back_populates="prets")
    personne = relationship("Personne", back_populates="prets")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_pret_id_radio', 'id_radio'),
        Index('idx_pret_id_personne', 'id_personne'),
        Index('idx_pret_date_emprunt', 'date_emprunt'),
        Index('idx_pret_date_retour', 'date_retour'),
        # Index composite pour trouver rapidement les prêts actifs (sans date de retour)
        Index('idx_pret_actif', 'id_radio', 'date_retour'),
    )

class Maintenance(Base):
    __tablename__ = "Maintenance"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    id_radio = Column(Integer, ForeignKey("Radio.id"), nullable=False)
    date_debut = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_fin = Column(DateTime, nullable=True)
    description = Column(Text, nullable=False)
    operateur = Column(String, nullable=False)
    
    radio = relationship("Radio", back_populates="maintenances")
    
    # Index pour optimiser les recherches
    __table_args__ = (
        Index('idx_maintenance_id_radio', 'id_radio'),
        Index('idx_maintenance_date_debut', 'date_debut'),
        Index('idx_maintenance_date_fin', 'date_fin'),
        # Index composite pour trouver rapidement les maintenances actives (sans date de fin)
        Index('idx_maintenance_active', 'id_radio', 'date_fin'),
    )

# Définition des triggers

# Trigger pour générer le code barre des radios
radio_code_barre_trigger = DDL(
    """
    CREATE TRIGGER IF NOT EXISTS generate_radio_code_barre
    AFTER INSERT ON Radio
    FOR EACH ROW
    WHEN NEW.code_barre IS NULL
    BEGIN
        UPDATE Radio
        SET code_barre = 'RAD-' || substr('00000' || NEW.id, -5, 5)
        WHERE id = NEW.id;
    END;
    """
)

# Trigger pour générer le code barre des personnes
personne_code_barre_trigger = DDL(
    """
    CREATE TRIGGER IF NOT EXISTS generate_personne_code_barre
    AFTER INSERT ON Personne
    FOR EACH ROW
    WHEN NEW.code_barre IS NULL
    BEGIN
        UPDATE Personne
        SET code_barre = 'USR-' || substr('00000' || NEW.id, -5, 5)
        WHERE id = NEW.id;
    END;
    """
)

# Trigger pour mettre à jour le statut en_maintenance d'une radio lors de l'ajout d'une maintenance
update_radio_maintenance_add_trigger = DDL(
    """
    CREATE TRIGGER IF NOT EXISTS update_radio_maintenance_status_insert
    AFTER INSERT ON Maintenance
    FOR EACH ROW
    BEGIN
        UPDATE Radio SET en_maintenance = 1 WHERE id = NEW.id_radio;
    END;
    """
)

# Trigger pour mettre à jour le statut en_maintenance d'une radio lors de la mise à jour d'une maintenance
update_radio_maintenance_update_trigger = DDL(
    """
    CREATE TRIGGER IF NOT EXISTS update_radio_maintenance_status_update
    AFTER UPDATE ON Maintenance
    FOR EACH ROW
    WHEN NEW.date_fin IS NOT NULL AND OLD.date_fin IS NULL
    BEGIN
        UPDATE Radio 
        SET en_maintenance = 
            CASE WHEN (
                SELECT COUNT(*) 
                FROM Maintenance 
                WHERE id_radio = NEW.id_radio AND date_fin IS NULL
            ) = 0 THEN 0 ELSE 1 END
        WHERE id = NEW.id_radio;
    END;
    """
)

# Enregistrement des triggers après la création des tables
event.listen(Radio.__table__, 'after_create', radio_code_barre_trigger)
event.listen(Personne.__table__, 'after_create', personne_code_barre_trigger)
event.listen(Maintenance.__table__, 'after_create', update_radio_maintenance_add_trigger)
event.listen(Maintenance.__table__, 'after_create', update_radio_maintenance_update_trigger)

# Fonction pour récupérer une session de base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Fonction pour créer les tables dans la base de données
def create_tables():
    Base.metadata.create_all(bind=engine)

# Fonction pour exécuter des commandes SQL directement
def execute_sql(sql):
    with engine.connect() as conn:
        conn.execute(sql)
        conn.commit()

# Fonction pour vérifier et mettre à jour le schéma si nécessaire
def init_db():
    # Création des tables si elles n'existent pas déjà
    create_tables()
    
    # Mettre à jour la structure de la table Radio si nécessaire
    try:
        # Vérifier si la colonne accessoires existe encore dans la table Radio
        execute_sql("SELECT accessoires FROM Radio LIMIT 1")
        # Si aucune exception n'est levée, cela signifie que la colonne existe encore
        # On exécute la migration pour la retirer
        print("Migration: suppression de la colonne accessoires de la table Radio")
        execute_sql("ALTER TABLE Radio DROP COLUMN accessoires")
    except Exception:
        # La colonne n'existe pas ou a déjà été supprimée
        pass
    
    # Vérifier si la colonne accessoires existe dans la table Pret
    try:
        execute_sql("SELECT accessoires FROM Pret LIMIT 1")
        # Si aucune exception n'est levée, la colonne existe déjà
    except Exception:
        # La colonne n'existe pas, on l'ajoute
        print("Migration: ajout de la colonne accessoires à la table Pret")
        execute_sql("""
            ALTER TABLE Pret 
            ADD COLUMN accessoires TEXT 
            CHECK(accessoires IN ('oreillettes', 'micro', 'les deux', 'aucun')) 
            NOT NULL 
            DEFAULT 'aucun'
        """)
    
    print("Base de données initialisée avec succès.")

# Si ce fichier est exécuté directement, initialiser la base de données
if __name__ == "__main__":
    init_db()