document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalRadios = 0;
    let currentRadioId = null;
    let deleteRadioId = null;
    
    // Éléments DOM
    const radiosTable = document.getElementById('radios-table');
    const radiosBody = document.getElementById('radios-body');
    const searchInput = document.getElementById('search-radio');
    const searchBtn = document.getElementById('search-btn');
    const filterStatus = document.getElementById('filter-status');
    const addRadioBtn = document.getElementById('add-radio-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Modales
    const radioModal = document.getElementById('radio-modal');
    const maintenanceModal = document.getElementById('maintenance-modal');
    const deleteModal = document.getElementById('confirm-delete-modal');
    const maintenanceHistoryModal = document.getElementById('maintenance-history-modal');
    
    // Boutons de fermeture des modales
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Formulaires
    const radioForm = document.getElementById('radio-form');
    const maintenanceForm = document.getElementById('maintenance-form');
    
    // Boutons d'annulation
    document.getElementById('cancel-radio').addEventListener('click', closeAllModals);
    document.getElementById('cancel-maintenance').addEventListener('click', closeAllModals);
    document.getElementById('cancel-delete').addEventListener('click', closeAllModals);
    document.getElementById('close-maintenance-history').addEventListener('click', closeAllModals);
    
    // Boutons de confirmation
    document.getElementById('confirm-delete').addEventListener('click', deleteRadio);
    
    // Initialisation
    loadRadios();
    
    // Écouteurs d'événements
    addRadioBtn.addEventListener('click', showAddRadioModal);
    searchBtn.addEventListener('click', () => {
        currentPage = 1;
        loadRadios();
    });
    filterStatus.addEventListener('change', () => {
        currentPage = 1;
        loadRadios();
    });
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadRadios();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (currentPage * pageSize < totalRadios) {
            currentPage++;
            loadRadios();
        }
    });
    
    // Soumission des formulaires
    radioForm.addEventListener('submit', handleRadioFormSubmit);
    maintenanceForm.addEventListener('submit', handleMaintenanceFormSubmit);
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            currentPage = 1;
            loadRadios();
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
    
    // Charger la liste des radios
    async function loadRadios() {
        try {
            const searchTerm = searchInput.value;
            const statusFilter = filterStatus.value;
            const skip = (currentPage - 1) * pageSize;
            
            let url = `/api/radios?skip=${skip}&limit=${pageSize}`;
            
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }
            
            if (statusFilter === 'en_maintenance') {
                url += '&maintenance=true';
            } else if (statusFilter === 'en_pret') {
                // Nouvelle option pour filtrer les radios en prêt
                url += '&en_pret=true';
            } else if (statusFilter === 'disponible') {
                // Option pour filtrer les radios disponibles
                url += '&disponible=true';
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur lors du chargement des radios: ${response.statusText}`);
            }
            
            const radios = await response.json();
            
            // Récupérer le nombre total de radios pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalRadios = totalHeader ? parseInt(totalHeader) : radios.length;
            
            console.log(`Nombre total de radios: ${totalRadios}, Page actuelle: ${currentPage}, Taille de page: ${pageSize}`);
            
            // Pour chaque radio, vérifier si elle est en prêt avant de mettre à jour l'interface
            const radioWithLoanStatus = await Promise.all(
                radios.map(async (radio) => {
                    // Vérifier si la radio est en prêt
                    const isLoaned = await checkRadioLoaned(radio.id);
                    return { ...radio, isLoaned };
                })
            );
            
            // Mettre à jour l'interface avec les statuts de prêt
            updateRadiosTable(radioWithLoanStatus);
            updatePagination();
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des radios', 'error');
        }
    }
    
    // Mettre à jour le tableau des radios
    function updateRadiosTable(radios) {
        radiosBody.innerHTML = '';
        
        if (radios.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" class="text-center">Aucune radio trouvée</td>';
            radiosBody.appendChild(emptyRow);
            return;
        }
        
        radios.forEach(radio => {
            const row = document.createElement('tr');
            
            // Déterminer le statut - maintenant nous utilisons directement la propriété isLoaned
            let statut = 'Disponible';
            let statutClass = 'status-available';
            let enMaintenance = radio.en_maintenance;
            let enPret = radio.isLoaned;
            
            if (enMaintenance) {
                statut = 'En maintenance';
                statutClass = 'status-maintenance';
            } else if (enPret) {
                statut = 'En prêt';
                statutClass = 'status-loaned';
            }
            
            row.innerHTML = `
                <td>${radio.code_barre}</td>
                <td>${radio.marque}</td>
                <td>${radio.modele}</td>
                <td>${radio.numero_serie || ''}</td>
                <td>${radio.est_geolocalisable ? 'Oui' : 'Non'}</td>
                <td><span class="status-badge ${statutClass}">${statut}</span></td>
                <td class="actions-cell">
                    <button class="action-btn edit-btn" data-id="${radio.id}" title="Modifier" ${enMaintenance || enPret ? 'disabled' : ''}>
                        ✏️
                    </button>
                    ${enMaintenance ? 
                        `<button class="action-btn end-maintenance-direct-btn" data-id="${radio.id}" title="Sortir de maintenance">
                            🔄
                        </button>` : 
                        `<button class="action-btn maintenance-btn" data-id="${radio.id}" title="Maintenance" ${enPret ? 'disabled' : ''}>
                            🔧
                        </button>`
                    }
                    <button class="action-btn history-btn" data-id="${radio.id}" title="Historique">
                        📋
                    </button>
                    <button class="action-btn delete-btn" data-id="${radio.id}" title="Supprimer" ${enMaintenance || enPret ? 'disabled' : ''}>
                        🗑️
                    </button>
                </td>
            `;
            
            radiosBody.appendChild(row);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons d'action
        attachActionButtonListeners();
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('table-container') && 
            document.getElementById('table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable();
        }
    }
    
    // Vérifier si une radio est en prêt
    async function checkRadioLoaned(radioId) {
        try {
            // Option 1: Utiliser l'endpoint spécifique pour vérifier si la radio est en prêt
            const response = await fetch(`/api/radios/${radioId}/en-pret`);
            
            if (!response.ok) {
                throw new Error(`Erreur lors de la vérification du statut de prêt: ${response.statusText}`);
            }
            
            return await response.json();
            
            // Option 2: Récupérer les détails de la radio et vérifier les prêts
            /*
            const response = await fetch(`/api/radios/${radioId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur lors de la récupération des détails de la radio: ${response.statusText}`);
            }
            
            const radioDetails = await response.json();
            
            // Vérifier si la radio a des prêts actifs (sans date de retour)
            return radioDetails.prets && radioDetails.prets.some(pret => !pret.date_retour);
            */
            
        } catch (error) {
            console.error(`Erreur lors de la vérification des prêts pour la radio ${radioId}:`, error);
            return false;
        }
    }
    
    // Attacher les écouteurs aux boutons d'action
    function attachActionButtonListeners() {
        // Boutons de modification
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                if (this.disabled) return;
                const radioId = this.getAttribute('data-id');
                showEditRadioModal(radioId);
            });
        });
        
        // Boutons de maintenance
        document.querySelectorAll('.maintenance-btn').forEach(button => {
            button.addEventListener('click', function() {
                if (this.disabled) return;
                const radioId = this.getAttribute('data-id');
                showMaintenanceModal(radioId);
            });
        });
        
        // Boutons de sortie de maintenance directe
        document.querySelectorAll('.end-maintenance-direct-btn').forEach(button => {
            button.addEventListener('click', function() {
                const radioId = this.getAttribute('data-id');
                endMaintenanceDirect(radioId);
            });
        });
        
        // Boutons d'historique de maintenance
        document.querySelectorAll('.history-btn').forEach(button => {
            button.addEventListener('click', function() {
                const radioId = this.getAttribute('data-id');
                showMaintenanceHistoryModal(radioId);
            });
        });
        
        // Boutons de suppression
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                if (this.disabled) return;
                const radioId = this.getAttribute('data-id');
                showDeleteConfirmation(radioId);
            });
        });
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        const totalPages = Math.ceil(totalRadios / pageSize);
        console.log(`Mise à jour pagination: ${currentPage}/${totalPages} (Total: ${totalRadios})`);
        
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Fermer toutes les modales
    function closeAllModals() {
        radioModal.style.display = 'none';
        maintenanceModal.style.display = 'none';
        deleteModal.style.display = 'none';
        maintenanceHistoryModal.style.display = 'none';
        
        // Réinitialiser les formulaires
        radioForm.reset();
        maintenanceForm.reset();
        
        // Réinitialiser les ID
        currentRadioId = null;
        deleteRadioId = null;
    }
    
    /**
     * Gestion des modales et formulaires
     */
    
    // Modal d'ajout de radio
    function showAddRadioModal() {
        document.getElementById('modal-title').textContent = 'Ajouter une radio';
        document.getElementById('radio-id').value = '';
        currentRadioId = null;
        radioModal.style.display = 'flex';
    }
    
    // Modal de modification de radio
    async function showEditRadioModal(radioId) {
        try {
            const response = await fetch(`/api/radios/${radioId}`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des données de la radio');
            }
            
            const radio = await response.json();
            
            // Vérifier si la radio est en prêt
            const isLoaned = radio.prets && radio.prets.some(pret => !pret.date_retour);
            
            if (isLoaned) {
                showMessage('Impossible de modifier une radio actuellement en prêt', 'error');
                return;
            }
            
            // Remplir le formulaire
            document.getElementById('modal-title').textContent = 'Modifier une radio';
            document.getElementById('radio-id').value = radio.id;
            document.getElementById('marque').value = radio.marque;
            document.getElementById('modele').value = radio.modele;
            document.getElementById('numero-serie').value = radio.numero_serie || '';
            document.getElementById('geolocalisable').checked = radio.est_geolocalisable;
            
            currentRadioId = radio.id;
            radioModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des données de la radio', 'error');
        }
    }
    
    // Modal de maintenance
    async function showMaintenanceModal(radioId) {
        try {
            // Vérifier si la radio est en prêt avant de permettre la mise en maintenance
            const isLoaned = await checkRadioLoaned(radioId);
            
            if (isLoaned) {
                showMessage('Impossible de mettre en maintenance une radio actuellement en prêt', 'error');
                return;
            }
            
            document.getElementById('maintenance-radio-id').value = radioId;
            document.getElementById('operateur').value = ''; // Valeur par défaut à remplacer par l'utilisateur actuel si possible
            maintenanceModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la vérification du statut de la radio', 'error');
        }
    }
    
    // Modal de confirmation de suppression
    async function showDeleteConfirmation(radioId) {
        try {
            // Vérifier si la radio est en prêt avant de permettre la suppression
            const isLoaned = await checkRadioLoaned(radioId);
            
            if (isLoaned) {
                showMessage('Impossible de supprimer une radio actuellement en prêt', 'error');
                return;
            }
            
            deleteRadioId = radioId;
            deleteModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la vérification du statut de la radio', 'error');
        }
    }
    
    // Modal d'historique des maintenances
    async function showMaintenanceHistoryModal(radioId) {
        try {
            const response = await fetch(`/api/radios/${radioId}/maintenance`);
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération de l\'historique de maintenance');
            }
            
            const maintenances = await response.json();
            const maintenanceHistoryBody = document.getElementById('maintenance-history-body');
            maintenanceHistoryBody.innerHTML = '';
            
            if (maintenances.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="5" class="text-center">Aucun historique de maintenance</td>';
                maintenanceHistoryBody.appendChild(emptyRow);
            } else {
                maintenances.forEach(maintenance => {
                    const row = document.createElement('tr');
                    const dateDebut = new Date(maintenance.date_debut).toLocaleString('fr-FR');
                    const dateFin = maintenance.date_fin ? new Date(maintenance.date_fin).toLocaleString('fr-FR') : 'En cours';
                    
                    row.innerHTML = `
                        <td>${dateDebut}</td>
                        <td>${dateFin}</td>
                        <td>${maintenance.description}</td>
                        <td>${maintenance.operateur}</td>
                        <td class="actions-cell">
                            ${dateFin === 'En cours' ? 
                            `<button class="action-btn end-maintenance-btn" data-radio-id="${radioId}" data-id="${maintenance.id}">
                                Terminer
                            </button>` : ''}
                        </td>
                    `;
                    
                    maintenanceHistoryBody.appendChild(row);
                });
                
                // Ajouter des écouteurs pour les boutons de fin de maintenance
                document.querySelectorAll('.end-maintenance-btn').forEach(button => {
                    button.addEventListener('click', function() {
                        const maintenanceId = this.getAttribute('data-id');
                        const radioId = this.getAttribute('data-radio-id');
                        endMaintenance(radioId, maintenanceId);
                    });
                });
            }
            
            maintenanceHistoryModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement de l\'historique de maintenance', 'error');
        }
    }
    
    // Sortir directement une radio de la maintenance
    async function endMaintenanceDirect(radioId) {
        try {
            // D'abord, récupérer la maintenance active
            const response = await fetch(`/api/radios/${radioId}/maintenance`);
            
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des maintenances');
            }
            
            const maintenances = await response.json();
            
            // Trouver la maintenance active (celle qui n'a pas de date_fin)
            const activeMaintenance = maintenances.find(m => !m.date_fin);
            
            if (!activeMaintenance) {
                throw new Error('Aucune maintenance active trouvée pour cette radio');
            }
            
            // Terminer la maintenance
            await endMaintenance(radioId, activeMaintenance.id);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    /**
     * Gestion des actions CRUD
     */
    
    // Gérer la soumission du formulaire de radio
async function handleRadioFormSubmit(event) {
    event.preventDefault();
    
    try {
        const formData = {
            marque: document.getElementById('marque').value,
            modele: document.getElementById('modele').value,
            numero_serie: document.getElementById('numero-serie').value,
            est_geolocalisable: document.getElementById('geolocalisable').checked
            // Le champ accessoires a été retiré car déplacé vers la table Pret
        };
        
        let response;
        
        if (currentRadioId) {
            // Modification
            response = await fetch(`/api/radios/${currentRadioId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Création
            response = await fetch('/api/radios/', {
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
        loadRadios();
        showMessage(currentRadioId ? 'Radio modifiée avec succès' : 'Radio ajoutée avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur:', error);
        showMessage(error.message, 'error');
    }
}
    
    // Gérer la soumission du formulaire de maintenance
    async function handleMaintenanceFormSubmit(event) {
        event.preventDefault();
        
        try {
            const radioId = document.getElementById('maintenance-radio-id').value;
            const formData = {
                description: document.getElementById('description').value,
                operateur: document.getElementById('operateur').value
            };
            
            const response = await fetch(`/api/radios/${radioId}/maintenance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la mise en maintenance');
            }
            
            closeAllModals();
            loadRadios();
            showMessage('Radio mise en maintenance avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Terminer une maintenance
    async function endMaintenance(radioId, maintenanceId) {
        try {
            const response = await fetch(`/api/radios/${radioId}/maintenance/${maintenanceId}/end`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la fin de maintenance');
            }
            
            closeAllModals();
            loadRadios();
            showMessage('Maintenance terminée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Supprimer une radio
    async function deleteRadio() {
        try {
            const response = await fetch(`/api/radios/${deleteRadioId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la suppression');
            }
            
            closeAllModals();
            loadRadios();
            showMessage('Radio supprimée avec succès', 'success');
            
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
        const table = document.getElementById('radios-table');
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