document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalMaintenances = 0;
    let currentFilter = {
        search: '',
        status: 'all',
        date: 'all'
    };
    let currentMaintenanceId = null;
    let currentRadioId = null;
    
    // Éléments DOM
    const searchInput = document.getElementById('search-maintenance');
    const searchBtn = document.getElementById('search-btn');
    const filterStatus = document.getElementById('filter-status');
    const filterDate = document.getElementById('filter-date');
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-maintenance-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Statistiques
    const maintenanceCount = document.getElementById('maintenance-count');
    const avgMaintenanceDuration = document.getElementById('avg-maintenance-duration');
    const monthMaintenanceCount = document.getElementById('month-maintenance-count');
    
    // Tableaux
    const activeMaintenanceBody = document.getElementById('active-maintenance-body');
    const maintenanceHistoryBody = document.getElementById('maintenance-history-body');
    
    // Gestion des onglets
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Modales
    const endMaintenanceModal = document.getElementById('end-maintenance-modal');
    const maintenanceDetailsModal = document.getElementById('maintenance-details-modal');
    
    // Fermeture des modales
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Boutons d'annulation
    document.getElementById('cancel-end-maintenance').addEventListener('click', closeAllModals);
    document.getElementById('close-details').addEventListener('click', closeAllModals);
    
    // Formulaires
    const endMaintenanceForm = document.getElementById('end-maintenance-form');
    
    // Boutons de vue
    const toggleViewActiveBtn = document.getElementById('toggle-view-active');
    const toggleViewHistoryBtn = document.getElementById('toggle-view-history');
    
    // Initialisation
    loadStatistics();
    loadActiveMaintenances();
    loadMaintenanceHistory();
    
    // Écouteurs d'événements
    refreshBtn.addEventListener('click', refreshData);
    exportBtn.addEventListener('click', exportMaintenanceHistory);
    
    searchBtn.addEventListener('click', () => {
        currentFilter.search = searchInput.value;
        currentPage = 1;
        loadMaintenanceHistory();
    });
    
    filterStatus.addEventListener('change', () => {
        currentFilter.status = filterStatus.value;
        currentPage = 1;
        loadMaintenanceHistory();
    });
    
    filterDate.addEventListener('change', () => {
        currentFilter.date = filterDate.value;
        currentPage = 1;
        loadMaintenanceHistory();
    });
    
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadMaintenanceHistory();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        if (currentPage * pageSize < totalMaintenances) {
            currentPage++;
            loadMaintenanceHistory();
        }
    });
    
    // Recherche avec la touche Entrée
    searchInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            currentFilter.search = searchInput.value;
            currentPage = 1;
            loadMaintenanceHistory();
        }
    });
    
    // Gestion des onglets
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            
            // Mettre à jour les classes actives
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activer l'onglet sélectionné
            this.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        });
    });
    
    // Basculer entre les vues tableau et carte
    toggleViewActiveBtn.addEventListener('click', () => {
        toggleTableView('active-table-container', toggleViewActiveBtn);
    });
    
    toggleViewHistoryBtn.addEventListener('click', () => {
        toggleTableView('history-table-container', toggleViewHistoryBtn);
    });
    
    // Soumission du formulaire pour terminer une maintenance
    endMaintenanceForm.addEventListener('submit', handleEndMaintenanceSubmit);
    
    /**
     * Fonctions principales
     */
    
    // Charger les statistiques de maintenance
    async function loadStatistics() {
        try {
            const response = await fetch('/api/maintenance/statistics');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const stats = await response.json();
            
            // Mettre à jour l'interface
            maintenanceCount.textContent = stats.active_count || '0';
            avgMaintenanceDuration.textContent = stats.average_duration || 'N/A';
            monthMaintenanceCount.textContent = stats.month_count || '0';
            
        } catch (error) {
            console.error('Erreur lors du chargement des statistiques:', error);
            
            // Valeurs par défaut en cas d'erreur
            maintenanceCount.textContent = 'Erreur';
            avgMaintenanceDuration.textContent = 'Erreur';
            monthMaintenanceCount.textContent = 'Erreur';
        }
    }
    
    // Charger les maintenances actives
    async function loadActiveMaintenances() {
        try {
            const response = await fetch('/api/maintenance/active');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const maintenances = await response.json();
            
            // Mettre à jour l'interface
            updateActiveMaintenanceTable(maintenances);
            
        } catch (error) {
            console.error('Erreur lors du chargement des maintenances actives:', error);
            showMessage('Erreur lors du chargement des maintenances actives', 'error');
        }
    }
    
    // Charger l'historique des maintenances
    async function loadMaintenanceHistory() {
        try {
            const skip = (currentPage - 1) * pageSize;
            
            let url = `/api/maintenance/history?skip=${skip}&limit=${pageSize}`;
            
            // Appliquer les filtres
            if (currentFilter.search) {
                url += `&search=${encodeURIComponent(currentFilter.search)}`;
            }
            
            if (currentFilter.status !== 'all') {
                url += `&status=${currentFilter.status}`;
            }
            
            if (currentFilter.date !== 'all') {
                url += `&date_filter=${currentFilter.date}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const maintenances = await response.json();
            
            // Récupérer le nombre total pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalMaintenances = totalHeader ? parseInt(totalHeader) : maintenances.length;
            
            // Mettre à jour l'interface
            updateMaintenanceHistoryTable(maintenances);
            updatePagination();
            
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique des maintenances:', error);
            showMessage('Erreur lors du chargement de l\'historique', 'error');
        }
    }
    
    // Mettre à jour le tableau des maintenances actives
    function updateActiveMaintenanceTable(maintenances) {
        activeMaintenanceBody.innerHTML = '';
        
        if (maintenances.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="7" class="text-center">Aucune maintenance en cours</td>';
            activeMaintenanceBody.appendChild(emptyRow);
            return;
        }
        
        maintenances.forEach(maintenance => {
            const row = document.createElement('tr');
            
            // Formatage des données
            const dateDebut = new Date(maintenance.date_debut).toLocaleString('fr-FR');
            
            // Calculer la durée de la maintenance en cours
            const duration = calculateDuration(maintenance.date_debut, null);
            const durationClass = getDurationClass(duration.days);
            
            row.innerHTML = `
                <td data-title="Code Radio">${maintenance.radio.code_barre}</td>
                <td data-title="Marque/Modèle">${maintenance.radio.marque} ${maintenance.radio.modele}</td>
                <td data-title="Problème signalé">${maintenance.description}</td>
                <td data-title="Opérateur">${maintenance.operateur}</td>
                <td data-title="Date de début">${dateDebut}</td>
                <td data-title="Durée"><span class="duration ${durationClass}">${duration.text}</span></td>
                <td data-title="Actions" class="actions-cell">
                    <button class="action-btn end-maintenance-btn" data-id="${maintenance.id}" data-radio-id="${maintenance.radio.id}" data-radio-code="${maintenance.radio.code_barre}" title="Terminer la maintenance">
                        Terminer
                    </button>
                    <button class="action-btn details-btn" data-id="${maintenance.id}" title="Voir les détails">
                        Détails
                    </button>
                </td>
            `;
            
            activeMaintenanceBody.appendChild(row);
        });
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('active-table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable('active-maintenance-table');
        }
        
        // Ajouter les écouteurs d'événements pour les boutons
        attachActionButtonListeners();
    }
    
    // Mettre à jour le tableau de l'historique des maintenances
    function updateMaintenanceHistoryTable(maintenances) {
        maintenanceHistoryBody.innerHTML = '';
        
        if (maintenances.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="8" class="text-center">Aucune maintenance trouvée</td>';
            maintenanceHistoryBody.appendChild(emptyRow);
            return;
        }
        
        maintenances.forEach(maintenance => {
            const row = document.createElement('tr');
            
            // Formatage des données
            const dateDebut = new Date(maintenance.date_debut).toLocaleString('fr-FR');
            const dateFin = maintenance.date_fin ? new Date(maintenance.date_fin).toLocaleString('fr-FR') : 'En cours';
            
            // Calculer la durée
            const duration = calculateDuration(maintenance.date_debut, maintenance.date_fin);
            const durationClass = getDurationClass(duration.days);
            
            // Définir le statut
            const status = maintenance.date_fin ? 'completed' : 'active';
            const statusText = maintenance.date_fin ? 'Terminée' : 'En cours';
            
            row.innerHTML = `
                <td data-title="Code Radio">${maintenance.radio.code_barre}</td>
                <td data-title="Marque/Modèle">${maintenance.radio.marque} ${maintenance.radio.modele}</td>
                <td data-title="Problème signalé">${maintenance.description}</td>
                <td data-title="Opérateur">${maintenance.operateur}</td>
                <td data-title="Date de début">${dateDebut}</td>
                <td data-title="Date de fin">${dateFin}</td>
                <td data-title="Durée"><span class="duration ${durationClass}">${duration.text}</span></td>
                <td data-title="Actions" class="actions-cell">
                    ${maintenance.date_fin ? '' : `
                        <button class="action-btn end-maintenance-btn" data-id="${maintenance.id}" data-radio-id="${maintenance.radio.id}" data-radio-code="${maintenance.radio.code_barre}" title="Terminer la maintenance">
                            Terminer
                        </button>
                    `}
                    <button class="action-btn details-btn" data-id="${maintenance.id}" title="Voir les détails">
                        Détails
                    </button>
                </td>
            `;
            
            maintenanceHistoryBody.appendChild(row);
        });
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('history-table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable('maintenance-history-table');
        }
        
        // Ajouter les écouteurs d'événements pour les boutons
        attachActionButtonListeners();
    }
    
    // Calculer la durée entre deux dates
    function calculateDuration(startDate, endDate) {
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : new Date();
        
        const diffTime = Math.abs(end - start);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        let text = '';
        if (diffDays > 0) {
            text = `${diffDays} jour${diffDays > 1 ? 's' : ''} ${diffHours} h`;
        } else {
            text = `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        }
        
        return {
            days: diffDays,
            hours: diffHours,
            text: text
        };
    }
    
    // Obtenir la classe CSS pour la durée
    function getDurationClass(days) {
        if (days < 2) {
            return 'duration-short';
        } else if (days < 7) {
            return 'duration-medium';
        } else {
            return 'duration-long';
        }
    }
    
    // Mettre à jour la pagination
    function updatePagination() {
        const totalPages = Math.ceil(totalMaintenances / pageSize);
        
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    // Attacher les écouteurs d'événements aux boutons d'action
    function attachActionButtonListeners() {
        // Boutons de fin de maintenance
        document.querySelectorAll('.end-maintenance-btn').forEach(button => {
            button.addEventListener('click', function() {
                const maintenanceId = this.getAttribute('data-id');
                const radioId = this.getAttribute('data-radio-id');
                const radioCode = this.getAttribute('data-radio-code');
                showEndMaintenanceModal(maintenanceId, radioId, radioCode);
            });
        });
        
        // Boutons de détails
        document.querySelectorAll('.details-btn').forEach(button => {
            button.addEventListener('click', function() {
                const maintenanceId = this.getAttribute('data-id');
                showMaintenanceDetails(maintenanceId);
            });
        });
    }
    
    // Afficher la modal de fin de maintenance
    function showEndMaintenanceModal(maintenanceId, radioId, radioCode) {
        document.getElementById('maintenance-id').value = maintenanceId;
        document.getElementById('radio-id').value = radioId;
        document.getElementById('radio-code-display').textContent = radioCode;
        
        currentMaintenanceId = maintenanceId;
        currentRadioId = radioId;
        
        endMaintenanceModal.style.display = 'flex';
    }
    
    // Afficher les détails d'une maintenance
    async function showMaintenanceDetails(maintenanceId) {
        try {
            const response = await fetch(`/api/maintenance/${maintenanceId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const maintenance = await response.json();
            
            // Formatage des dates
            const dateDebut = new Date(maintenance.date_debut).toLocaleString('fr-FR');
            const dateFin = maintenance.date_fin ? new Date(maintenance.date_fin).toLocaleString('fr-FR') : 'En cours';
            
            // Calculer la durée
            const duration = calculateDuration(maintenance.date_debut, maintenance.date_fin);
            
            // Récupérer l'historique des maintenances précédentes pour cette radio
            const historyResponse = await fetch(`/api/radios/${maintenance.id_radio}/maintenance`);
            let previousMaintenances = [];
            
            if (historyResponse.ok) {
                const allMaintenances = await historyResponse.json();
                // Filtrer pour exclure la maintenance actuelle et trier par date de début (la plus récente d'abord)
                previousMaintenances = allMaintenances
                    .filter(m => m.id !== parseInt(maintenanceId))
                    .sort((a, b) => new Date(b.date_debut) - new Date(a.date_debut))
                    .slice(0, 5); // Limiter aux 5 plus récentes
            }
            
            // Construire le contenu HTML
            let detailsHtml = `
                <div class="maintenance-details">
                    <h3>Informations sur la radio</h3>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Code barre:</div>
                        <div class="maintenance-details-value">${maintenance.radio.code_barre}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Marque/Modèle:</div>
                        <div class="maintenance-details-value">${maintenance.radio.marque} ${maintenance.radio.modele}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Numéro de série:</div>
                        <div class="maintenance-details-value">${maintenance.radio.numero_serie || 'Non spécifié'}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Géolocalisable:</div>
                        <div class="maintenance-details-value">${maintenance.radio.est_geolocalisable ? 'Oui' : 'Non'}</div>
                    </div>
                </div>
                
                <div class="maintenance-details">
                    <h3>Détails de la maintenance</h3>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Problème signalé:</div>
                        <div class="maintenance-details-value">${maintenance.description}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Opérateur:</div>
                        <div class="maintenance-details-value">${maintenance.operateur}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Date de début:</div>
                        <div class="maintenance-details-value">${dateDebut}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Date de fin:</div>
                        <div class="maintenance-details-value">${dateFin}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Durée:</div>
                        <div class="maintenance-details-value">${duration.text}</div>
                    </div>
                    <div class="maintenance-details-row">
                        <div class="maintenance-details-label">Statut:</div>
                        <div class="maintenance-details-value">
                            <span class="status-badge ${maintenance.date_fin ? 'status-completed' : 'status-active'}">
                                ${maintenance.date_fin ? 'Terminée' : 'En cours'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            // Ajouter l'historique des maintenances précédentes si disponible
            if (previousMaintenances.length > 0) {
                detailsHtml += `
                    <div class="maintenance-details">
                        <h3>Historique des maintenances récentes</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date de début</th>
                                    <th>Date de fin</th>
                                    <th>Problème</th>
                                    <th>Durée</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                previousMaintenances.forEach(m => {
                    const mDateDebut = new Date(m.date_debut).toLocaleDateString('fr-FR');
                    const mDateFin = m.date_fin ? new Date(m.date_fin).toLocaleDateString('fr-FR') : 'En cours';
                    const mDuration = calculateDuration(m.date_debut, m.date_fin);
                    
                    detailsHtml += `
                        <tr>
                            <td>${mDateDebut}</td>
                            <td>${mDateFin}</td>
                            <td>${m.description}</td>
                            <td>${mDuration.text}</td>
                        </tr>
                    `;
                });
                
                detailsHtml += `
                            </tbody>
                        </table>
                    </div>
                `;
            }
            
            // Mettre à jour la modal
            document.getElementById('maintenance-details-content').innerHTML = detailsHtml;
            
            // Afficher la modal
            maintenanceDetailsModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur lors du chargement des détails de maintenance:', error);
            showMessage('Erreur lors du chargement des détails', 'error');
        }
    }
    
    // Gérer la soumission du formulaire de fin de maintenance
    async function handleEndMaintenanceSubmit(event) {
        event.preventDefault();
        
        if (!currentMaintenanceId || !currentRadioId) {
            showMessage('Données manquantes pour terminer la maintenance', 'error');
            return;
        }
        
        try {
            const comments = document.getElementById('end-comments').value;
            
            const response = await fetch(`/api/radios/${currentRadioId}/maintenance/${currentMaintenanceId}/end`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    commentaire: comments
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de la fin de maintenance');
            }
            
            // Fermer la modal
            closeAllModals();
            
            // Recharger les données
            refreshData();
            
            // Afficher un message de succès
            showMessage('Maintenance terminée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // Fermer toutes les modales
    function closeAllModals() {
        endMaintenanceModal.style.display = 'none';
        maintenanceDetailsModal.style.display = 'none';
        
        // Réinitialiser les formulaires
        endMaintenanceForm.reset();
        
        // Réinitialiser les variables
        currentMaintenanceId = null;
        currentRadioId = null;
    }
    
    // Rafraîchir toutes les données
    function refreshData() {
        loadStatistics();
        loadActiveMaintenances();
        loadMaintenanceHistory();
    }
    
    // Exporter l'historique des maintenances en CSV
    async function exportMaintenanceHistory() {
        try {
            // Construire l'URL avec les filtres actuels
            let url = '/api/maintenance/export';
            
            if (currentFilter.search) {
                url += `?search=${encodeURIComponent(currentFilter.search)}`;
            }
            
            if (currentFilter.status !== 'all') {
                url += (url.includes('?') ? '&' : '?') + `status=${currentFilter.status}`;
            }
            
            if (currentFilter.date !== 'all') {
                url += (url.includes('?') ? '&' : '?') + `date_filter=${currentFilter.date}`;
            }
            
            // Rediriger vers l'URL pour déclencher le téléchargement
            window.location.href = url;
            
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            showMessage('Erreur lors de l\'export des données', 'error');
        }
    }
    
    // Basculer entre la vue tableau et la vue carte
    function toggleTableView(containerId, button) {
        const container = document.getElementById(containerId);
        
        if (container.classList.contains('card-view-enabled')) {
            // Revenir à la vue tableau
            container.classList.remove('card-view-enabled');
            button.textContent = 'Vue carte';
        } else {
            // Passer à la vue carte
            container.classList.add('card-view-enabled');
            button.textContent = 'Vue tableau';
            
            // Ajouter les attributs data-title aux cellules
            if (containerId === 'active-table-container') {
                addDataTitlesToTable('active-maintenance-table');
            } else if (containerId === 'history-table-container') {
                addDataTitlesToTable('maintenance-history-table');
            }
        }
    }
    
    // Ajouter les attributs data-title aux cellules pour la vue carte
    function addDataTitlesToTable(tableId) {
        const table = document.getElementById(tableId);
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index < headers.length) {
                    const headerText = headers[index].textContent.trim();
                    cell.setAttribute('data-title', headerText);
                }
            });
        });
    }
    
    // Afficher un message à l'utilisateur
    function showMessage(message, type = 'info') {
        // Si vous avez un système de notification, utilisez-le ici
        alert(message);
    }
});