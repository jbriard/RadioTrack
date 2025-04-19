document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalEquipes = 0;
    let currentEquipeId = null;
    let deleteEquipeId = null;
    let currentEquipeNom = '';
    
    // Éléments DOM
    const equipesTable = document.getElementById('equipes-table');
    const equipesBody = document.getElementById('equipes-body');
    const searchInput = document.getElementById('search-equipe');
    const searchBtn = document.getElementById('search-btn');
    const filterCategorie = document.getElementById('filter-categorie');
    const addEquipeBtn = document.getElementById('add-equipe-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Modales
    const equipeModal = document.getElementById('equipe-modal');
    const deleteModal = document.getElementById('confirm-delete-modal');
    const membresModal = document.getElementById('membres-modal');
    const addMembreModal = document.getElementById('add-membre-modal');
    
    // Boutons de fermeture des modales
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Formulaires
    const equipeForm = document.getElementById('equipe-form');
    
    // Boutons d'annulation
    document.getElementById('cancel-equipe').addEventListener('click', closeAllModals);
    document.getElementById('cancel-delete').addEventListener('click', closeAllModals);
    document.getElementById('close-membres').addEventListener('click', closeAllModals);
    document.getElementById('cancel-add-membre').addEventListener('click', () => {
        addMembreModal.style.display = 'none';
    });
    
    // Boutons de confirmation
    document.getElementById('confirm-delete').addEventListener('click', deleteEquipe);
    
    // Bouton pour ajouter un membre
    document.getElementById('add-membre-btn').addEventListener('click', showAddMembreModal);
    
    // Recherche de membres disponibles
    const searchAvailableMembre = document.getElementById('search-available-membre');
    searchAvailableMembre.addEventListener('input', function() {
        loadAvailableMembres(searchAvailableMembre.value);
    });
    
    // Initialisation
    loadEquipes();
    
    // Écouteurs d'événements
    addEquipeBtn.addEventListener('click', showAddEquipeModal);
    searchBtn.addEventListener('click', () => {
        currentPage = 1;
        loadEquipes();
    });
    filterCategorie.addEventListener('change', () => {
        currentPage = 1;
        loadEquipes();
    });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadEquipes();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage * pageSize < totalEquipes) {
            currentPage++;
            loadEquipes();
        }
    });
    
    // Soumission des formulaires
    equipeForm.addEventListener('submit', handleEquipeFormSubmit);
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            loadEquipes();
        }
    });
    
    // Bouton de bascule entre les vues tableau et carte
    const toggleViewBtn = document.getElementById('toggle-view');
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', toggleTableView);
    }
    
    /**
     * Fonctions principales
     */
    
    // Charger la liste des équipes
    async function loadEquipes() {
        try {
            const searchTerm = searchInput.value;
            const categorieFilter = filterCategorie.value;
            const skip = (currentPage - 1) * pageSize;
            
            let url = `/api/equipes?skip=${skip}&limit=${pageSize}`;
            
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            if (categorieFilter) {
                url += `&categorie=${encodeURIComponent(categorieFilter)}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des équipes: ${response.statusText}`);
            }
            
            const equipes = await response.json();
            
            // Récupérer le nombre total d'équipes pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalEquipes = totalHeader ? parseInt(totalHeader) : equipes.length;
            
            // Mettre à jour l'interface
            updateEquipesTable(equipes);
            updatePagination();
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des équipes', 'error');
        }
    }
    
    // Mettre à jour le tableau des équipes
    function updateEquipesTable(equipes) {
        equipesBody.innerHTML = '';
        
        if (equipes.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="6" class="text-center">Aucune équipe trouvée</td>';
            equipesBody.appendChild(emptyRow);
            return;
        }
        
        equipes.forEach(equipe => {
            const row = document.createElement('tr');
            
            // Formatage de la date
            const dateCreation = new Date(equipe.date_creation).toLocaleDateString('fr-FR');
            
            // Formatage de la catégorie
            const categorie = formatCategorie(equipe.categorie);
            
            row.innerHTML = `
                <td>${equipe.id}</td>
                <td>${equipe.nom}</td>
                <td>${categorie}</td>
                <td><!-- Sera rempli via l'API --></td>
                <td>${dateCreation}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${equipe.id}" title="Modifier">
                        ✏️
                    </button>
                    <button class="action-btn membres-btn" data-id="${equipe.id}" data-nom="${equipe.nom}" title="Gérer les membres">
                        👥
                    </button>
                    <button class="action-btn delete-btn" data-id="${equipe.id}" title="Supprimer">
                        🗑️
                    </button>
                </td>
            `;
            
            equipesBody.appendChild(row);
            
            // Charger le nombre de membres pour cette équipe
            loadMembresCount(equipe.id, row.cells[3]);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons d'action
        attachActionButtonListeners();
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('table-container') && 
            document.getElementById('table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable();
        }
    }
    
    // Charger le nombre de membres pour une équipe
    async function loadMembresCount(equipeId, cell) {
        try {
            const response = await fetch(`/api/equipes/${equipeId}/membres`);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des membres: ${response.statusText}`);
            }
            
            const membres = await response.json();
            
            // Mettre à jour la cellule avec le nombre de membres
            cell.textContent = membres.length;
            
        } catch (error) {
            console.error('Erreur:', error);
            cell.textContent = 'Erreur';
        }
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        const totalPages = Math.ceil(totalEquipes / pageSize);
        
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
                const equipeId = this.getAttribute('data-id');
                showEditEquipeModal(equipeId);
            });
        });
        
        // Boutons de gestion des membres
        document.querySelectorAll('.membres-btn').forEach(button => {
            button.addEventListener('click', function() {
                const equipeId = this.getAttribute('data-id');
                const equipeName = this.getAttribute('data-nom');
                showMembresModal(equipeId, equipeName);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const equipeId = this.getAttribute('data-id');
                showDeleteConfirmation(equipeId);
            });
        });
    }
    
    // Fermer toutes les modales
    function closeAllModals() {
        equipeModal.style.display = 'none';
        deleteModal.style.display = 'none';
        membresModal.style.display = 'none';
        addMembreModal.style.display = 'none';
        
        // Réinitialiser les formulaires
        equipeForm.reset();
        
        // Réinitialiser les ID
        currentEquipeId = null;
        deleteEquipeId = null;
        currentEquipeNom = '';
    }
    
    /**
     * Gestion des modales et formulaires
     */
    
    // Modal d'ajout d'équipe
    function showAddEquipeModal() {
        document.getElementById('modal-title').textContent = 'Ajouter une équipe';
        document.getElementById('equipe-id').value = '';
        currentEquipeId = null;
        equipeModal.style.display = 'flex';
    }
    
    // Modal de modification d'équipe
    async function showEditEquipeModal(equipeId) {
        try {
            const response = await fetch(`/api/equipes/${equipeId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des données de l\'équipe');
            }
            
            const equipe = await response.json();
            
            // Remplir le formulaire
            document.getElementById('modal-title').textContent = 'Modifier une équipe';
            document.getElementById('equipe-id').value = equipe.id;
            document.getElementById('nom').value = equipe.nom;
            document.getElementById('categorie').value = equipe.categorie;
            
            currentEquipeId = equipe.id;
            equipeModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des données de l\'équipe', 'error');
        }
    }
    
    // Modal de confirmation de suppression
    function showDeleteConfirmation(equipeId) {
        deleteEquipeId = equipeId;
        deleteModal.style.display = 'flex';
    }
    
    // Modal de gestion des membres
    async function showMembresModal(equipeId, equipeName) {
        try {
            const response = await fetch(`/api/equipes/${equipeId}/membres`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des membres de l\'équipe');
            }
            
            const membres = await response.json();
            
            // Mettre à jour le titre de la modal
            document.getElementById('equipe-name').textContent = equipeName;
            
            // Mettre à jour la table des membres
            const membresBody = document.getElementById('membres-body');
            membresBody.innerHTML = '';
            
            if (membres.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="4" class="text-center">Aucun membre dans cette équipe</td>';
                membresBody.appendChild(emptyRow);
            } else {
                membres.forEach(membre => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${membre.code_barre}</td>
                        <td>${membre.nom}</td>
                        <td>${membre.prenom}</td>
                        <td class="actions-cell">
                            <button class="action-btn remove-membre-btn" data-id="${membre.id}" title="Retirer de l'équipe">
                                ❌
                            </button>
                        </td>
                    `;
                    
                    membresBody.appendChild(row);
                });
                
                // Ajouter les écouteurs pour les boutons de retrait
                document.querySelectorAll('.remove-membre-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const personneId = this.getAttribute('data-id');
                        removeMembreFromEquipe(equipeId, personneId);
                    });
                });
            }
            
            // Stocker les données pour l'ajout de membres
            currentEquipeId = equipeId;
            currentEquipeNom = equipeName;
            
            // Afficher la modal
            membresModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des membres de l\'équipe', 'error');
        }
    }
    
    // Modal d'ajout de membre
    async function showAddMembreModal() {
        // Réinitialiser la recherche
        document.getElementById('search-available-membre').value = '';
        
        // Charger les membres disponibles
        await loadAvailableMembres('');
        
        // Afficher la modal
        addMembreModal.style.display = 'flex';
    }
    
    // Charger les membres disponibles pour l'ajout
    async function loadAvailableMembres(searchTerm) {
        try {
            let url = `/api/personnes?limit=50`;
            
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des personnes disponibles');
            }
            
            let personnes = await response.json();
            
            // Filtrer pour exclure les personnes déjà dans cette équipe
            // et inclure celles qui n'ont pas d'équipe ou sont dans une autre équipe
            personnes = personnes.filter(personne => 
                personne.id_equipe !== currentEquipeId || 
                personne.id_equipe === null || 
                personne.id_equipe === undefined
            );
            
            // Mettre à jour la table des membres disponibles
            const availableMembresBody = document.getElementById('available-membres-body');
            availableMembresBody.innerHTML = '';
            
            if (personnes.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="4" class="text-center">Aucune personne disponible</td>';
                availableMembresBody.appendChild(emptyRow);
            } else {
                personnes.forEach(personne => {
                    const row = document.createElement('tr');
                    
                    // Ajouter une indication sur l'équipe actuelle
                    let statut = personne.id_equipe ? 
                        `Actuellement dans : ${personnes.equipe?.nom || `Équipe #${personne.id_equipe}`}` : 
                        'Sans équipe';
                    
                    row.innerHTML = `
                        <td>${personne.code_barre}</td>
                        <td>${personne.nom}</td>
                        <td>${personne.prenom}</td>
                        <td class="actions-cell">
                            <small>${statut}</small>
                            <button class="action-btn add-to-equipe-btn" data-id="${personne.id}" title="Ajouter à l'équipe">
                                ➕
                            </button>
                        </td>
                    `;
                    
                    availableMembresBody.appendChild(row);
                });
                
                // Ajouter les écouteurs pour les boutons d'ajout
                document.querySelectorAll('.add-to-equipe-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const personneId = this.getAttribute('data-id');
                        addMembreToEquipe(currentEquipeId, personneId);
                    });
                });
            }
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des personnes disponibles', 'error');
        }
    }
    
    
    /**
     * Gestion des actions CRUD
     */
    
    // Gérer la soumission du formulaire d'équipe
    async function handleEquipeFormSubmit(event) {
        event.preventDefault();
        
        try {
            const formData = {
                nom: document.getElementById('nom').value,
                categorie: document.getElementById('categorie').value
            };
            
            let response;
            
            if (currentEquipeId) {
                // Modification
                response = await fetch(`/api/equipes/${currentEquipeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Création
                response = await fetch('/api/equipes/', {
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
            loadEquipes();
            showMessage(currentEquipeId ? 'Équipe modifiée avec succès' : 'Équipe ajoutée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Supprimer une équipe
    async function deleteEquipe() {
        try {
            const response = await fetch(`/api/equipes/${deleteEquipeId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la suppression');
            }
            
            closeAllModals();
            loadEquipes();
            showMessage('Équipe supprimée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Ajouter un membre à une équipe
    async function addMembreToEquipe(equipeId, personneId) {
        try {
            const response = await fetch(`/api/equipes/${equipeId}/membres/${personneId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de l\'ajout du membre');
            }
            
            // Rafraîchir la liste des membres disponibles
            await loadAvailableMembres(document.getElementById('search-available-membre').value);
            
            // Afficher un message de succès
            showMessage('Membre ajouté avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Retirer un membre d'une équipe
    async function removeMembreFromEquipe(equipeId, personneId) {
        try {
            const response = await fetch(`/api/equipes/${equipeId}/membres/${personneId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors du retrait du membre');
            }
            
            // Rafraîchir la liste des membres de l'équipe
            await showMembresModal(equipeId, currentEquipeNom);
            
            // Afficher un message de succès
            showMessage('Membre retiré avec succès', 'success');
            
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
        const table = document.getElementById('equipes-table');
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