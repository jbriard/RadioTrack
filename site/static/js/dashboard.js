document.addEventListener('DOMContentLoaded', function() {
    // Éléments du tableau de bord
    const refreshDataBtn = document.getElementById('refresh-data');
    const returnAllBtn = document.getElementById('return-all-btn');
    const refreshMaintenanceBtn = document.getElementById('refresh-maintenance');
    const dataBody = document.getElementById('data-body');
    const maintenanceBody = document.getElementById('maintenance-body');
    
    // Éléments pour l'état du parc
    const totalRadiosElement = document.getElementById('total-radios');
    const loanedRadiosElement = document.getElementById('loaned-radios');
    const maintenanceRadiosElement = document.getElementById('maintenance-radios');
    const availableRadiosElement = document.getElementById('available-radios');
    
    // Initialiser le chargement des données
    loadParkState();
    loadActiveLoans();
    loadRadiosInMaintenance();
    
    // Écouteurs d'événements spécifiques au tableau de bord
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', function() {
            loadActiveLoans();
            loadParkState();
        });
    }
    
    if (returnAllBtn) {
        returnAllBtn.addEventListener('click', function() {
            if (confirm('Voulez-vous vraiment enregistrer le retour de toutes les radios en prêt ?')) {
                returnAllRadios();
            }
        });
    }
    
    if (refreshMaintenanceBtn) {
        refreshMaintenanceBtn.addEventListener('click', function() {
            loadRadiosInMaintenance();
            loadParkState();
        });
    }
    
    // Délégation d'événements pour les boutons de retour et de fin de maintenance
    document.addEventListener('click', function(e) {
        // Gestion des boutons de retour
        if (e.target && e.target.classList.contains('action-btn') && e.target.textContent.trim() === 'Retour') {
            const row = e.target.closest('tr');
            if (row) {
                const radioCode = row.cells[0].textContent;
                const pretId = e.target.getAttribute('data-id') || '';
                
                if (confirm(`Voulez-vous vraiment enregistrer le retour de la radio ${radioCode} ?`)) {
                    returnRadio(pretId, radioCode);
                }
            }
        }
        
        // Gestion des boutons de fin de maintenance
        if (e.target && e.target.classList.contains('action-btn') && e.target.textContent.trim() === 'Fin maintenance') {
            const row = e.target.closest('tr');
            if (row) {
                const radioCode = row.cells[0].textContent;
                const maintenanceId = e.target.getAttribute('data-id') || '';
                const radioId = e.target.getAttribute('data-radio-id') || '';
                
                if (confirm(`Voulez-vous vraiment terminer la maintenance de la radio ${radioCode} ?`)) {
                    endMaintenance(radioId, maintenanceId, radioCode);
                }
            }
        }
    });
    
    /**
     * Fonctions pour l'état du parc
     */
    async function loadParkState() {
        try {
            // Afficher un indicateur de chargement
            if (totalRadiosElement) totalRadiosElement.textContent = "Chargement...";
            if (loanedRadiosElement) loanedRadiosElement.textContent = "Chargement...";
            if (maintenanceRadiosElement) maintenanceRadiosElement.textContent = "Chargement...";
            if (availableRadiosElement) availableRadiosElement.textContent = "Chargement...";
            
            // Récupérer le nombre total de radios
            const totalResponse = await fetch('/api/radios?limit=1');
            const totalHeader = totalResponse.headers.get('X-Total-Count');
            const totalRadios = totalHeader ? parseInt(totalHeader) : 0;
            
            // Récupérer le nombre de radios en prêt
            const loanedResponse = await fetch('/api/radios?en_pret=true&limit=1');
            const loanedHeader = loanedResponse.headers.get('X-Total-Count');
            const loanedRadios = loanedHeader ? parseInt(loanedHeader) : 0;
            
            // Récupérer le nombre de radios en maintenance
            const maintenanceResponse = await fetch('/api/radios?maintenance=true&limit=1');
            const maintenanceHeader = maintenanceResponse.headers.get('X-Total-Count');
            const maintenanceRadios = maintenanceHeader ? parseInt(maintenanceHeader) : 0;
            
            // Calculer le nombre de radios disponibles
            const availableRadios = totalRadios - loanedRadios - maintenanceRadios;
            
            // Mettre à jour l'interface
            if (totalRadiosElement) totalRadiosElement.textContent = totalRadios;
            if (loanedRadiosElement) loanedRadiosElement.textContent = loanedRadios;
            if (maintenanceRadiosElement) maintenanceRadiosElement.textContent = maintenanceRadios;
            if (availableRadiosElement) availableRadiosElement.textContent = availableRadios;
            
        } catch (error) {
            console.error('Erreur lors du chargement de l\'état du parc:', error);
            
            // Afficher un message d'erreur
            if (totalRadiosElement) totalRadiosElement.textContent = "Erreur";
            if (loanedRadiosElement) loanedRadiosElement.textContent = "Erreur";
            if (maintenanceRadiosElement) maintenanceRadiosElement.textContent = "Erreur";
            if (availableRadiosElement) availableRadiosElement.textContent = "Erreur";
        }
    }
    
    /**
     * Fonctions pour gérer les prêts actifs
     */
    
    // Charger les prêts actifs
    async function loadActiveLoans() {
        try {
            if (!dataBody) return;
            
            dataBody.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des données...</td></tr>';
            
            const response = await fetch('/api/prets?actif=true&limit=10');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const prets = await response.json();
            
            updateActiveLoansTable(prets);
            
        } catch (error) {
            console.error('Erreur lors du chargement des prêts actifs:', error);
            if (dataBody) {
                dataBody.innerHTML = `<tr><td colspan="6" class="text-center">Erreur lors du chargement des prêts: ${error.message}</td></tr>`;
            }
        }
    }
    
    // Mettre à jour le tableau des prêts actifs
    function updateActiveLoansTable(prets) {
        if (!dataBody) return;
        
        dataBody.innerHTML = '';
        
        if (prets.length === 0) {
            dataBody.innerHTML = '<tr><td colspan="6" class="text-center">Aucune radio actuellement en prêt</td></tr>';
            return;
        }
        
        prets.forEach(pret => {
            const row = document.createElement('tr');
            
            // Formatage de la date
            const dateEmprunt = new Date(pret.date_emprunt).toLocaleString('fr-FR');
            
            // Informations sur la radio et la personne
            const radioCode = pret.radio ? pret.radio.code_barre : 'Radio inconnue';
            const radioModel = pret.radio ? `${pret.radio.marque} ${pret.radio.modele}` : '-';
            const personName = pret.personne ? `${pret.personne.prenom} ${pret.personne.nom.charAt(0)}.` : 'Personne inconnue';
            const equipe = pret.personne && pret.personne.equipe ? pret.personne.equipe.nom : '-';
            
            row.innerHTML = `
                <td>${radioCode}</td>
                <td>${radioModel}</td>
                <td>${personName}</td>
                <td>${equipe}</td>
                <td>${dateEmprunt}</td>
                <td>
                    <button class="action-btn" data-id="${pret.id}" style="width: auto; padding: 3px 8px; font-size: 12px;">Retour</button>
                </td>
            `;
            
            dataBody.appendChild(row);
        });
    }
    
    // Retourner une radio
    async function returnRadio(pretId, radioCode) {
        // Si nous n'avons pas d'ID de prêt, nous devons le chercher par le code radio
        if (!pretId) {
            try {
                // Chercher la radio par son code
                const radioResponse = await fetch(`/api/radios?search=${encodeURIComponent(radioCode)}&limit=1`);
                const radios = await radioResponse.json();
                
                if (radios.length === 0) {
                    alert('Radio non trouvée');
                    return;
                }
                
                const radioId = radios[0].id;
                
                // Chercher le prêt actif pour cette radio
                const pretResponse = await fetch(`/api/prets?id_radio=${radioId}&actif=true`);
                const prets = await pretResponse.json();
                
                if (prets.length === 0) {
                    alert('Aucun prêt actif trouvé pour cette radio');
                    return;
                }
                
                pretId = prets[0].id;
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la recherche du prêt');
                return;
            }
        }
        
        try {
            const response = await fetch(`/api/prets/${pretId}/retour`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de l\'enregistrement du retour');
            }
            
            alert('Retour enregistré avec succès');
            loadActiveLoans(); // Rafraîchir la liste
            loadParkState();   // Mettre à jour l'état du parc
            
        } catch (error) {
            console.error('Erreur:', error);
            alert(`Erreur: ${error.message}`);
        }
    }
    
    // Retourner toutes les radios
    async function returnAllRadios() {
        try {
            // Récupérer tous les prêts actifs
            const response = await fetch('/api/prets?actif=true');
            const prets = await response.json();
            
            if (prets.length === 0) {
                alert('Aucune radio actuellement en prêt');
                return;
            }
            
            // Pour chaque prêt, enregistrer le retour
            let successCount = 0;
            
            for (const pret of prets) {
                try {
                    const returnResponse = await fetch(`/api/prets/${pret.id}/retour`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    
                    if (returnResponse.ok) {
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Erreur lors du retour du prêt ${pret.id}:`, error);
                }
            }
            
            alert(`${successCount} sur ${prets.length} radios retournées avec succès`);
            
            // Recharger la liste des prêts actifs et l'état du parc
            loadActiveLoans();
            loadParkState();
            
        } catch (error) {
            console.error('Erreur:', error);
            alert(`Erreur: ${error.message}`);
        }
    }
    
    /**
     * Fonctions pour gérer les radios en maintenance
     */
    
    // Charger les radios en maintenance
    async function loadRadiosInMaintenance() {
        try {
            if (!maintenanceBody) return;
            
            maintenanceBody.innerHTML = '<tr><td colspan="5" class="text-center">Chargement des données...</td></tr>';
            
            const response = await fetch('/api/radios?maintenance=true&limit=10');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const radios = await response.json();
            
            // Pour chaque radio, récupérer les informations de maintenance
            const radiosWithMaintenance = await Promise.all(radios.map(async (radio) => {
                try {
                    const maintenanceResponse = await fetch(`/api/radios/${radio.id}/maintenance`);
                    const maintenances = await maintenanceResponse.json();
                    
                    // Trouver la maintenance active (sans date de fin)
                    const activeMaintenance = maintenances.find(m => !m.date_fin);
                    
                    return {
                        ...radio,
                        activeMaintenance: activeMaintenance
                    };
                } catch (error) {
                    console.error(`Erreur pour la radio ${radio.id}:`, error);
                    return radio;
                }
            }));
            
            updateMaintenanceTable(radiosWithMaintenance);
            
        } catch (error) {
            console.error('Erreur lors du chargement des radios en maintenance:', error);
            if (maintenanceBody) {
                maintenanceBody.innerHTML = `<tr><td colspan="5" class="text-center">Erreur lors du chargement des maintenances: ${error.message}</td></tr>`;
            }
        }
    }
    
    // Mettre à jour le tableau des maintenances
    function updateMaintenanceTable(radios) {
        if (!maintenanceBody) return;
        
        maintenanceBody.innerHTML = '';
        
        if (radios.length === 0) {
            maintenanceBody.innerHTML = '<tr><td colspan="5" class="text-center">Aucune radio actuellement en maintenance</td></tr>';
            return;
        }
        
        let hasActiveMaintenance = false;
        
        radios.forEach(radio => {
            if (!radio.activeMaintenance) return;
            
            hasActiveMaintenance = true;
            const row = document.createElement('tr');
            
            // Formatage de la date
            const dateDebut = new Date(radio.activeMaintenance.date_debut).toLocaleDateString('fr-FR');
            
            row.innerHTML = `
                <td>${radio.code_barre}</td>
                <td>${radio.marque} ${radio.modele}</td>
                <td>${radio.activeMaintenance.description}</td>
                <td>${dateDebut}</td>
                <td>
                    <button class="action-btn" data-radio-id="${radio.id}" data-id="${radio.activeMaintenance.id}" 
                            style="width: auto; padding: 3px 8px; font-size: 12px;">Fin maintenance</button>
                </td>
            `;
            
            maintenanceBody.appendChild(row);
        });
        
        // Si aucune radio avec maintenance active n'a été trouvée
        if (!hasActiveMaintenance) {
            maintenanceBody.innerHTML = '<tr><td colspan="5" class="text-center">Aucune radio actuellement en maintenance</td></tr>';
        }
    }
    
    // Terminer une maintenance
    async function endMaintenance(radioId, maintenanceId, radioCode) {
        // Si nous n'avons pas d'ID de radio ou de maintenance, nous devons les chercher par le code radio
        if (!radioId || !maintenanceId) {
            try {
                // Chercher la radio par son code
                const radioResponse = await fetch(`/api/radios?search=${encodeURIComponent(radioCode)}&limit=1`);
                const radios = await radioResponse.json();
                
                if (radios.length === 0) {
                    alert('Radio non trouvée');
                    return;
                }
                
                radioId = radios[0].id;
                
                // Chercher les maintenances pour cette radio
                const maintenanceResponse = await fetch(`/api/radios/${radioId}/maintenance`);
                const maintenances = await maintenanceResponse.json();
                
                // Trouver la maintenance active
                const activeMaintenance = maintenances.find(m => !m.date_fin);
                
                if (!activeMaintenance) {
                    alert('Aucune maintenance active trouvée pour cette radio');
                    return;
                }
                
                maintenanceId = activeMaintenance.id;
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la recherche de la maintenance');
                return;
            }
        }
        
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
            
            alert('Maintenance terminée avec succès');
            loadRadiosInMaintenance(); // Rafraîchir la liste des maintenances
            loadParkState();           // Mettre à jour l'état du parc
            
        } catch (error) {
            console.error('Erreur:', error);
            alert(`Erreur: ${error.message}`);
        }
    }
});