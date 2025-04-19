from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, create_engine, CheckConstraint, event, DDL, text, Index, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from datetime import datetime
import os

# Création du moteur SQLite
DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Création d'une session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Création du modèle de base
Base = declarative_base()

# Modèle Utilisateur
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

# Modèle CFI
class CFI(Base):
    __tablename__ = "cfi"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    responsable = Column(String, nullable=False)
    adresse = Column(String, nullable=True)
    telephone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow)
    
    # Relations
    personnes = relationship("Personne", back_populates="cfi")

# Modèle Equipe
class Equipe(Base):
    __tablename__ = "equipe"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, nullable=False)
    categorie = Column(String, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow)
    
    # Contrainte pour les catégories
    __table_args__ = (
        CheckConstraint("categorie IN ('secours', 'logistique', 'direction', 'externe')", name="check_categorie"),
    )
    
    # Relations
    personnes = relationship("Personne", back_populates="equipe")

# Modèle Personne
class Personne(Base):
    __tablename__ = "personne"

    id = Column(Integer, primary_key=True, index=True)
    code_barre = Column(String, unique=True, nullable=False)
    nom = Column(String, nullable=False)
    prenom = Column(String, nullable=False)
    id_cfi = Column(Integer, ForeignKey("cfi.id"), nullable=True)
    id_equipe = Column(Integer, ForeignKey("equipe.id"), nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow)
    
    # Contrainte pour le format du code-barre
    __table_args__ = (
        CheckConstraint("code_barre LIKE 'USR-%' AND LENGTH(SUBSTR(code_barre, 5)) = 5", name="check_code_barre_format"),
        Index("idx_personne_cfi", "id_cfi"),
        Index("idx_personne_equipe", "id_equipe"),
        Index("idx_personne_code_barre", "code_barre"),
    )
    
    # Relations
    cfi = relationship("CFI", back_populates="personnes")
    equipe = relationship("Equipe", back_populates="personnes")
    prets = relationship("Pret", back_populates="personne")

