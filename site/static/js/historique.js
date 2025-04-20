document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentPage = 1;
    let pageSize = 10;
    let totalPrets = 0;
    let currentFilters = {
        search: '',
        status: '',
        radio: '',
        personne: '',
        equipe: '',
        cfi: '',
        accessoires: '',
        dateDebut: '',
        dateFin: ''
    };
    
    // Données pour les graphiques
    let allPretsData = [];
    let radiosData = [];
    let equipesData = [];
    let cfiData = [];
    let personnesData = [];
    
    // Éléments DOM
    const historiqueTable = document.getElementById('historique-table');
    const historiqueBody = document.getElementById('historique-body');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const itemsPerPageSelect = document.getElementById('items-per-page');
    
    // Éléments des filtres
    const searchGlobal = document.getElementById('search-global');
    const filterStatus = document.getElementById('filter-status');
    const filterRadio = document.getElementById('filter-radio');
    const filterPersonne = document.getElementById('filter-personne');
    const filterEquipe = document.getElementById('filter-equipe');
    const filterCFI = document.getElementById('filter-cfi');
    const filterAccessoires = document.getElementById('filter-accessoires');
    const dateDebut = document.getElementById('date-debut');
    const dateFin = document.getElementById('date-fin');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const exportCSVBtn = document.getElementById('export-csv');
    
    // Éléments des onglets
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Éléments des statistiques
    const totalPretsElement = document.getElementById('total-prets');
    const pretsActifsElement = document.getElementById('prets-actifs');
    const dureeMoyenneElement = document.getElementById('duree-moyenne');
    const pretsLongTermeElement = document.getElementById('prets-long-terme');
    
    // Éléments des graphiques
    const graphPeriod = document.getElementById('graph-period');
    const activityChartElement = document.getElementById('activity-chart');
    const durationChartElement = document.getElementById('duration-chart');
    const topRadiosChartElement = document.getElementById('top-radios-chart');
    const topEmprunteursChartElement = document.getElementById('top-emprunteurs-chart');
    
    // Modales
    const pretDetailsModal = document.getElementById('pret-details-modal');
    const pretDetailsContent = document.getElementById('pret-details-content');
    const addCommentModal = document.getElementById('add-comment-modal');
    const commentForm = document.getElementById('comment-form');
    const commentPretId = document.getElementById('comment-pret-id');
    const confirmReturnModal = document.getElementById('confirm-return-modal');
    const returnPretId = document.getElementById('return-pret-id');
    const returnCommentaire = document.getElementById('return-commentaire');
    const confirmReturnBtn = document.getElementById('confirm-return-btn');
    
    // Vue commutable
    const toggleViewBtn = document.getElementById('toggle-view');
    
    // Initialisation
    init();
    
    /**
     * Fonctions d'initialisation
     */
    async function init() {
        // Charger les données de référence
        await Promise.all([
            loadRadiosList(),
            loadPersonnesList(),
            loadEquipesList(),
            loadCFIsList()
        ]);
        
        // Charger les prêts
        await loadPrets();
        
        // Mettre à jour les statistiques
        updateStatistics();
        
        // Ajouter les écouteurs d'événements
        addEventListeners();
    }
    
    /**
     * Charger la liste des radios pour le filtre
     */
    async function loadRadiosList() {
        try {
            const response = await fetch('/api/radios?limit=500');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            radiosData = await response.json();
            
            // Mettre à jour le sélecteur de filtre
            populateSelectFilter(filterRadio, radiosData, 'id', (radio) => `${radio.code_barre} - ${radio.marque} ${radio.modele}`);
            
        } catch (error) {
            console.error('Erreur lors du chargement des radios:', error);
            showMessage('Erreur lors du chargement des radios', 'error');
        }
    }
    
    /**
     * Charger la liste des personnes pour le filtre
     */
    async function loadPersonnesList() {
        try {
            const response = await fetch('/api/personnes?limit=500');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            personnesData = await response.json();
            
            // Mettre à jour le sélecteur de filtre
            populateSelectFilter(filterPersonne, personnesData, 'id', (personne) => `${personne.code_barre} - ${personne.nom} ${personne.prenom}`);
            
        } catch (error) {
            console.error('Erreur lors du chargement des personnes:', error);
            showMessage('Erreur lors du chargement des personnes', 'error');
        }
    }
    
    /**
     * Charger la liste des équipes pour le filtre
     */
    async function loadEquipesList() {
        try {
            const response = await fetch('/api/equipes?limit=100');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            equipesData = await response.json();
            
            // Mettre à jour le sélecteur de filtre
            populateSelectFilter(filterEquipe, equipesData, 'id', (equipe) => `${equipe.nom}`);
            
        } catch (error) {
            console.error('Erreur lors du chargement des équipes:', error);
            showMessage('Erreur lors du chargement des équipes', 'error');
        }
    }
    
    /**
     * Charger la liste des CFIs pour le filtre
     */
    async function loadCFIsList() {
        try {
            const response = await fetch('/api/cfis?limit=100');
            if (!response.ok) {
                if (response.status !== 404) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                return;
            }
            
            cfiData = await response.json();
            
            // Mettre à jour le sélecteur de filtre
            populateSelectFilter(filterCFI, cfiData, 'id', (cfi) => `${cfi.nom}`);
            
        } catch (error) {
            console.error('Erreur lors du chargement des CFIs:', error);
            // Non critique, on continue sans les CFIs
        }
    }
    
    /**
     * Peupler un sélecteur avec des options
     */
    function populateSelectFilter(selectElement, data, valueKey, labelFunction) {
        // Conserver l'option vide
        const emptyOption = selectElement.querySelector('option[value=""]');
        
        // Vider le sélecteur
        selectElement.innerHTML = '';
        
        // Remettre l'option vide
        if (emptyOption) {
            selectElement.appendChild(emptyOption);
        }
        
        // Ajouter les options
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = labelFunction(item);
            selectElement.appendChild(option);
        });
    }
    
    /**
     * Ajouter tous les écouteurs d'événements
     */
    function addEventListeners() {
        // Pagination
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadPrets();
            }
        });
        
        nextPageBtn.addEventListener('click', () => {
            if (currentPage * pageSize < totalPrets) {
                currentPage++;
                loadPrets();
            }
        });
        
        // Sélection du nombre d'éléments par page
        itemsPerPageSelect.addEventListener('change', () => {
            pageSize = parseInt(itemsPerPageSelect.value);
            currentPage = 1;
            loadPrets();
        });
        
        // Filtres
        applyFiltersBtn.addEventListener('click', applyFilters);
        resetFiltersBtn.addEventListener('click', resetFilters);
        
        // Export CSV
        exportCSVBtn.addEventListener('click', exportPretsCSV);
        
        // Gestion des onglets
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Enlever la classe active de tous les onglets et contenus
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Ajouter la classe active à l'onglet cliqué et au contenu correspondant
                tab.classList.add('active');
                const tabId = `tab-${tab.getAttribute('data-tab')}`;
                document.getElementById(tabId).classList.add('active');
                
                // Si on passe à l'onglet des graphiques, les initialiser
                if (tabId === 'tab-graphiques') {
                    initActivityChart();
                    initDurationChart();
                } else if (tabId === 'tab-top') {
                    initTopRadiosChart();
                    initTopEmpruntersChart();
                }
            });
        });
        
        // Période du graphique
        graphPeriod.addEventListener('change', () => {
            initActivityChart();
        });
        
        // Fermer les modales
        document.querySelectorAll('.close, #close-pret-details, #cancel-comment, #cancel-return').forEach(element => {
            element.addEventListener('click', () => {
                pretDetailsModal.style.display = 'none';
                addCommentModal.style.display = 'none';
                confirmReturnModal.style.display = 'none';
            });
        });
        
        // Soumettre le formulaire de commentaire
        commentForm.addEventListener('submit', handleCommentFormSubmit);
        
        // Confirmer le retour
        confirmReturnBtn.addEventListener('click', handleReturnConfirm);
        
        // Vue commutable
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', toggleTableView);
        }
    }
    
    /**
     * Charger les prêts avec les filtres actuels
     */
    async function loadPrets() {
        try {
            const skip = (currentPage - 1) * pageSize;
            
            // Construire l'URL avec les filtres
            let url = `/api/historique/prets?skip=${skip}&limit=${pageSize}`;
            
            // Ajouter les filtres à l'URL
            for (const [key, value] of Object.entries(currentFilters)) {
                if (value) {
                    url += `&${key}=${encodeURIComponent(value)}`;
                }
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const prets = await response.json();
            
            // Récupérer le nombre total pour la pagination
            const totalHeader = response.headers.get('X-Total-Count');
            totalPrets = totalHeader ? parseInt(totalHeader) : prets.length;
            
            // Stocker les données pour les graphiques
            if (skip === 0 && (!currentFilters.search && !currentFilters.status && !currentFilters.radio && 
                !currentFilters.personne && !currentFilters.equipe && !currentFilters.cfi && 
                !currentFilters.accessoires && !currentFilters.dateDebut && !currentFilters.dateFin)) {
                
                // Si on est à la première page sans filtres
                // Charger tous les prêts pour les statistiques et graphiques
                const allResponse = await fetch('/api/historique/prets?limit=1000');
                if (allResponse.ok) {
                    allPretsData = await allResponse.json();
                }
            }
            
            // Mettre à jour l'interface
            updatePretsTable(prets);
            updatePagination();
            updateStatistics();
            
        } catch (error) {
            console.error('Erreur lors du chargement des prêts:', error);
            showMessage('Erreur lors du chargement des prêts', 'error');
        }
    }
    
    /**
     * Mettre à jour le tableau des prêts
     */
    function updatePretsTable(prets) {
        historiqueBody.innerHTML = '';
        
        if (prets.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="10" class="text-center">Aucun prêt trouvé</td>';
            historiqueBody.appendChild(emptyRow);
            return;
        }
        
        prets.forEach(pret => {
            const row = document.createElement('tr');
            
            // Formatage des dates
            const dateEmprunt = new Date(pret.date_emprunt).toLocaleString('fr-FR');
            const dateRetour = pret.date_retour ? new Date(pret.date_retour).toLocaleString('fr-FR') : '-';
            
            // Calculer la durée
            let duree = '-';
            let dureeClass = '';
            if (pret.date_retour) {
                const emprunt = new Date(pret.date_emprunt);
                const retour = new Date(pret.date_retour);
                const diffTime = Math.abs(retour - emprunt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                if (diffDays > 0) {
                    duree = `${diffDays}j ${diffHours}h`;
                } else {
                    duree = `${diffHours}h`;
                }
            } else {
                // Pour les prêts actifs, calculer la durée jusqu'à maintenant
                const emprunt = new Date(pret.date_emprunt);
                const now = new Date();
                const diffTime = Math.abs(now - emprunt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                if (diffDays > 0) {
                    duree = `${diffDays}j ${diffHours}h`;
                } else {
                    duree = `${diffHours}h`;
                }
                
                // Marquer les prêts de longue durée (plus de 7 jours)
                if (diffDays > 7) {
                    dureeClass = 'text-danger';
                }
            }
            
            // Déterminer le statut
            let statut = 'Retourné';
            let statutClass = 'status-returned';
            if (!pret.date_retour) {
                const now = new Date();
                const emprunt = new Date(pret.date_emprunt);
                const diffTime = Math.abs(now - emprunt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 7) {
                    statut = 'En retard';
                    statutClass = 'status-overdue';
                } else {
                    statut = 'Actif';
                    statutClass = 'status-active';
                }
            }
            
            // Informations sur la radio et la personne
            const radioInfo = pret.radio ? 
                `${pret.radio.code_barre}` : 
                'Radio inconnue';
            
            const radioModele = pret.radio ? 
                `${pret.radio.marque} ${pret.radio.modele}` : 
                '-';
            
            const personneInfo = pret.personne ? 
                `${pret.personne.code_barre}` : 
                'Personne inconnue';
            
            const personneName = pret.personne ? 
                `${pret.personne.nom} ${pret.personne.prenom}` : 
                '-';
            
            // Équipe/CFI de la personne
            let equipeOuCFI = '-';
            if (pret.personne) {
                if (pret.personne.equipe) {
                    equipeOuCFI = pret.personne.equipe.nom;
                } else if (pret.personne.cfi) {
                    equipeOuCFI = `CFI: ${pret.personne.cfi.nom}`;
                }
            }
            
            // Formater les accessoires
            const accessoires = formatAccessoires(pret.accessoires);
            
            row.innerHTML = `
                <td>${radioInfo}</td>
                <td>${radioModele}</td>
                <td>${personneName}<br><small>${personneInfo}</small></td>
                <td>${equipeOuCFI}</td>
                <td>${dateEmprunt}</td>
                <td>${dateRetour}</td>
                <td class="duration-cell ${dureeClass}">${duree}</td>
                <td>${accessoires}</td>
                <td><span class="status-badge ${statutClass}">${statut}</span></td>
                <td class="actions-cell">
                    <button class="action-btn details-btn" data-id="${pret.id}" title="Détails">
                        👁️
                    </button>
                    ${!pret.date_retour ? 
                        `<button class="action-btn return-btn" data-id="${pret.id}" title="Retourner">
                            🔄
                        </button>` : 
                        ''
                    }
                    <button class="action-btn comment-btn" data-id="${pret.id}" title="Ajouter un commentaire">
                        💬
                    </button>
                </td>
            `;
            
            historiqueBody.appendChild(row);
        });
        
        // Ajouter les écouteurs pour les boutons d'action
        attachActionButtonListeners();
        
        // Ajouter les attributs data-title si on est en vue carte
        if (document.getElementById('table-container') && 
            document.getElementById('table-container').classList.contains('card-view-enabled')) {
            addDataTitlesToTable();
        }
    }
    
    /**
     * Formater les accessoires pour l'affichage
     */
    function formatAccessoires(accessoires) {
        switch (accessoires) {
            case 'oreillettes':
                return 'Oreillettes';
            case 'micro':
                return 'Micro';
            case 'les deux':
                return 'Oreillettes + Micro';
            case 'aucun':
            default:
                return 'Aucun';
        }
    }
    
    /**
     * Attacher les écouteurs aux boutons d'action
     */
    function attachActionButtonListeners() {
        // Boutons de détails
        document.querySelectorAll('.details-btn').forEach(button => {
            button.addEventListener('click', function() {
                const pretId = this.getAttribute('data-id');
                showPretDetails(pretId);
            });
        });
        
        // Boutons de retour
        document.querySelectorAll('.return-btn').forEach(button => {
            button.addEventListener('click', function() {
                const pretId = this.getAttribute('data-id');
                showReturnConfirmation(pretId);
            });
        });
        
        // Boutons de commentaire
        document.querySelectorAll('.comment-btn').forEach(button => {
            button.addEventListener('click', function() {
                const pretId = this.getAttribute('data-id');
                showAddCommentModal(pretId);
            });
        });
    }
    
    /**
     * Mettre à jour la pagination
     */
    function updatePagination() {
        const totalPages = Math.ceil(totalPrets / pageSize);
        
        pageInfo.textContent = `Page ${currentPage} sur ${totalPages || 1}`;
        
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    }
    
    /**
     * Mettre à jour les statistiques
     */
    function updateStatistics() {
        // Si les données complètes sont disponibles
        if (allPretsData.length > 0) {
            // Nombre total de prêts
            totalPretsElement.textContent = allPretsData.length;
            
            // Nombre de prêts actifs
            const pretsActifs = allPretsData.filter(pret => !pret.date_retour).length;
            pretsActifsElement.textContent = pretsActifs;
            
            // Durée moyenne des prêts terminés
            const pretsTermines = allPretsData.filter(pret => pret.date_retour);
            if (pretsTermines.length > 0) {
                let totalDuree = 0;
                pretsTermines.forEach(pret => {
                    const emprunt = new Date(pret.date_emprunt);
                    const retour = new Date(pret.date_retour);
                    const diffTime = Math.abs(retour - emprunt);
                    const diffHours = diffTime / (1000 * 60 * 60);
                    totalDuree += diffHours;
                });
                const dureeMoyenneHeures = totalDuree / pretsTermines.length;
                
                if (dureeMoyenneHeures < 24) {
                    dureeMoyenneElement.textContent = `${Math.round(dureeMoyenneHeures)}h`;
                } else {
                    const jours = Math.floor(dureeMoyenneHeures / 24);
                    const heures = Math.round(dureeMoyenneHeures % 24);
                    dureeMoyenneElement.textContent = `${jours}j ${heures}h`;
                }
            } else {
                dureeMoyenneElement.textContent = 'N/A';
            }
            
            // Prêts de longue durée (plus de 7 jours)
            const now = new Date();
            const pretsLongueDuree = allPretsData.filter(pret => {
                if (!pret.date_retour) {
                    const emprunt = new Date(pret.date_emprunt);
                    const diffTime = Math.abs(now - emprunt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays > 7;
                }
                return false;
            });
            pretsLongTermeElement.textContent = pretsLongueDuree.length;
        } else {
            // Si les données complètes ne sont pas disponibles, utiliser les filtres actuels
            // (moins précis mais mieux que rien)
            totalPretsElement.textContent = totalPrets;
            pretsActifsElement.textContent = '...';
            dureeMoyenneElement.textContent = '...';
            pretsLongTermeElement.textContent = '...';
        }
    }
    
    /**
     * Appliquer les filtres
     */
    function applyFilters() {
        currentFilters = {
            search: searchGlobal.value,
            status: filterStatus.value,
            radio: filterRadio.value,
            personne: filterPersonne.value,
            equipe: filterEquipe.value,
            cfi: filterCFI.value,
            accessoires: filterAccessoires.value,
            dateDebut: dateDebut.value,
            dateFin: dateFin.value
        };
        
        currentPage = 1;
        loadPrets();
    }
    
    /**
     * Réinitialiser les filtres
     */
    function resetFilters() {
        searchGlobal.value = '';
        filterStatus.value = '';
        filterRadio.value = '';
        filterPersonne.value = '';
        filterEquipe.value = '';
        filterCFI.value = '';
        filterAccessoires.value = '';
        dateDebut.value = '';
        dateFin.value = '';
        
        currentFilters = {
            search: '',
            status: '',
            radio: '',
            personne: '',
            equipe: '',
            cfi: '',
            accessoires: '',
            dateDebut: '',
            dateFin: ''
        };
        
        currentPage = 1;
        loadPrets();
    }
    
    /**
     * Exporter les prêts en CSV
     */
    async function exportPretsCSV() {
        try {
            // Récupérer tous les prêts avec les filtres actuels
            let url = `/api/historique/prets/export?limit=10000`;
            
            // Ajouter les filtres à l'URL
            for (const [key, value] of Object.entries(currentFilters)) {
                if (value) {
                    url += `&${key}=${encodeURIComponent(value)}`;
                }
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            // Récupérer le CSV comme blob
            const blob = await response.blob();
            
            // Créer un lien de téléchargement
            const a = document.createElement('a');
            const objectURL = URL.createObjectURL(blob);
            
            a.href = objectURL;
            a.download = 'historique_prets.csv';
            document.body.appendChild(a);
            a.click();
            
            // Nettoyer
            document.body.removeChild(a);
            URL.revokeObjectURL(objectURL);
            
            showMessage('Export CSV réussi', 'success');
            
        } catch (error) {
            console.error('Erreur lors de l\'export CSV:', error);
            showMessage('Erreur lors de l\'export CSV', 'error');
        }
    }
    
    /**
     * Afficher les détails d'un prêt
     */
    async function showPretDetails(pretId) {
        try {
            const response = await fetch(`/api/prets/${pretId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const pret = await response.json();
            
            // Formatage des dates
            const dateEmprunt = new Date(pret.date_emprunt).toLocaleString('fr-FR');
            const dateRetour = pret.date_retour ? new Date(pret.date_retour).toLocaleString('fr-FR') : 'Non retourné';
            
            // Calculer la durée
            let duree = 'En cours';
            if (pret.date_retour) {
                const emprunt = new Date(pret.date_emprunt);
                const retour = new Date(pret.date_retour);
                const diffTime = Math.abs(retour - emprunt);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                if (diffDays > 0) {
                    duree = `${diffDays} jours et ${diffHours} heures`;
                } else {
                    duree = `${diffHours} heures`;
                }
            }
            
            // Informations sur la radio
            let radioInfo = '<p>Informations radio non disponibles</p>';
            if (pret.radio) {
                radioInfo = `
                    <div class="detail-section">
                        <h3>Informations sur la radio</h3>
                        <p><strong>Code:</strong> ${pret.radio.code_barre}</p>
                        <p><strong>Marque/Modèle:</strong> ${pret.radio.marque} ${pret.radio.modele}</p>
                        <p><strong>Numéro de série:</strong> ${pret.radio.numero_serie || 'Non renseigné'}</p>
                        <p><strong>Géolocalisable:</strong> ${pret.radio.est_geolocalisable ? 'Oui' : 'Non'}</p>
                    </div>
                `;
            }
            
            // Informations sur l'emprunteur
            let personneInfo = '<p>Informations emprunteur non disponibles</p>';
            if (pret.personne) {
                let equipeInfo = 'Aucune équipe';
                if (pret.personne.equipe) {
                    equipeInfo = pret.personne.equipe.nom;
                }
                
                let cfiInfo = 'Aucun CFI';
                if (pret.personne.cfi) {
                    cfiInfo = pret.personne.cfi.nom;
                }
                
                personneInfo = `
                    <div class="detail-section">
                        <h3>Informations sur l'emprunteur</h3>
                        <p><strong>Code:</strong> ${pret.personne.code_barre}</p>
                        <p><strong>Nom:</strong> ${pret.personne.nom} ${pret.personne.prenom}</p>
                        <p><strong>Équipe:</strong> ${equipeInfo}</p>
                        <p><strong>CFI:</strong> ${cfiInfo}</p>
                    </div>
                `;
            }
            
            // Remplir le contenu de la modale
            pretDetailsContent.innerHTML = `
                <div class="detail-section">
                    <h3>Informations sur le prêt</h3>
                    <p><strong>ID:</strong> ${pret.id}</p>
                    <p><strong>Date d'emprunt:</strong> ${dateEmprunt}</p>
                    <p><strong>Date de retour:</strong> ${dateRetour}</p>
                    <p><strong>Durée:</strong> ${duree}</p>
                    <p><strong>Accessoires:</strong> ${formatAccessoires(pret.accessoires)}</p>
                    <p><strong>Commentaire:</strong> ${pret.commentaire || 'Aucun commentaire'}</p>
                </div>
                ${radioInfo}
                ${personneInfo}
            `;
            
            // Afficher la modale
            pretDetailsModal.style.display = 'flex';
            
        } catch (error) {
            console.error('Erreur lors de la récupération des détails du prêt:', error);
            showMessage('Erreur lors de la récupération des détails du prêt', 'error');
        }
    }
    
    /**
     * Afficher la modale d'ajout de commentaire
     */
    function showAddCommentModal(pretId) {
        commentPretId.value = pretId;
        addCommentModal.style.display = 'flex';
    }
    
    /**
     * Afficher la modale de confirmation de retour
     */
    function showReturnConfirmation(pretId) {
        returnPretId.value = pretId;
        returnCommentaire.value = '';
        confirmReturnModal.style.display = 'flex';
    }
    
    /**
     * Gérer la soumission du formulaire de commentaire
     */
    async function handleCommentFormSubmit(event) {
        event.preventDefault();
        
        const pretId = commentPretId.value;
        const commentaire = document.getElementById('commentaire').value;
        
        try {
            const response = await fetch(`/api/prets/${pretId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    commentaire: commentaire
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            // Fermer la modale
            addCommentModal.style.display = 'none';
            
            // Recharger les prêts
            loadPrets();
            
            showMessage('Commentaire ajouté avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur lors de l\'ajout du commentaire:', error);
            showMessage('Erreur lors de l\'ajout du commentaire', 'error');
        }
    }
    
    /**
     * Gérer la confirmation de retour
     */
    async function handleReturnConfirm() {
        const pretId = returnPretId.value;
        const commentaire = returnCommentaire.value;
        
        try {
            const response = await fetch(`/api/prets/${pretId}/retour`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    commentaire: commentaire
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            // Fermer la modale
            confirmReturnModal.style.display = 'none';
            
            // Recharger les prêts
            loadPrets();
            
            showMessage('Radio retournée avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur lors du retour de la radio:', error);
            showMessage('Erreur lors du retour de la radio', 'error');
        }
    }
    
    /**
     * Basculer entre la vue tableau et la vue carte
     */
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
    
    /**
     * Ajouter les attributs data-title aux cellules pour la vue carte
     */
    function addDataTitlesToTable() {
        const table = document.getElementById('historique-table');
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
     * Initialiser le graphique d'activité
     */
    function initActivityChart() {
        if (!allPretsData.length || !activityChartElement) return;
        
        const period = graphPeriod.value;
        
        // Préparer les données pour le graphique
        const empruntsParPeriode = {};
        const retoursParPeriode = {};
        
        // Fonction pour formater la date selon la période
        const formatDate = (date) => {
            const d = new Date(date);
            if (period === 'day') {
                return d.toLocaleDateString('fr-FR');
            } else if (period === 'week') {
                const firstDay = new Date(d.getFullYear(), 0, 1);
                const weekNumber = Math.ceil(((d - firstDay) / 86400000 + firstDay.getDay() + 1) / 7);
                return `Semaine ${weekNumber}, ${d.getFullYear()}`;
            } else { // month
                return `${d.getMonth() + 1}/${d.getFullYear()}`;
            }
        };
        
        // Regrouper les prêts par période
        allPretsData.forEach(pret => {
            const dateEmprunt = formatDate(pret.date_emprunt);
            empruntsParPeriode[dateEmprunt] = (empruntsParPeriode[dateEmprunt] || 0) + 1;
            
            if (pret.date_retour) {
                const dateRetour = formatDate(pret.date_retour);
                retoursParPeriode[dateRetour] = (retoursParPeriode[dateRetour] || 0) + 1;
            }
        });
        
        // Créer un ensemble de toutes les périodes
        const allPeriods = new Set([...Object.keys(empruntsParPeriode), ...Object.keys(retoursParPeriode)]);
        
        // Trier les périodes
        const sortedPeriods = Array.from(allPeriods).sort((a, b) => {
            if (period === 'day') {
                return new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'));
            } else if (period === 'week') {
                const [weekA, yearA] = a.replace('Semaine ', '').split(', ');
                const [weekB, yearB] = b.replace('Semaine ', '').split(', ');
                return (yearA - yearB) || (weekA - weekB);
            } else { // month
                const [monthA, yearA] = a.split('/');
                const [monthB, yearB] = b.split('/');
                return (yearA - yearB) || (monthA - monthB);
            }
        });
        
        // Préparer les données pour le graphique
        const chartData = sortedPeriods.map(period => ({
            period,
            emprunts: empruntsParPeriode[period] || 0,
            retours: retoursParPeriode[period] || 0
        }));
        
        // Utiliser recharts pour le graphique
        const activityChart = document.createElement('div');
        activityChart.id = 'activity-chart-content';
        activityChart.style.width = '100%';
        activityChart.style.height = '400px';
        
        // Simuler un graphique basique avec une table
        let htmlContent = `
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Période</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Emprunts</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Retours</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        chartData.forEach(data => {
            htmlContent += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${data.period}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${data.emprunts}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${data.retours}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                </tbody>
            </table>
            </div>
            <p style="text-align: center; margin-top: 10px; color: #666;">
            </p>
        `;
        
        activityChart.innerHTML = htmlContent;
        
        // Remplacer le contenu actuel
        activityChartElement.innerHTML = '';
        activityChartElement.appendChild(activityChart);
    }
    
    /**
     * Initialiser le graphique de durée moyenne par équipe
     */
    function initDurationChart() {
        if (!allPretsData.length || !durationChartElement) return;
        
        // Préparer les données
        const dureesParEquipe = {};
        const nombrePretsParEquipe = {};
        
        // Ne considérer que les prêts terminés
        const pretsTermines = allPretsData.filter(pret => pret.date_retour);
        
        pretsTermines.forEach(pret => {
            if (pret.personne && pret.personne.equipe) {
                const equipeNom = pret.personne.equipe.nom;
                
                const emprunt = new Date(pret.date_emprunt);
                const retour = new Date(pret.date_retour);
                const diffTime = Math.abs(retour - emprunt);
                const diffHours = diffTime / (1000 * 60 * 60);
                
                dureesParEquipe[equipeNom] = (dureesParEquipe[equipeNom] || 0) + diffHours;
                nombrePretsParEquipe[equipeNom] = (nombrePretsParEquipe[equipeNom] || 0) + 1;
            }
        });
        
        // Calculer les moyennes
        const equipesData = [];
        for (const [equipe, dureeTotal] of Object.entries(dureesParEquipe)) {
            const nombrePrets = nombrePretsParEquipe[equipe];
            const dureeMoyenne = dureeTotal / nombrePrets;
            
            equipesData.push({
                equipe,
                dureeMoyenne,
                nombrePrets
            });
        }
        
        // Trier par durée moyenne
        equipesData.sort((a, b) => b.dureeMoyenne - a.dureeMoyenne);
        
        // Simuler un graphique basique avec une table
        const durationChart = document.createElement('div');
        durationChart.id = 'duration-chart-content';
        durationChart.style.width = '100%';
        
        let htmlContent = `
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Équipe</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Durée moyenne</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Nombre de prêts</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        equipesData.forEach(data => {
            const dureeMoyenneFormatee = formatDuree(data.dureeMoyenne);
            
            htmlContent += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${data.equipe}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${dureeMoyenneFormatee}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${data.nombrePrets}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                </tbody>
            </table>
            </div>

        `;
        
        durationChart.innerHTML = htmlContent;
        
        // Remplacer le contenu actuel
        durationChartElement.innerHTML = '';
        durationChartElement.appendChild(durationChart);
    }
    
    /**
     * Initialiser le graphique des top radios
     */
    function initTopRadiosChart() {
        if (!allPretsData.length || !topRadiosChartElement) return;
        
        // Compter les prêts par radio
        const pretsParRadio = {};
        
        allPretsData.forEach(pret => {
            if (pret.radio) {
                const radioId = pret.radio.id;
                const radioLabel = `${pret.radio.code_barre} (${pret.radio.marque} ${pret.radio.modele})`;
                
                if (!pretsParRadio[radioId]) {
                    pretsParRadio[radioId] = {
                        count: 0,
                        label: radioLabel
                    };
                }
                
                pretsParRadio[radioId].count++;
            }
        });
        
        // Convertir en tableau et trier
        const radiosStats = Object.entries(pretsParRadio).map(([id, data]) => ({
            id,
            label: data.label,
            count: data.count
        }));
        
        radiosStats.sort((a, b) => b.count - a.count);
        
        // Prendre les 10 premiers
        const topRadios = radiosStats.slice(0, 10);
        
        // Simuler un graphique basique avec une table
        const topRadiosChart = document.createElement('div');
        topRadiosChart.id = 'top-radios-chart-content';
        topRadiosChart.style.width = '100%';
        
        let htmlContent = `
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Radio</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Nombre de prêts</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        topRadios.forEach(radio => {
            htmlContent += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${radio.label}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${radio.count}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                </tbody>
            </table>
            </div>

        `;
        
        topRadiosChart.innerHTML = htmlContent;
        
        // Remplacer le contenu actuel
        topRadiosChartElement.innerHTML = '';
        topRadiosChartElement.appendChild(topRadiosChart);
    }
    
    /**
     * Initialiser le graphique des top emprunteurs
     */
    function initTopEmpruntersChart() {
        if (!allPretsData.length || !topEmprunteursChartElement) return;
        
        // Compter les prêts par personne
        const pretsParPersonne = {};
        
        allPretsData.forEach(pret => {
            if (pret.personne) {
                const personneId = pret.personne.id;
                const personneLabel = `${pret.personne.nom} ${pret.personne.prenom}`;
                
                if (!pretsParPersonne[personneId]) {
                    pretsParPersonne[personneId] = {
                        count: 0,
                        label: personneLabel
                    };
                }
                
                pretsParPersonne[personneId].count++;
            }
        });
        
        // Convertir en tableau et trier
        const personnesStats = Object.entries(pretsParPersonne).map(([id, data]) => ({
            id,
            label: data.label,
            count: data.count
        }));
        
        personnesStats.sort((a, b) => b.count - a.count);
        
        // Prendre les 10 premiers
        const topPersonnes = personnesStats.slice(0, 10);
        
        // Simuler un graphique basique avec une table
        const topEmprunteursChart = document.createElement('div');
        topEmprunteursChart.id = 'top-emprunteurs-chart-content';
        topEmprunteursChart.style.width = '100%';
        
        let htmlContent = `
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Emprunteur</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2;">Nombre de prêts</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        topPersonnes.forEach(personne => {
            htmlContent += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${personne.label}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${personne.count}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                </tbody>
            </table>
            </div>

        `;
        
        topEmprunteursChart.innerHTML = htmlContent;
        
        // Remplacer le contenu actuel
        topEmprunteursChartElement.innerHTML = '';
        topEmprunteursChartElement.appendChild(topEmprunteursChart);
    }
    
    /**
     * Formater une durée en heures vers un format lisible
     */
    function formatDuree(heures) {
        if (heures < 24) {
            return `${Math.round(heures)}h`;
        } else {
            const jours = Math.floor(heures / 24);
            const heuresRestantes = Math.round(heures % 24);
            return `${jours}j ${heuresRestantes}h`;
        }
    }
    
    /**
     * Afficher un message à l'utilisateur
     */
    function showMessage(message, type = 'info') {
        // Si un système de notification est disponible, l'utiliser
        // Sinon, fallback sur alert
        alert(message);
    }
});