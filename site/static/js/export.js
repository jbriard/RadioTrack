document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let usersData = [];
    let radiosData = [];
    let equipes = [];
    let cfis = [];

    // Éléments DOM
    const usersOptions = document.getElementById('users-options');
    const usersFilterEquipe = document.getElementById('users-filter-equipe');
    const usersFilterCFI = document.getElementById('users-filter-cfi');
    const usersEquipeSelect = document.getElementById('users-equipe');
    const usersCFISelect = document.getElementById('users-cfi');
    const exportUsersBtn = document.getElementById('export-users-btn');
    const usersPreviewBody = document.getElementById('users-preview-body');
    const usersCount = document.getElementById('users-count');
    
    const radiosOptions = document.getElementById('radios-options');
    const exportRadiosBtn = document.getElementById('export-radios-btn');
    const radiosPreviewBody = document.getElementById('radios-preview-body');
    const radiosCount = document.getElementById('radios-count');

    // Initialisation
    initializeData();

    // Écouteurs d'événements
    usersOptions.addEventListener('change', function() {
        const selectedOption = this.value;
        toggleUserFilters(selectedOption);
        updateUsersPreview();
    });

    usersEquipeSelect.addEventListener('change', updateUsersPreview);
    usersCFISelect.addEventListener('change', updateUsersPreview);
    radiosOptions.addEventListener('change', updateRadiosPreview);

    exportUsersBtn.addEventListener('click', exportUsersCSV);
    exportRadiosBtn.addEventListener('click', exportRadiosCSV);

    /**
     * Fonctions d'initialisation
     */
    
    // Initialiser les données
    async function initializeData() {
        await loadEquipes();
        await loadCFIs();
        await loadUsers();
        await loadRadios();
        
        // Mettre à jour les prévisualisations
        updateUsersPreview();
        updateRadiosPreview();
    }

    // Charger les équipes
    async function loadEquipes() {
        try {
            const response = await fetch('/api/equipes?limit=100');
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des équipes');
            }
            
            equipes = await response.json();
            populateEquipesSelect();
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des équipes', 'error');
        }
    }

    // Charger les CFIs
    async function loadCFIs() {
        try {
            const response = await fetch('/api/cfis?limit=100');
            if (response.ok) {
                cfis = await response.json();
                populateCFIsSelect();
            } else if (response.status !== 404) {
                throw new Error('Erreur lors du chargement des CFIs');
            }
        } catch (error) {
            console.warn('Avertissement:', error);
            // Ce n'est pas critique, donc juste un warning
        }
    }

    // Charger les utilisateurs
    async function loadUsers() {
        try {
            const response = await fetch('/api/personnes?limit=1000');
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des utilisateurs');
            }
            
            usersData = await response.json();
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des utilisateurs', 'error');
        }
    }

    // Charger les radios
    async function loadRadios() {
        try {
            const response = await fetch('/api/radios?limit=1000');
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des radios');
            }
            
            const radios = await response.json();
            
            // Pour chaque radio, vérifier si elle est en prêt
            radiosData = await Promise.all(radios.map(async (radio) => {
                try {
                    const isLoaned = await checkRadioLoaned(radio.id);
                    return { ...radio, en_pret: isLoaned };
                } catch (error) {
                    console.error(`Erreur pour la radio ${radio.id}:`, error);
                    return { ...radio, en_pret: false };
                }
            }));
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des radios', 'error');
        }
    }

    // Vérifier si une radio est en prêt
    async function checkRadioLoaned(radioId) {
        try {
            const response = await fetch(`/api/radios/${radioId}/en-pret`);
            
            if (!response.ok) {
                return false;
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Erreur lors de la vérification du prêt pour la radio ${radioId}:`, error);
            return false;
        }
    }

    // Remplir le select des équipes
    function populateEquipesSelect() {
        usersEquipeSelect.innerHTML = '<option value="">Sélectionner une équipe</option>';
        
        equipes.forEach(equipe => {
            const option = document.createElement('option');
            option.value = equipe.id;
            option.textContent = equipe.nom;
            usersEquipeSelect.appendChild(option);
        });
    }

    // Remplir le select des CFIs
    function populateCFIsSelect() {
        usersCFISelect.innerHTML = '<option value="">Sélectionner un CFI</option>';
        
        cfis.forEach(cfi => {
            const option = document.createElement('option');
            option.value = cfi.id;
            option.textContent = cfi.nom;
            usersCFISelect.appendChild(option);
        });
    }

    /**
     * Fonctions d'affichage et de filtrage
     */
    
    // Changer les filtres visibles en fonction de l'option sélectionnée
    function toggleUserFilters(option) {
        // Masquer tous les filtres
        usersFilterEquipe.style.display = 'none';
        usersFilterCFI.style.display = 'none';
        
        // Afficher le filtre approprié
        if (option === 'equipe') {
            usersFilterEquipe.style.display = 'block';
        } else if (option === 'cfi') {
            usersFilterCFI.style.display = 'block';
        }
    }

    // Mettre à jour l'aperçu des utilisateurs
    function updateUsersPreview() {
        const option = usersOptions.value;
        let filteredUsers = [...usersData];
        
        // Appliquer les filtres
        if (option === 'equipe' && usersEquipeSelect.value) {
            const equipeId = parseInt(usersEquipeSelect.value);
            filteredUsers = filteredUsers.filter(user => user.id_equipe === equipeId);
        } else if (option === 'cfi' && usersCFISelect.value) {
            const cfiId = parseInt(usersCFISelect.value);
            filteredUsers = filteredUsers.filter(user => user.id_cfi === cfiId);
        }
        
        // Limiter à 10 utilisateurs pour l'aperçu
        const previewUsers = filteredUsers.slice(0, 10);
        
        // Mettre à jour le tableau d'aperçu
        usersPreviewBody.innerHTML = '';
        
        previewUsers.forEach(user => {
            const row = document.createElement('tr');
            
            // Créer le contact (prénom + espace + première lettre du nom + point)
            const contact = `${user.prenom} ${user.nom ? user.nom.charAt(0) + '.' : ''}`;
            
            // Trouver le nom du CFI si disponible
            let cfiName = '';
            if (user.id_cfi && cfis.length > 0) {
                const cfi = cfis.find(c => c.id === user.id_cfi);
                cfiName = cfi ? cfi.nom : '';
            } else if (user.cfi) {
                cfiName = user.cfi.nom || '';
            }
            
            row.innerHTML = `
                <td>${user.prenom || ''}</td>
                <td>${user.nom || ''}</td>
                <td>${cfiName}</td>
                <td>${contact}</td>
                <td>${user.code_barre || ''}</td>
            `;
            
            usersPreviewBody.appendChild(row);
        });
        
        // Mettre à jour le compteur
        usersCount.textContent = `${previewUsers.length} utilisateurs affichés sur ${filteredUsers.length} sélectionnés`;
    }

    // Mettre à jour l'aperçu des radios
    function updateRadiosPreview() {
        const option = radiosOptions.value;
        let filteredRadios = [...radiosData];
        
        // Appliquer les filtres
        if (option === 'disponible') {
            filteredRadios = filteredRadios.filter(radio => !radio.en_maintenance && !radio.en_pret);
        } else if (option === 'pret') {
            filteredRadios = filteredRadios.filter(radio => radio.en_pret);
        } else if (option === 'maintenance') {
            filteredRadios = filteredRadios.filter(radio => radio.en_maintenance);
        } else if (option === 'geoloc') {
            filteredRadios = filteredRadios.filter(radio => radio.est_geolocalisable);
        }
        
        // Limiter à 10 radios pour l'aperçu
        const previewRadios = filteredRadios.slice(0, 10);
        
        // Mettre à jour le tableau d'aperçu
        radiosPreviewBody.innerHTML = '';
        
        previewRadios.forEach(radio => {
            const row = document.createElement('tr');
            
            // Formatage pour l'affichage
            const geoloc = radio.est_geolocalisable ? 'OUI' : 'NON';
            
            row.innerHTML = `
                <td>${radio.code_barre || ''}</td>
                <td>${radio.marque || ''}</td>
                <td>${radio.modele || ''}</td>
                <td>${radio.numero_serie || ''}</td>
                <td>${geoloc}</td>
            `;
            
            radiosPreviewBody.appendChild(row);
        });
        
        // Mettre à jour le compteur
        radiosCount.textContent = `${previewRadios.length} radios affichées sur ${filteredRadios.length} sélectionnées`;
    }

    /**
     * Fonctions d'export CSV
     */
    
    // Exporter les utilisateurs au format CSV
    function exportUsersCSV() {
        const option = usersOptions.value;
        let filteredUsers = [...usersData];
        let filename = 'sauveteurs.csv';
        
        // Appliquer les filtres
        if (option === 'equipe' && usersEquipeSelect.value) {
            const equipeId = parseInt(usersEquipeSelect.value);
            filteredUsers = filteredUsers.filter(user => user.id_equipe === equipeId);
            
            // Trouver le nom de l'équipe pour le nom du fichier
            const equipe = equipes.find(e => e.id === equipeId);
            if (equipe) {
                filename = `sauveteurs_${equipe.nom.replace(/\s+/g, '_').toLowerCase()}.csv`;
            }
        } else if (option === 'cfi' && usersCFISelect.value) {
            const cfiId = parseInt(usersCFISelect.value);
            filteredUsers = filteredUsers.filter(user => user.id_cfi === cfiId);
            
            // Trouver le nom du CFI pour le nom du fichier
            const cfi = cfis.find(c => c.id === cfiId);
            if (cfi) {
                filename = `sauveteurs_${cfi.nom.replace(/\s+/g, '_').toLowerCase()}.csv`;
            }
        }
        
        // Créer les lignes CSV
        const csvRows = [];
        
        // En-tête
        csvRows.push('Prénom,Nom,CFI,CONTACT,CODE BARRE');
        
        // Données
        filteredUsers.forEach(user => {
            // Créer le contact (prénom + espace + première lettre du nom + point)
            const contact = `${user.prenom} ${user.nom ? user.nom.charAt(0) + '.' : ''}`;
            
            // Trouver le nom du CFI si disponible
            let cfiName = '';
            if (user.id_cfi && cfis.length > 0) {
                const cfi = cfis.find(c => c.id === user.id_cfi);
                cfiName = cfi ? cfi.nom : '';
            } else if (user.cfi) {
                cfiName = user.cfi.nom || '';
            }
            
            // Échapper les virgules dans les champs
            const prenom = user.prenom ? `"${user.prenom.replace(/"/g, '""')}"` : '';
            const nom = user.nom ? `"${user.nom.replace(/"/g, '""')}"` : '';
            const cfiNameEscaped = cfiName ? `"${cfiName.replace(/"/g, '""')}"` : '';
            const codeBarre = user.code_barre ? `"${user.code_barre.replace(/"/g, '""')}"` : '';
            
            csvRows.push(`${prenom},${nom},${cfiNameEscaped},${contact},${codeBarre}`);
        });
        
        // Créer le contenu CSV
        const csvContent = csvRows.join('\n');
        
        // Télécharger le fichier
        downloadCSV(csvContent, filename);
        
        // Feedback utilisateur
        showMessage(`${filteredUsers.length} utilisateurs exportés avec succès`, 'success');
    }

    // Exporter les radios au format CSV
    function exportRadiosCSV() {
        const option = radiosOptions.value;
        let filteredRadios = [...radiosData];
        let filename = 'radios.csv';
        
        // Appliquer les filtres
        if (option === 'disponible') {
            filteredRadios = filteredRadios.filter(radio => !radio.en_maintenance && !radio.en_pret);
            filename = 'radios_disponibles.csv';
        } else if (option === 'pret') {
            filteredRadios = filteredRadios.filter(radio => radio.en_pret);
            filename = 'radios_en_pret.csv';
        } else if (option === 'maintenance') {
            filteredRadios = filteredRadios.filter(radio => radio.en_maintenance);
            filename = 'radios_en_maintenance.csv';
        } else if (option === 'geoloc') {
            filteredRadios = filteredRadios.filter(radio => radio.est_geolocalisable);
            filename = 'radios_geolocalisables.csv';
        }
        
        // Créer les lignes CSV
        const csvRows = [];
        
        // En-tête
        csvRows.push('CODE,MARQUE,MODELE,S/N,GEOLOC');
        
        // Données
        filteredRadios.forEach(radio => {
            // Formatage pour l'export
            const geoloc = radio.est_geolocalisable ? 'OUI' : 'NON';
            
            // Échapper les virgules dans les champs
            const code = radio.code_barre ? `"${radio.code_barre.replace(/"/g, '""')}"` : '';
            const marque = radio.marque ? `"${radio.marque.replace(/"/g, '""')}"` : '';
            const modele = radio.modele ? `"${radio.modele.replace(/"/g, '""')}"` : '';
            const sn = radio.numero_serie ? `"${radio.numero_serie.replace(/"/g, '""')}"` : '';
            
            csvRows.push(`${code},${marque},${modele},${sn},${geoloc}`);
        });
        
        // Créer le contenu CSV
        const csvContent = csvRows.join('\n');
        
        // Télécharger le fichier
        downloadCSV(csvContent, filename);
        
        // Feedback utilisateur
        showMessage(`${filteredRadios.length} radios exportées avec succès`, 'success');
    }

    // Télécharger le contenu CSV
    function downloadCSV(content, filename) {
        // Créer un Blob avec le contenu CSV
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        
        // Créer un lien de téléchargement
        const link = document.createElement('a');
        
        // Vérifier si le navigateur prend en charge les URL d'objet
        if (navigator.msSaveBlob) {
            // Pour Internet Explorer
            navigator.msSaveBlob(blob, filename);
        } else {
            // Pour les autres navigateurs
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Utilitaires
     */
    
    // Afficher un message
    function showMessage(message, type = 'info') {
        alert(message);
    }
});