# Modèle Radio
class Radio(Base):
    __tablename__ = "radio"

    id = Column(Integer, primary_key=True, index=True)
    code_barre = Column(String, unique=True, nullable=False)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    numero_serie = Column(String, nullable=True)  # Peut être null contrairement à db-final.sql
    est_geolocalisable = Column(Boolean, default=False, nullable=False)
    en_maintenance = Column(Boolean, default=False, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_modification = Column(DateTime, default=datetime.utcnow)
    
    # Contraintes pour le format du code-barre et les options d'accessoires
    __table_args__ = (
        CheckConstraint("code_barre LIKE 'RAD-%' AND LENGTH(SUBSTR(code_barre, 5)) = 5", name="check_code_barre_radio_format"),
        Index("idx_radio_maintenance", "en_maintenance"),
        Index("idx_radio_code_barre", "code_barre"),
    )
    
    # Relations
    prets = relationship("Pret", back_populates="radio")
    maintenances = relationship("Maintenance", back_populates="radio")

# Modèle Pret
class Pret(Base):
    __tablename__ = "pret"

    id = Column(Integer, primary_key=True, index=True)
    id_radio = Column(Integer, ForeignKey("radio.id"), nullable=False)
    id_personne = Column(Integer, ForeignKey("personne.id"), nullable=False)
    date_emprunt = Column(DateTime, default=datetime.utcnow)
    date_retour = Column(DateTime, nullable=True)
    commentaire = Column(String, nullable=True)
    
    __table_args__ = (
        Index("idx_pret_radio", "id_radio"),
        Index("idx_pret_personne", "id_personne"),
    )
    
    # Relations
    radio = relationship("Radio", back_populates="prets")
    personne = relationship("Personne", back_populates="prets")

# Modèle Maintenance
class Maintenance(Base):
    __tablename__ = "maintenance"

    id = Column(Integer, primary_key=True, index=True)
    id_radio = Column(Integer, ForeignKey("radio.id"), nullable=False)
    date_debut = Column(DateTime, default=datetime.utcnow)
    date_fin = Column(DateTime, nullable=True)
    description = Column(String, nullable=False)
    operateur = Column(String, nullable=False)
    
    __table_args__ = (
        Index("idx_maintenance_radio", "id_radio"),
    )
    
    # Relations
    radio = relationship("Radio", back_populates="maintenances")

# Fonction pour générer automatiquement les codes-barres
def generate_code_barre(prefix, table_name, db_session):
    try:
        # Au lieu d'utiliser sqlite_sequence, rechercher le plus grand ID existant
        max_id_query = text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
        result = db_session.execute(max_id_query).scalar()
        next_id = 1 if result is None else int(result) + 1
    except Exception as e:
        print(f"Erreur lors de la récupération de l'ID maximum: {e}")
        # En cas d'erreur, utiliser 1 comme ID par défaut
        next_id = 1
    
    # Formater le code-barre avec des zéros de remplissage
    return f"{prefix}-{next_id:05d}"

# Création des triggers SQLite pour la mise à jour des dates et la gestion de la maintenance
def create_triggers():
    # Trigger pour mise à jour date_modification de CFI
    event.listen(
        CFI.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS update_cfi_date_modification
        AFTER UPDATE ON cfi
        BEGIN
            UPDATE cfi SET date_modification = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """)
    )
    
    # Trigger pour mise à jour date_modification d'Equipe
    event.listen(
        Equipe.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS update_equipe_date_modification
        AFTER UPDATE ON equipe
        BEGIN
            UPDATE equipe SET date_modification = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """)
    )
    
    # Trigger pour mise à jour date_modification de Personne
    event.listen(
        Personne.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS update_personne_date_modification
        AFTER UPDATE ON personne
        BEGIN
            UPDATE personne SET date_modification = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """)
    )
    
    # Trigger pour mise à jour date_modification de Radio
    event.listen(
        Radio.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS update_radio_date_modification
        AFTER UPDATE ON radio
        BEGIN
            UPDATE radio SET date_modification = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        """)
    )
    
    # Trigger pour générer automatiquement le code-barre des radios
    event.listen(
        Radio.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS generate_radio_code_before_insert
        BEFORE INSERT ON radio
        WHEN NEW.code_barre IS NULL
        BEGIN
            UPDATE sqlite_sequence SET seq = seq + 1 WHERE name = 'radio';
            SELECT 'RAD-' || SUBSTR('00000' || (SELECT seq FROM sqlite_sequence WHERE name = 'radio'), -5, 5) INTO NEW.code_barre;
        END;
        """)
    )
    
    # Trigger pour générer automatiquement le code-barre des personnes
    event.listen(
        Personne.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS generate_personne_code_before_insert
        BEFORE INSERT ON personne
        WHEN NEW.code_barre IS NULL
        BEGIN
            UPDATE sqlite_sequence SET seq = seq + 1 WHERE name = 'personne';
            SELECT 'USR-' || SUBSTR('00000' || (SELECT seq FROM sqlite_sequence WHERE name = 'personne'), -5, 5) INTO NEW.code_barre;
        END;
        """)
    )
    
    # Trigger pour mettre à jour automatiquement le flag de maintenance quand une radio est mise en maintenance
    event.listen(
        Maintenance.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS set_radio_maintenance_on_insert
        AFTER INSERT ON maintenance
        WHEN NEW.date_fin IS NULL
        BEGIN
            UPDATE radio SET en_maintenance = 1 WHERE id = NEW.id_radio;
        END;
        """)
    )
    
    # Trigger pour désactiver le flag de maintenance quand la maintenance est terminée
    event.listen(
        Maintenance.__table__,
        'after_create',
        DDL("""
        CREATE TRIGGER IF NOT EXISTS unset_radio_maintenance_on_update
        AFTER UPDATE ON maintenance
        WHEN NEW.date_fin IS NOT NULL AND OLD.date_fin IS NULL
        BEGIN
            UPDATE radio SET en_maintenance = 0
            WHERE id = NEW.id_radio
            AND NOT EXISTS (
                SELECT 1 FROM maintenance
                WHERE id_radio = NEW.id_radio AND id != NEW.id AND date_fin IS NULL
            );
        END;
        """)
    )

# Fonction pour ajouter des événements avant insertion
def add_before_insert_listeners():
    # Listener pour générer automatiquement le code-barre des radios en Python (fallback)
    @event.listens_for(Radio, 'before_insert')
    def generate_radio_code_before_insert(mapper, connection, radio):
        if radio.code_barre is None:
            # Utiliser une nouvelle session pour éviter les conflits
            with SessionLocal() as session:
                radio.code_barre = generate_code_barre("RAD", "radio", session)
    
    # Listener pour générer automatiquement le code-barre des personnes en Python (fallback)
    @event.listens_for(Personne, 'before_insert')
    def generate_personne_code_before_insert(mapper, connection, personne):
        if personne.code_barre is None:
            # Utiliser une nouvelle session pour éviter les conflits
            with SessionLocal() as session:
                personne.code_barre = generate_code_barre("USR", "personne", session)

# Données initiales pour les catégories d'équipes
def seed_initial_data():
    db = SessionLocal()
    try:
        # Vérifier si des données existent déjà
        equipe_count = db.query(Equipe).count()
        
        if equipe_count == 0:
            # Insérer les équipes initiales
            equipes = [
                Equipe(nom='Équipe de secours 1', categorie='secours'),
                Equipe(nom='Équipe de secours 2', categorie='secours'),
                Equipe(nom='Équipe de secours 3', categorie='secours'),
                Equipe(nom='Logistique principale', categorie='logistique'),
                Equipe(nom='Logistique support', categorie='logistique'),
                Equipe(nom='Direction DPS', categorie='direction'),
                Equipe(nom='Équipe externe', categorie='externe')
            ]
            db.add_all(equipes)
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Erreur lors de l'insertion des données initiales: {e}")
    finally:
        db.close()

# Création des tables
def create_tables():
    Base.metadata.create_all(bind=engine)
    create_triggers()
    add_before_insert_listeners()

# Obtenir une session de base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialisation de la base de données
def init_db():
    create_tables()
    seed_initial_data()

# Exécuter si le script est lancé directement
if __name__ == "__main__":
    init_db()