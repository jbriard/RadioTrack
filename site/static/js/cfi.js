document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalCFIs = 0;
    let currentCFIId = null;
    let deleteCFIId = null;
    let currentCFINom = '';
    
    // Éléments DOM
    const cfisTable = document.getElementById('cfis-table');
    const cfisBody = document.getElementById('cfis-body');
    const searchInput = document.getElementById('search-cfi');
    const searchBtn = document.getElementById('search-btn');
    const addCFIBtn = document.getElementById('add-cfi-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Modales
    const cfiModal = document.getElementById('cfi-modal');
    const deleteModal = document.getElementById('confirm-delete-modal');
    const membresModal = document.getElementById('membres-modal');
    const addMembreModal = document.getElementById('add-membre-modal');
    
    // Boutons de fermeture des modales
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Formulaires
    const cfiForm = document.getElementById('cfi-form');
    
    // Boutons d'annulation
    document.getElementById('cancel-cfi').addEventListener('click', closeAllModals);
    document.getElementById('cancel-delete').addEventListener('click', closeAllModals);
    document.getElementById('close-membres').addEventListener('click', closeAllModals);
    document.getElementById('cancel-add-membre').addEventListener('click', () => {
        addMembreModal.style.display = 'none';
    });
    
    // Boutons de confirmation
    document.getElementById('confirm-delete').addEventListener('click', deleteCFI);
    
    // Bouton pour ajouter un membre
    document.getElementById('add-membre-btn').addEventListener('click', showAddMembreModal);
    
    // Recherche de membres disponibles
    const searchAvailableMembre = document.getElementById('search-available-membre');
    searchAvailableMembre.addEventListener('input', function() {
        loadAvailableMembres(searchAvailableMembre.value);
    });
    
    // Initialisation
    loadCFIs();
    
    // Écouteurs d'événements
    addCFIBtn.addEventListener('click', showAddCFIModal);
    searchBtn.addEventListener('click', () => {
        currentPage = 1;
        loadCFIs();
    });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadCFIs();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage * pageSize < totalCFIs) {
            currentPage++;
            loadCFIs();
        }
    });
    
    // Soumission des formulaires
    cfiForm.addEventListener('submit', handleCFIFormSubmit);
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            loadCFIs();
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
    
    // Charger la liste des CFIs
    async function loadCFIs() {
        try {
            const searchTerm = searchInput.value;
            const skip = (currentPage - 1) * pageSize;
            
            let url = `/api/cfis?skip=${skip}&limit=${pageSize}`;
            
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des CFIs: ${response.statusText}`);
            }
            
            const cfis = await response.json();
            
            // Récupérer le nombre total de CFIs pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalCFIs = totalHeader ? parseInt(totalHeader) : cfis.length;
            
            // Mettre à jour l'interface
            updateCFIsTable(cfis);
            updatePagination();
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des CFIs', 'error');
        }
    }
    
    // Mettre à jour le tableau des CFIs
    function updateCFIsTable(cfis) {
        cfisBody.innerHTML = '';
        
        if (cfis.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" class="text-center">Aucun CFI trouvé</td>';
            cfisBody.appendChild(emptyRow);
            return;
        }
        
        cfis.forEach(cfi => {
            const row = document.createElement('tr');
            
            // Formatage des données
            const membresCount = '<span class="loading-indicator">Chargement...</span>';
            
            row.innerHTML = `
                <td>${cfi.id}</td>
                <td>${cfi.nom}</td>
                <td>${cfi.responsable}</td>
                <td>${cfi.email || '-'}</td>
                <td>${cfi.telephone || '-'}</td>
                <td data-cfi-id="${cfi.id}">${membresCount}</td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${cfi.id}" title="Modifier">
                        ✏️
                    </button>
                    <button class="action-btn membres-btn" data-id="${cfi.id}" data-nom="${cfi.nom}" title="Gérer les membres">
                        👥
                    </button>
                    <button class="action-btn delete-btn" data-id="${cfi.id}" title="Supprimer">
                        🗑️
                    </button>
                </td>
            `;
            
            cfisBody.appendChild(row);
            
            // Charger le nombre de membres pour ce CFI
            loadMembresCount(cfi.id);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons d'action
        attachActionButtonListeners();
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('table-container') && 
            document.getElementById('table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable();
        }
    }
    
    // Charger le nombre de membres pour un CFI
    async function loadMembresCount(cfiId) {
        try {
            const response = await fetch(`/api/cfis/${cfiId}/membres`);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des membres: ${response.statusText}`);
            }
            
            const membres = await response.json();
            
            // Mettre à jour la cellule avec le nombre de membres
            const cell = document.querySelector(`td[data-cfi-id="${cfiId}"]`);
            if (cell) {
                cell.textContent = membres.length;
            }
            
        } catch (error) {
            console.error('Erreur:', error);
            const cell = document.querySelector(`td[data-cfi-id="${cfiId}"]`);
            if (cell) {
                cell.textContent = 'Erreur';
            }
        }
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        const totalPages = Math.ceil(totalCFIs / pageSize);
        
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Attacher les écouteurs aux boutons d'action
    function attachActionButtonListeners() {
        // Boutons de modification
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                const cfiId = this.getAttribute('data-id');
                showEditCFIModal(cfiId);
            });
        });
        
        // Boutons de gestion des membres
        document.querySelectorAll('.membres-btn').forEach(button => {
            button.addEventListener('click', function() {
                const cfiId = this.getAttribute('data-id');
                const cfiName = this.getAttribute('data-nom');
                showMembresModal(cfiId, cfiName);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const cfiId = this.getAttribute('data-id');
                showDeleteConfirmation(cfiId);
            });
        });
    }
    
    // Fermer toutes les modales
    function closeAllModals() {
        cfiModal.style.display = 'none';
        deleteModal.style.display = 'none';
        membresModal.style.display = 'none';
        addMembreModal.style.display = 'none';
        
        // Réinitialiser les formulaires
        cfiForm.reset();
        
        // Réinitialiser les ID
        currentCFIId = null;
        deleteCFIId = null;
        currentCFINom = '';
    }
    
    /**
     * Gestion des modales et formulaires
     */
    
    // Modal d'ajout de CFI
    function showAddCFIModal() {
        document.getElementById('modal-title').textContent = 'Ajouter un CFI';
        document.getElementById('cfi-id').value = '';
        currentCFIId = null;
        cfiModal.style.display = 'flex';
    }
    
    // Modal de modification de CFI
    async function showEditCFIModal(cfiId) {
        try {
            const response = await fetch(`/api/cfis/${cfiId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des données du CFI');
            }
            
            const cfi = await response.json();
            
            // Remplir le formulaire
            document.getElementById('modal-title').textContent = 'Modifier un CFI';
            document.getElementById('cfi-id').value = cfi.id;
            document.getElementById('nom').value = cfi.nom;
            document.getElementById('responsable').value = cfi.responsable;
            document.getElementById('adresse').value = cfi.adresse || '';
            document.getElementById('telephone').value = cfi.telephone || '';
            document.getElementById('email').value = cfi.email || '';
            
            currentCFIId = cfi.id;
            cfiModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des données du CFI', 'error');
        }
    }
    
    // Modal de confirmation de suppression
    function showDeleteConfirmation(cfiId) {
        deleteCFIId = cfiId;
        deleteModal.style.display = 'flex';
    }
    
    // Modal de gestion des membres
    async function showMembresModal(cfiId, cfiName) {
        try {
            const response = await fetch(`/api/cfis/${cfiId}/membres`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des membres du CFI');
            }
            
            const membres = await response.json();
            
            // Mettre à jour le titre de la modal
            document.getElementById('cfi-name').textContent = cfiName;
            
            // Mettre à jour la table des membres
            const membresBody = document.getElementById('membres-body');
            membresBody.innerHTML = '';
            
            if (membres.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="4" class="text-center">Aucun membre dans ce CFI</td>';
                membresBody.appendChild(emptyRow);
            } else {
                membres.forEach(membre => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${membre.code_barre}</td>
                        <td>${membre.nom}</td>
                        <td>${membre.prenom}</td>
                        <td class="actions-cell">
                            <button class="action-btn remove-membre-btn" data-id="${membre.id}" title="Retirer du CFI">
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
                        removeMembreFromCFI(cfiId, personneId);
                    });
                });
            }
            
            // Stocker les données pour l'ajout de membres
            currentCFIId = cfiId;
            currentCFINom = cfiName;
            
            // Afficher la modal
            membresModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des membres du CFI', 'error');
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
            
            // Filtrer pour exclure les personnes déjà dans ce CFI
            // et inclure celles qui n'ont pas de CFI ou sont dans un autre CFI
            personnes = personnes.filter(personne => 
                personne.id_cfi !== currentCFIId || 
                personne.id_cfi === null || 
                personne.id_cfi === undefined
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
                    
                    // Ajouter une indication sur le CFI actuel
                    let statut = personne.id_cfi ? 
                        `Actuellement dans : ${personne.cfi?.nom || `CFI #${personne.id_cfi}`}` : 
                        'Sans CFI';
                    
                    row.innerHTML = `
                        <td>${personne.code_barre}</td>
                        <td>${personne.nom}</td>
                        <td>${personne.prenom}</td>
                        <td class="actions-cell">
                            <small>${statut}</small>
                            <button class="action-btn add-to-cfi-btn" data-id="${personne.id}" title="Ajouter au CFI">
                                ➕
                            </button>
                        </td>
                    `;
                    
                    availableMembresBody.appendChild(row);
                });
                
                // Ajouter les écouteurs pour les boutons d'ajout
                document.querySelectorAll('.add-to-cfi-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const personneId = this.getAttribute('data-id');
                        addMembreToCFI(currentCFIId, personneId);
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
    
    // Gérer la soumission du formulaire de CFI
    async function handleCFIFormSubmit(event) {
        event.preventDefault();
        
        try {
            const formData = {
                nom: document.getElementById('nom').value,
                responsable: document.getElementById('responsable').value,
                adresse: document.getElementById('adresse').value,
                telephone: document.getElementById('telephone').value,
                email: document.getElementById('email').value
            };
            
            let response;
            
            if (currentCFIId) {
                // Modification
                response = await fetch(`/api/cfis/${currentCFIId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                // Création
                response = await fetch('/api/cfis/', {
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
            loadCFIs();
            showMessage(currentCFIId ? 'CFI modifié avec succès' : 'CFI ajouté avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Supprimer un CFI
    async function deleteCFI() {
        try {
            const response = await fetch(`/api/cfis/${deleteCFIId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la suppression');
            }
            
            closeAllModals();
            loadCFIs();
            showMessage('CFI supprimé avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Ajouter un membre à un CFI
    async function addMembreToCFI(cfiId, personneId) {
        try {
            const response = await fetch(`/api/cfis/${cfiId}/membres/${personneId}`, {
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
    
    // Retirer un membre d'un CFI
    async function removeMembreFromCFI(cfiId, personneId) {
        try {
            const response = await fetch(`/api/cfis/${cfiId}/membres/${personneId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors du retrait du membre');
            }
            
            // Rafraîchir la liste des membres du CFI
            await showMembresModal(cfiId, currentCFINom);
            
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
        const table = document.getElementById('cfis-table');
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