document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM pour les formulaires et les boutons
    const individualBarcodeForm = document.getElementById('individual-barcode-form');
    const searchBarcodeForm = document.getElementById('search-barcode-form');
    const generateAllRadiosBtn = document.getElementById('generate-all-radios');
    const generateAvailableRadiosBtn = document.getElementById('generate-available-radios');
    const generateAllPersonnesBtn = document.getElementById('generate-all-personnes');
    const generateEquipePersonnesBtn = document.getElementById('generate-equipe-personnes');
    const equipeFilter = document.getElementById('equipe-filter');
    const generateSelectedBtn = document.getElementById('generate-selected');
    const generateAllBtn = document.getElementById('generate-all');
    
    // Éléments DOM pour les résultats de recherche
    const searchResultsContainer = document.getElementById('search-results-container');
    const searchResultsTitle = document.getElementById('search-results-title');
    const searchResultsHeaders = document.getElementById('search-results-headers');
    const searchResultsBody = document.getElementById('search-results-body');
    
    // Éléments DOM pour la prévisualisation
    const previewContainer = document.getElementById('preview-container');
    const barcodePreview = document.getElementById('barcode-preview');
    const downloadPreviewBtn = document.getElementById('download-preview');
    
    // Variable pour stocker les résultats de recherche courants
    let currentSearchResults = [];
    let currentPreviewCode = null;
    
    // Initialisation - Charger les équipes pour le filtre
    loadEquipes();
    
    // Écouteurs d'événements
    individualBarcodeForm.addEventListener('submit', handleIndividualBarcodeSubmit);
    searchBarcodeForm.addEventListener('submit', handleSearchBarcodeSubmit);
    generateAllRadiosBtn.addEventListener('click', () => generateAllRadiosBarcodes(false));
    generateAvailableRadiosBtn.addEventListener('click', () => generateAllRadiosBarcodes(true));
    generateAllPersonnesBtn.addEventListener('click', () => generateAllPersonnesBarcodes(null));
    equipeFilter.addEventListener('change', handleEquipeFilterChange);
    generateEquipePersonnesBtn.addEventListener('click', () => generateAllPersonnesBarcodes(equipeFilter.value));
    generateSelectedBtn.addEventListener('click', handleGenerateSelectedClick);
    generateAllBtn.addEventListener('click', handleGenerateAllClick);
    downloadPreviewBtn.addEventListener('click', handleDownloadPreviewClick);
    
    /**
     * Fonctions de gestion des événements
     */
    
    // Gérer la soumission du formulaire de code-barre individuel
    async function handleIndividualBarcodeSubmit(event) {
        event.preventDefault();
        
        const codeType = document.getElementById('code-type').value;
        const barcodeValue = document.getElementById('barcode-value').value.trim();
        
        if (!barcodeValue) {
            showMessage('Veuillez saisir un code-barre', 'error');
            return;
        }
        
        try {
            // Générer une prévisualisation
            await generatePreview(barcodeValue, null);
            currentPreviewCode = barcodeValue;
            
            // Afficher le prévisualisateur
            previewContainer.style.display = 'block';
            
            // Faire défiler jusqu'à la prévisualisation
            previewContainer.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la génération de la prévisualisation', 'error');
        }
    }
    
    // Gérer la soumission du formulaire de recherche
    async function handleSearchBarcodeSubmit(event) {
        event.preventDefault();
        
        const searchType = document.getElementById('search-type').value;
        const searchTerm = document.getElementById('search-term').value.trim();
        
        if (!searchTerm) {
            showMessage('Veuillez saisir un terme de recherche', 'error');
            return;
        }
        
        try {
            let results;
            
            if (searchType === 'radio') {
                results = await searchRadios(searchTerm);
                searchResultsTitle.textContent = 'Résultats de recherche - Radios';
                updateSearchTable('radio', results);
            } else {
                results = await searchPersonnes(searchTerm);
                searchResultsTitle.textContent = 'Résultats de recherche - Personnes';
                updateSearchTable('personne', results);
            }
            
            // Stocker les résultats pour une utilisation ultérieure
            currentSearchResults = results;
            
            // Mettre à jour les boutons de génération en fonction des résultats
            updateGenerationButtons(results.length);
            
            // Afficher les résultats
            searchResultsContainer.style.display = 'block';
            
            // Faire défiler jusqu'aux résultats
            searchResultsContainer.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la recherche', 'error');
        }
    }
    
    // Gérer le changement de filtre d'équipe
    function handleEquipeFilterChange() {
        const selectedEquipe = equipeFilter.value;
        generateEquipePersonnesBtn.disabled = !selectedEquipe;
    }
    
    // Gérer le clic sur "Générer les étiquettes sélectionnées"
    async function handleGenerateSelectedClick() {
        const checkboxes = document.querySelectorAll('#search-results-body input[type="checkbox"]:checked');
        
        if (checkboxes.length === 0) {
            showMessage('Veuillez sélectionner au moins une entrée', 'error');
            return;
        }
        
        try {
            // Collecter les codes sélectionnés
            const selectedCodes = [];
            checkboxes.forEach(checkbox => {
                const index = parseInt(checkbox.getAttribute('data-index'));
                if (index >= 0 && index < currentSearchResults.length) {
                    const item = currentSearchResults[index];
                    selectedCodes.push({
                        code: item.code,
                        label: item.label
                    });
                }
            });
            
            // Générer le PDF
            await generateMultipleBarcodesPDF(selectedCodes);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la génération des étiquettes', 'error');
        }
    }
    
    // Gérer le clic sur "Générer toutes les étiquettes"
    async function handleGenerateAllClick() {
        if (currentSearchResults.length === 0) {
            showMessage('Aucun résultat à générer', 'error');
            return;
        }
        
        try {
            // Préparer tous les codes
            const allCodes = currentSearchResults.map(item => ({
                code: item.code,
                label: item.label
            }));
            
            // Générer le PDF
            await generateMultipleBarcodesPDF(allCodes);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la génération des étiquettes', 'error');
        }
    }
    
    // Gérer le clic sur "Télécharger le PDF" pour la prévisualisation
    async function handleDownloadPreviewClick() {
        if (!currentPreviewCode) {
            showMessage('Aucune prévisualisation disponible', 'error');
            return;
        }
        
        try {
            // Rechercher dans l'interface pour trouver un label potentiel
            let label = null;
            const barcodeValue = document.getElementById('barcode-value').value.trim();
            if (currentPreviewCode === barcodeValue) {
                // La prévisualisation correspond au champ de saisie, chercher une étiquette
                const codeType = document.getElementById('code-type').value;
                if (codeType === 'radio') {
                    const radioSearchResults = await searchRadios(barcodeValue);
                    if (radioSearchResults.length > 0) {
                        label = radioSearchResults[0].label;
                    }
                } else {
                    const personneSearchResults = await searchPersonnes(barcodeValue);
                    if (personneSearchResults.length > 0) {
                        label = personneSearchResults[0].label;
                    }
                }
            }
            
            // Générer et télécharger le PDF
            await generateSingleBarcodePDF(currentPreviewCode, label);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du téléchargement du PDF', 'error');
        }
    }
    
    /**
     * Fonctions d'appel API
     */
    
    // Charger les équipes pour le filtre
    async function loadEquipes() {
        try {
            const response = await fetch('/api/etiquettes/equipes');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const equipes = await response.json();
            
            // Mettre à jour le select
            equipeFilter.innerHTML = '<option value="">Sélectionner une équipe</option>';
            
            equipes.forEach(equipe => {
                const option = document.createElement('option');
                option.value = equipe.id;
                option.textContent = `${equipe.nom} (${formatCategorie(equipe.categorie)})`;
                equipeFilter.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des équipes', 'error');
        }
    }
    
    // Rechercher des radios
    async function searchRadios(searchTerm) {
        const response = await fetch(`/api/etiquettes/radios?search=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Rechercher des personnes
    async function searchPersonnes(searchTerm) {
        const response = await fetch(`/api/etiquettes/personnes?search=${encodeURIComponent(searchTerm)}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Générer une prévisualisation de code-barre
    async function generatePreview(code, label) {
        const queryParams = new URLSearchParams({
            code: code
        });
        
        if (label) {
            queryParams.append('label', label);
        }
        
        const response = await fetch(`/api/etiquettes/preview?${queryParams.toString()}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Mettre à jour l'interface avec l'image
        barcodePreview.innerHTML = `<img src="${data.image}" alt="Code-barre prévisualisé" style="max-width: 100%;">`;
        
        return data;
    }
    
    // Générer un PDF avec un seul code-barre
    async function generateSingleBarcodePDF(code, label) {
        let url = `/api/etiquettes/single?code=${encodeURIComponent(code)}`;
        
        if (label) {
            url += `&label=${encodeURIComponent(label)}`;
        }
        
        // Rediriger vers l'URL pour déclencher le téléchargement
        window.location.href = url;
    }
    
    // Générer un PDF avec plusieurs codes-barres
    async function generateMultipleBarcodesPDF(codes) {
        try {
            const response = await fetch('/api/etiquettes/multiple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(codes)
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            // Convertir la réponse en blob et créer une URL
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Créer un lien de téléchargement invisible et cliquer dessus
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `barcodes_${codes.length}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            // Nettoyer
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la génération du PDF', 'error');
        }
    }
    
    // Générer toutes les étiquettes de radios
    async function generateAllRadiosBarcodes(disponible) {
        let url = '/api/etiquettes/all-radios';
        
        if (disponible) {
            url += '?disponible=true';
        }
        
        // Rediriger vers l'URL pour déclencher le téléchargement
        window.location.href = url;
    }
    
    // Générer toutes les étiquettes de personnes
    async function generateAllPersonnesBarcodes(equipeId) {
        let url = '/api/etiquettes/all-personnes';
        
        if (equipeId) {
            url += `?equipe_id=${equipeId}`;
        }
        
        // Rediriger vers l'URL pour déclencher le téléchargement
        window.location.href = url;
    }
    
    /**
     * Fonctions d'interface utilisateur
     */
    
    // Mettre à jour la table de résultats de recherche
    function updateSearchTable(type, results) {
        // Nettoyer les résultats précédents
        searchResultsHeaders.innerHTML = '';
        searchResultsBody.innerHTML = '';
        
        // Créer les en-têtes en fonction du type
        const headerRow = document.createElement('tr');
        
        // Colonne de sélection
        const selectHeader = document.createElement('th');
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('#search-results-body input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
        selectHeader.appendChild(selectAllCheckbox);
        headerRow.appendChild(selectHeader);
        
        // Autres colonnes
        headerRow.innerHTML += `
            <th>Code</th>
            <th>Nom</th>
        `;
        
        if (type === 'radio') {
            headerRow.innerHTML += `
                <th>Marque</th>
                <th>Modèle</th>
                <th>Statut</th>
            `;
        } else {
            headerRow.innerHTML += `
                <th>Prénom</th>
                <th>Équipe</th>
            `;
        }
        
        headerRow.innerHTML += `<th>Actions</th>`;
        
        searchResultsHeaders.appendChild(headerRow);
        
        // Ajouter les lignes de résultats
        if (results.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="${type === 'radio' ? 7 : 6}" class="text-center">Aucun résultat trouvé</td>`;
            searchResultsBody.appendChild(emptyRow);
            return;
        }
        
        results.forEach((item, index) => {
            const row = document.createElement('tr');
            
            // Colonne de sélection
            const checkboxCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('data-index', index);
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);
            
            // Code et nom communs aux deux types
            row.innerHTML += `
                <td>${item.code}</td>
                <td>${type === 'radio' ? item.label : item.details.nom}</td>
            `;
            
            // Colonnes spécifiques au type
            if (type === 'radio') {
                // Déterminer le statut
                let statut = 'Disponible';
                let statutClass = 'status-available';
                
                if (item.details.en_maintenance) {
                    statut = 'En maintenance';
                    statutClass = 'status-maintenance';
                }
                
                row.innerHTML += `
                    <td>${item.details.marque}</td>
                    <td>${item.details.modele}</td>
                    <td><span class="status-badge ${statutClass}">${statut}</span></td>
                `;
            } else {
                // Équipe pour les personnes
                const equipeNom = item.details.equipe || 'Aucune équipe';
                
                row.innerHTML += `
                    <td>${item.details.prenom}</td>
                    <td>${equipeNom}</td>
                `;
            }
            
            // Colonne d'actions
            row.innerHTML += `
                <td class="actions-cell">
                    <button class="action-btn preview-btn" data-code="${item.code}" data-label="${item.label}" title="Prévisualiser">
                        👁️
                    </button>
                    <button class="action-btn generate-single-btn" data-code="${item.code}" data-label="${item.label}" title="Générer l'étiquette">
                        📄
                    </button>
                </td>
            `;
            
            searchResultsBody.appendChild(row);
        });
        
        // Ajouter les écouteurs pour les boutons d'action
        document.querySelectorAll('.preview-btn').forEach(button => {
            button.addEventListener('click', async function() {
                const code = this.getAttribute('data-code');
                const label = this.getAttribute('data-label');
                
                try {
                    await generatePreview(code, label);
                    currentPreviewCode = code;
                    
                    // Afficher le prévisualisateur
                    previewContainer.style.display = 'block';
                    
                    // Faire défiler jusqu'à la prévisualisation
                    previewContainer.scrollIntoView({ behavior: 'smooth' });
                    
                } catch (error) {
                    console.error('Erreur:', error);
                    showMessage('Erreur lors de la génération de la prévisualisation', 'error');
                }
            });
        });
        
        document.querySelectorAll('.generate-single-btn').forEach(button => {
            button.addEventListener('click', function() {
                const code = this.getAttribute('data-code');
                const label = this.getAttribute('data-label');
                
                generateSingleBarcodePDF(code, label);
            });
        });
    }
    
    // Mettre à jour l'état des boutons de génération
    function updateGenerationButtons(resultCount) {
        generateSelectedBtn.disabled = resultCount === 0;
        generateAllBtn.disabled = resultCount === 0;
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
    
    // Afficher un message à l'utilisateur
    function showMessage(message, type = 'info') {
        // Si vous avez un système de notification, utilisez-le ici
        alert(message);
    }
});