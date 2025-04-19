document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalPersonnes = 0;
    let currentPersonneId = null;
    let deletePersonneId = null;
    let equipesCache = {}; // Cache pour stocker les équipes
    
    // Éléments DOM
    const personnesTable = document.getElementById('personnes-table');
    const personnesBody = document.getElementById('personnes-body');
    const searchInput = document.getElementById('search-personne');
    const searchBtn = document.getElementById('search-btn');
    const filterEquipe = document.getElementById('filter-equipe');
    const addPersonneBtn = document.getElementById('add-personne-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Modales
    const personneModal = document.getElementById('personne-modal');
    const deleteModal = document.getElementById('confirm-delete-modal');
    const pretsHistoryModal = document.getElementById('prets-history-modal');
    
    // Boutons de fermeture des modales
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Formulaires
    const personneForm = document.getElementById('personne-form');
    
    // Boutons d'annulation
    document.getElementById('cancel-personne').addEventListener('click', closeAllModals);
    document.getElementById('cancel-delete').addEventListener('click', closeAllModals);
    document.getElementById('close-prets-history').addEventListener('click', closeAllModals);
    
    // Boutons de confirmation
    document.getElementById('confirm-delete').addEventListener('click', deletePersonne);
    
    // Initialisation - Charger les équipes d'abord, puis les personnes
    initData();
    
    // Écouteurs d'événements
    addPersonneBtn.addEventListener('click', showAddPersonneModal);
    searchBtn.addEventListener('click', () => {
        currentPage = 1;
        loadPersonnes();
    });
    filterEquipe.addEventListener('change', () => {
        currentPage = 1;
        loadPersonnes();
    });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadPersonnes();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage * pageSize < totalPersonnes) {
            currentPage++;
            loadPersonnes();
        }
    });
    
    // Soumission des formulaires
    personneForm.addEventListener('submit', handlePersonneFormSubmit);
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            loadPersonnes();
        }
    });
    
    // Bouton de bascule entre les vues tableau et carte
    const toggleViewBtn = document.getElementById('toggle-view');
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', toggleTableView);
    }
    
    /**
     * Fonction d'initialisation asynchrone
     */
    async function initData() {
        try {
            // Charger d'abord les équipes pour construire le cache
            await loadEquipes();
            // Puis charger les CFIs
            await loadCFIs();
            // Enfin charger les personnes
            await loadPersonnes();
        } catch (error) {
            console.error('Erreur d\'initialisation:', error);
            showMessage('Erreur lors du chargement initial des données', 'error');
        }
    }
    
    /**
     * Fonctions principales
     */
    
    // Charger la liste des personnes
    async function loadPersonnes() {
        try {
            const searchTerm = searchInput.value;
            const equipeFilter = filterEquipe.value;
            const skip = (currentPage - 1) * pageSize;
            
            let url = `/api/personnes?skip=${skip}&limit=${pageSize}`;
            
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            if (equipeFilter) {
                url += `&equipe_id=${encodeURIComponent(equipeFilter)}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des personnes: ${response.statusText}`);
            }
            
            const personnes = await response.json();
            
            // Récupérer le nombre total de personnes pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalPersonnes = totalHeader ? parseInt(totalHeader) : personnes.length;
            
            // Mettre à jour l'interface
            updatePersonnesTable(personnes);
            updatePagination();
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des personnes', 'error');
        }
    }
    
    // Charger les équipes pour le filtre, le formulaire et le cache
    async function loadEquipes() {
        try {
            const response = await fetch('/api/equipes?limit=100');
            
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des équipes');
            }
            
            const equipes = await response.json();
            
            // Créer un cache des équipes pour référence rapide
            equipesCache = {};
            equipes.forEach(equipe => {
                equipesCache[equipe.id] = equipe;
            });
            
            // Mettre à jour le select de filtre
            const filterEquipeSelect = document.getElementById('filter-equipe');
            filterEquipeSelect.innerHTML = '<option value="">Toutes les équipes</option>';
            
            // Mettre à jour le select du formulaire
            const equipeSelect = document.getElementById('equipe');
            equipeSelect.innerHTML = '<option value="">Aucune équipe</option>'; // Ajouter cette option pour permettre aucune équipe
            
            equipes.forEach(equipe => {
                // Ajouter l'option au filtre
                const filterOption = document.createElement('option');
                filterOption.value = equipe.id;
                filterOption.textContent = `${equipe.nom} (${formatCategorie(equipe.categorie)})`;
                filterEquipeSelect.appendChild(filterOption);
                
                // Ajouter l'option au formulaire
                const formOption = document.createElement('option');
                formOption.value = equipe.id;
                formOption.textContent = `${equipe.nom} (${formatCategorie(equipe.categorie)})`;
                equipeSelect.appendChild(formOption);
            });
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des équipes', 'error');
        }
    }
    
    // Charger les CFIs pour le formulaire
    async function loadCFIs() {
        try {
            const response = await fetch('/api/cfis?limit=100');
            
            if (!response.ok) {
                // Si l'API pour les CFIs n'existe pas encore, ce n'est pas critique
                console.warn('API pour les CFIs non disponible');
                return;
            }
            
            const cfis = await response.json();
            
            // Mettre à jour le select du formulaire
            const cfiSelect = document.getElementById('cfi');
            cfiSelect.innerHTML = '<option value="">Aucun</option>';
            
            cfis.forEach(cfi => {
                const option = document.createElement('option');
                option.value = cfi.id;
                option.textContent = cfi.nom;
                cfiSelect.appendChild(option);
            });
            
        } catch (error) {
            console.warn('Erreur lors du chargement des CFIs:', error);
            // Ce n'est pas critique pour le fonctionnement, donc juste un warning
        }
    }
    
    // Mettre à jour le tableau des personnes
    function updatePersonnesTable(personnes) {
        personnesBody.innerHTML = '';
        
        if (personnes.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" class="text-center">Aucune personne trouvée</td>';
            personnesBody.appendChild(emptyRow);
            return;
        }
        
        personnes.forEach(personne => {
            const row = document.createElement('tr');
            
            // Formatage de la date
            const dateCreation = new Date(personne.date_creation).toLocaleDateString('fr-FR');
            
            // Récupérer le nom de l'équipe depuis le cache
            let equipeName = 'Aucune équipe';  // Modification ici : "Non assigné" devient "Aucune équipe"
            if (personne.id_equipe && equipesCache[personne.id_equipe]) {
                equipeName = equipesCache[personne.id_equipe].nom;
            } else if (personne.equipe && personne.equipe.nom) {
                // Fallback si l'équipe est incluse dans la réponse API
                equipeName = personne.equipe.nom;
            }
            
            // Récupérer le nom du CFI
            const cfiName = personne.cfi ? personne.cfi.nom : '-';
            
            row.innerHTML = `
                <td>${personne.code_barre}</td>
                <td>${personne.nom}</td>
                <td>${personne.prenom}</td>
                <td>${equipeName}</td>
                <td>${cfiName}</td>
                <td>${dateCreation}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${personne.id}" title="Modifier">
                        ✏️
                    </button>
                    <button class="action-btn history-btn" data-id="${personne.id}" data-nom="${personne.nom} ${personne.prenom}" title="Historique des prêts">
                        📋
                    </button>
                    <button class="action-btn delete-btn" data-id="${personne.id}" title="Supprimer">
                        🗑️
                    </button>
                </td>
            `;
            
            personnesBody.appendChild(row);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons d'action
        attachActionButtonListeners();
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('table-container') && 
            document.getElementById('table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable();
        }
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        const totalPages = Math.ceil(totalPersonnes / pageSize);
        
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Formater la catégorie pour l'affichage
    function formatCategorie(categorie) {
        switch (categorie) {
            case 'secours':
                return 'Secours';
            case 'logistique':
                return 'Logistique';
            case 'direction':
                return 'Direction';
            case 'externe':
                return 'Externe';
            default:
                return categorie;
        }
    }
    
    // Attacher les écouteurs aux boutons d'action
    function attachActionButtonListeners() {
        // Boutons de modification
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                const personneId = this.getAttribute('data-id');
                showEditPersonneModal(personneId);
            });
        });
        
        // Boutons d'historique
        document.querySelectorAll('.history-btn').forEach(button => {
            button.addEventListener('click', function() {
                const personneId = this.getAttribute('data-id');
                const personneName = this.getAttribute('data-nom');
                showPretsHistoryModal(personneId, personneName);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const personneId = this.getAttribute('data-id');
                showDeleteConfirmation(personneId);
            });
        });
    }
    
    // Fermer toutes les modales
    function closeAllModals() {
        personneModal.style.display = 'none';
        deleteModal.style.display = 'none';
        pretsHistoryModal.style.display = 'none';
        
        // Réinitialiser les formulaires
        personneForm.reset();
        
        // Réinitialiser les ID
        currentPersonneId = null;
        deletePersonneId = null;
    }
    
    /**
     * Gestion des modales et formulaires
     */
    
    // Modal d'ajout de personne
    function showAddPersonneModal() {
        document.getElementById('modal-title').textContent = 'Ajouter une personne';
        document.getElementById('personne-id').value = '';
        currentPersonneId = null;
        personneModal.style.display = 'flex';
    }
    
    // Modal de modification de personne
    async function showEditPersonneModal(personneId) {
        try {
            const response = await fetch(`/api/personnes/${personneId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des données de la personne');
            }
            
            const personne = await response.json();
            
            // Remplir le formulaire
            document.getElementById('modal-title').textContent = 'Modifier une personne';
            document.getElementById('personne-id').value = personne.id;
            document.getElementById('nom').value = personne.nom;
            document.getElementById('prenom').value = personne.prenom;
            document.getElementById('equipe').value = personne.id_equipe || ''; // Utiliser une chaîne vide si id_equipe est null
            document.getElementById('cfi').value = personne.id_cfi || '';
            
            currentPersonneId = personne.id;
            personneModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des données de la personne', 'error');
        }
    }
    
    // Modal de confirmation de suppression
    function showDeleteConfirmation(personneId) {
        deletePersonneId = personneId;
        deleteModal.style.display = 'flex';
    }
    
    // Modal d'historique des prêts
    async function showPretsHistoryModal(personneId, personneName) {
        try {
            const response = await fetch(`/api/personnes/${personneId}/prets`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération de l\'historique des prêts');
            }
            
            const prets = await response.json();
            
            // Mettre à jour le titre de la modal
            document.getElementById('personne-name').textContent = personneName;
            
            // Mettre à jour la table des prêts
            const pretsHistoryBody = document.getElementById('prets-history-body');
            pretsHistoryBody.innerHTML = '';
            
            if (prets.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="4" class="text-center">Aucun historique de prêts</td>';
                pretsHistoryBody.appendChild(emptyRow);
            } else {
                prets.forEach(pret => {
                    const row = document.createElement('tr');
                    
                    const dateEmprunt = new Date(pret.date_emprunt).toLocaleString('fr-FR');
                    const dateRetour = pret.date_retour ? new Date(pret.date_retour).toLocaleString('fr-FR') : '-';
                    const statut = pret.date_retour ? 'Retourné' : 'En cours';
                    const statutClass = pret.date_retour ? 'status-available' : 'status-loaned';
                    
                    row.innerHTML = `
                        <td>${pret.radio ? pret.radio.code_barre : 'RAD-?????'}</td>
                        <td>${dateEmprunt}</td>
                        <td>${dateRetour}</td>
                        <td><span class="status-badge ${statutClass}">${statut}</span></td>
                    `;
                    
                    pretsHistoryBody.appendChild(row);
                });
            }
            
            // Afficher la modal
            pretsHistoryModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement de l\'historique des prêts', 'error');
        }
    }
    
    /**
     * Gestion des actions CRUD
     */
    
    // Gérer la soumission du formulaire de personne
    async function handlePersonneFormSubmit(event) {
        event.preventDefault();
        
        try {
            const equipeValue = document.getElementById('equipe').value;
            
            const formData = {
                nom: document.getElementById('nom').value,
                prenom: document.getElementById('prenom').value,
                id_equipe: equipeValue === "" ? null : parseInt(equipeValue), // Important: convertir chaîne vide en null
                id_cfi: document.getElementById('cfi').value ? parseInt(document.getElementById('cfi').value) : null
            };
            
            let response;
            
            if (currentPersonneId) {
                // Modification
                response = await fetch(`/api/personnes/${currentPersonneId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Création
                response = await fetch('/api/personnes/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de l\'opération');
            }
            
            closeAllModals();
            loadPersonnes();
            showMessage(currentPersonneId ? 'Personne modifiée avec succès' : 'Personne ajoutée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Supprimer une personne
    async function deletePersonne() {
        try {
            const response = await fetch(`/api/personnes/${deletePersonneId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la suppression');
            }
            
            closeAllModals();
            loadPersonnes();
            showMessage('Personne supprimée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    /**
     * Fonctions pour les tableaux responsives
     */
    
    // Basculer entre la vue tableau et la vue carte
    function toggleTableView() {
        const tableContainer = document.getElementById('table-container');
        const toggleBtn = document.getElementById('toggle-view');
        
        if (tableContainer.classList.contains('card-view-enabled')) {
            // Revenir à la vue tableau
            tableContainer.classList.remove('card-view-enabled');
            toggleBtn.textContent = 'Vue carte';
        } else {
            // Passer à la vue carte
            tableContainer.classList.add('card-view-enabled');
            toggleBtn.textContent = 'Vue tableau';
            
            // Ajouter les attributs data-title aux cellules pour la vue carte
            addDataTitlesToTable();
        }
    }
    
    // Ajouter les attributs data-title aux cellules pour la vue carte
    function addDataTitlesToTable() {
        const table = document.getElementById('personnes-table');
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        
        // Pour chaque ligne
        rows.forEach(row => {
            // Pour chaque cellule de la ligne
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index < headers.length) {
                    // Ajouter l'attribut data-title avec le texte de l'en-tête correspondant
                    const headerText = headers[index].textContent.trim();
                    cell.setAttribute('data-title', headerText);
                }
            });
        });
    }
    
    /**
     * Utilitaires
     */
    
    // Afficher un message à l'utilisateur
    function showMessage(message, type = 'info') {
        // Si vous avez un système de notification, utilisez-le ici
        alert(message);
    }
});