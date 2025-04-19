document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const loanForm = document.getElementById('loan-form');
    const returnForm = document.getElementById('return-form');
    const radioCode = document.getElementById('radio-code');
    const personneCode = document.getElementById('personne-code');
    const accessoiresSelect = document.getElementById('accessoires');
    const commentairePret = document.getElementById('commentaire-pret');
    const returnRadioCode = document.getElementById('return-radio-code');
    const commentaireRetour = document.getElementById('commentaire-retour');
    const radioInfo = document.getElementById('radio-info');
    const personneInfo = document.getElementById('personne-info');
    const returnInfo = document.getElementById('return-info');
    const activeLoansBody = document.getElementById('active-loans-body');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmAction = document.getElementById('confirm-action');
    const cancelAction = document.getElementById('cancel-action');

    // Fermer le modal de confirmation
    document.querySelectorAll('.close, #cancel-action').forEach(element => {
        element.addEventListener('click', function() {
            confirmModal.style.display = 'none';
        });
    });

    // Variable pour stocker les informations temporaires
    let tempPretData = null;
    let tempRetourData = null;

    // Initialisation - charger les prêts actifs
    loadActiveLoans();

    // Écouteurs d'événements
    loanForm.addEventListener('submit', handleLoanSubmit);
    returnForm.addEventListener('submit', handleReturnSubmit);
    
    // Écouteurs pour la validation en temps réel
    radioCode.addEventListener('blur', validateRadioCode);
    personneCode.addEventListener('blur', validatePersonneCode);
    returnRadioCode.addEventListener('blur', validateReturnRadioCode);

    /**
     * Fonctions principales
     */

    // Charger les prêts actifs
    async function loadActiveLoans() {
        try {
            const response = await fetch('/api/prets?actif=true&limit=100');
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const prets = await response.json();
            
            updateActiveLoansTable(prets);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors du chargement des prêts actifs', 'error');
        }
    }

    // Mettre à jour le tableau des prêts actifs
    function updateActiveLoansTable(prets) {
        activeLoansBody.innerHTML = '';
        
        if (prets.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="6" class="text-center">Aucune radio actuellement en prêt</td>';
            activeLoansBody.appendChild(emptyRow);
            return;
        }
        
        prets.forEach(pret => {
            const row = document.createElement('tr');
            
            // Formatage de la date
            const dateEmprunt = new Date(pret.date_emprunt).toLocaleString('fr-FR');
            
            // Informations sur la radio et la personne
            const radioCode = pret.radio ? pret.radio.code_barre : 'Radio inconnue';
            const radioDetail = pret.radio ? `${pret.radio.marque} ${pret.radio.modele}` : '-';
            const personneCode = pret.personne ? pret.personne.code_barre : 'Personne inconnue';
            const personneNom = pret.personne ? `${pret.personne.nom} ${pret.personne.prenom}` : '-';
            
            // Formater les accessoires
            const accessoires = formatAccessoires(pret.accessoires);
            
            // Créer des liens vers les pages détaillées
            const radioLink = pret.radio ? 
                `<a href="/radios?id=${pret.radio.id}" class="detail-link">${radioCode}</a>` : 
                radioCode;
                
            const personneLink = pret.personne ? 
                `<a href="/personnes?id=${pret.personne.id}" class="detail-link">${personneCode}</a>` : 
                personneCode;
            
            row.innerHTML = `
                <td>${radioLink}</td>
                <td>${radioDetail}</td>
                <td>${personneLink}<br><small>${personneNom}</small></td>
                <td>${accessoires}</td>
                <td>${dateEmprunt}</td>
                <td class="actions-cell">
                    <button class="action-btn return-btn" data-id="${pret.id}" data-radio="${radioCode}">
                        Retour
                    </button>
                </td>
            `;
            
            activeLoansBody.appendChild(row);
        });
        
        // Ajouter les écouteurs pour les boutons de retour
        document.querySelectorAll('.return-btn').forEach(button => {
            button.addEventListener('click', function() {
                const pretId = this.getAttribute('data-id');
                const radioCode = this.getAttribute('data-radio');
                
                showReturnConfirmation(pretId, radioCode);
            });
        });
    }

    // Formater les accessoires pour l'affichage
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

    // Valider le code radio pour un prêt
    async function validateRadioCode() {
        const code = radioCode.value.trim();
        
        if (!code) {
            radioInfo.textContent = '';
            return;
        }
        
        try {
            // Rechercher la radio par son code barre
            const response = await fetch(`/api/radios?search=${encodeURIComponent(code)}&limit=1`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const radios = await response.json();
            
            if (radios.length === 0) {
                radioInfo.textContent = 'Radio non trouvée';
                radioInfo.className = 'form-info error';
                return false;
            }
            
            const radio = radios[0];
            
            // Vérifier si la radio est disponible
            if (radio.en_maintenance) {
                radioInfo.textContent = 'Radio en maintenance';
                radioInfo.className = 'form-info error';
                return false;
            }
            
            // Vérifier si la radio est déjà en prêt
            const pretResponse = await fetch(`/api/prets?id_radio=${radio.id}&actif=true`);
            
            if (!pretResponse.ok) {
                throw new Error(`Erreur HTTP: ${pretResponse.status}`);
            }
            
            const prets = await pretResponse.json();
            
            if (prets.length > 0) {
                radioInfo.textContent = 'Radio déjà en prêt';
                radioInfo.className = 'form-info error';
                return false;
            }
            
            // Radio valide et disponible
            radioInfo.textContent = `${radio.marque} ${radio.modele}`;
            radioInfo.className = 'form-info success';
            return true;
            
        } catch (error) {
            console.error('Erreur:', error);
            radioInfo.textContent = 'Erreur de validation';
            radioInfo.className = 'form-info error';
            return false;
        }
    }

    // Valider le code personne pour un prêt
    async function validatePersonneCode() {
        const code = personneCode.value.trim();
        
        if (!code) {
            personneInfo.textContent = '';
            return;
        }
        
        try {
            // Rechercher la personne par son code barre
            const response = await fetch(`/api/personnes?search=${encodeURIComponent(code)}&limit=1`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const personnes = await response.json();
            
            if (personnes.length === 0) {
                personneInfo.textContent = 'Personne non trouvée';
                personneInfo.className = 'form-info error';
                return false;
            }
            
            const personne = personnes[0];
            
            // Personne valide
            personneInfo.textContent = `${personne.nom} ${personne.prenom}`;
            personneInfo.className = 'form-info success';
            return true;
            
        } catch (error) {
            console.error('Erreur:', error);
            personneInfo.textContent = 'Erreur de validation';
            personneInfo.className = 'form-info error';
            return false;
        }
    }

    // Valider le code radio pour un retour
    async function validateReturnRadioCode() {
        const code = returnRadioCode.value.trim();
        
        if (!code) {
            returnInfo.textContent = '';
            return;
        }
        
        try {
            // Rechercher la radio par son code barre
            const response = await fetch(`/api/radios?search=${encodeURIComponent(code)}&limit=1`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const radios = await response.json();
            
            if (radios.length === 0) {
                returnInfo.textContent = 'Radio non trouvée';
                returnInfo.className = 'form-info error';
                return false;
            }
            
            const radio = radios[0];
            
            // Vérifier si la radio est en prêt
            const pretResponse = await fetch(`/api/prets?id_radio=${radio.id}&actif=true`);
            
            if (!pretResponse.ok) {
                throw new Error(`Erreur HTTP: ${pretResponse.status}`);
            }
            
            const prets = await pretResponse.json();
            
            if (prets.length === 0) {
                returnInfo.textContent = 'Radio non empruntée';
                returnInfo.className = 'form-info error';
                return false;
            }
            
            const pret = prets[0];
            const personneNom = pret.personne ? `${pret.personne.nom} ${pret.personne.prenom}` : 'Personne inconnue';
            
            // Radio valide et en prêt
            returnInfo.textContent = `Empruntée par ${personneNom}`;
            returnInfo.className = 'form-info success';
            return true;
            
        } catch (error) {
            console.error('Erreur:', error);
            returnInfo.textContent = 'Erreur de validation';
            returnInfo.className = 'form-info error';
            return false;
        }
    }

    // Traiter la soumission du formulaire de prêt
    async function handleLoanSubmit(event) {
        event.preventDefault();
        
        // Valider les champs
        const isRadioValid = await validateRadioCode();
        const isPersonneValid = await validatePersonneCode();
        
        if (!isRadioValid || !isPersonneValid) {
            showMessage('Veuillez corriger les erreurs avant de continuer', 'error');
            return;
        }
        
        try {
            // Obtenir les IDs à partir des codes
            const radioResponse = await fetch(`/api/radios?search=${encodeURIComponent(radioCode.value.trim())}&limit=1`);
            const radios = await radioResponse.json();
            
            const personneResponse = await fetch(`/api/personnes?search=${encodeURIComponent(personneCode.value.trim())}&limit=1`);
            const personnes = await personneResponse.json();
            
            if (radios.length === 0 || personnes.length === 0) {
                showMessage('Radio ou personne non trouvée', 'error');
                return;
            }
            
            const radioId = radios[0].id;
            const personneId = personnes[0].id;
            const accessoires = accessoiresSelect.value;
            const commentaire = commentairePret.value;
            
            // Préparer les données pour la confirmation
            tempPretData = {
                id_radio: radioId,
                id_personne: personneId,
                accessoires: accessoires,
                commentaire: commentaire
            };
            
            // Afficher la confirmation
            showLoanConfirmation(radios[0], personnes[0], accessoires);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la préparation du prêt', 'error');
        }
    }

    // Traiter la soumission du formulaire de retour
    async function handleReturnSubmit(event) {
        event.preventDefault();
        
        // Valider le champ
        const isRadioValid = await validateReturnRadioCode();
        
        if (!isRadioValid) {
            showMessage('Veuillez corriger les erreurs avant de continuer', 'error');
            return;
        }
        
        try {
            // Obtenir le prêt actif pour cette radio
            const radioResponse = await fetch(`/api/radios?search=${encodeURIComponent(returnRadioCode.value.trim())}&limit=1`);
            const radios = await radioResponse.json();
            
            if (radios.length === 0) {
                showMessage('Radio non trouvée', 'error');
                return;
            }
            
            const radioId = radios[0].id;
            
            const pretResponse = await fetch(`/api/prets?id_radio=${radioId}&actif=true`);
            const prets = await pretResponse.json();
            
            if (prets.length === 0) {
                showMessage('Aucun prêt actif trouvé pour cette radio', 'error');
                return;
            }
            
            const pret = prets[0];
            const commentaire = commentaireRetour.value;
            
            // Préparer les données pour la confirmation
            tempRetourData = {
                pret_id: pret.id,
                commentaire: commentaire
            };
            
            // Afficher la confirmation
            showReturnConfirmationFromForm(pret, radios[0]);
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('Erreur lors de la préparation du retour', 'error');
        }
    }

    // Afficher la confirmation de prêt
    function showLoanConfirmation(radio, personne, accessoires) {
        confirmTitle.textContent = 'Confirmer le prêt';
        confirmMessage.innerHTML = `
            <p>Vous êtes sur le point d'enregistrer le prêt suivant:</p>
            <p><strong>Radio:</strong> ${radio.code_barre} (${radio.marque} ${radio.modele})</p>
            <p><strong>Emprunteur:</strong> ${personne.code_barre} - ${personne.nom} ${personne.prenom}</p>
            <p><strong>Accessoires:</strong> ${formatAccessoires(accessoires)}</p>
            <p>Voulez-vous confirmer ce prêt?</p>
        `;
        
        // Action de confirmation
        confirmAction.textContent = 'Confirmer le prêt';
        confirmAction.onclick = executeLoan;
        
        // Afficher le modal
        confirmModal.style.display = 'flex';
    }

    // Afficher la confirmation de retour depuis le formulaire
    function showReturnConfirmationFromForm(pret, radio) {
        const personneInfo = pret.personne ? 
            `${pret.personne.code_barre} - ${pret.personne.nom} ${pret.personne.prenom}` : 
            'Personne inconnue';
        
        confirmTitle.textContent = 'Confirmer le retour';
        confirmMessage.innerHTML = `
            <p>Vous êtes sur le point d'enregistrer le retour de la radio suivante:</p>
            <p><strong>Radio:</strong> ${radio.code_barre} (${radio.marque} ${radio.modele})</p>
            <p><strong>Emprunteur:</strong> ${personneInfo}</p>
            <p>Voulez-vous confirmer ce retour?</p>
        `;
        
        // Action de confirmation
        confirmAction.textContent = 'Confirmer le retour';
        confirmAction.onclick = executeReturn;
        
        // Afficher le modal
        confirmModal.style.display = 'flex';
    }

    // Afficher la confirmation de retour depuis le tableau
    function showReturnConfirmation(pretId, radioCode) {
        confirmTitle.textContent = 'Confirmer le retour';
        confirmMessage.innerHTML = `
            <p>Vous êtes sur le point d'enregistrer le retour de la radio <strong>${radioCode}</strong>.</p>
            <p>Voulez-vous confirmer ce retour?</p>
            <div class="form-group">
                <label for="commentaire-modal">Commentaire (optionnel):</label>
                <textarea id="commentaire-modal" rows="3"></textarea>
            </div>
        `;
        
        // Action de confirmation
        confirmAction.textContent = 'Confirmer le retour';
        confirmAction.onclick = function() {
            const commentaire = document.getElementById('commentaire-modal').value;
            
            tempRetourData = {
                pret_id: pretId,
                commentaire: commentaire
            };
            
            executeReturn();
        };
        
        // Afficher le modal
        confirmModal.style.display = 'flex';
    }

    // Exécuter le prêt
    async function executeLoan() {
        if (!tempPretData) {
            showMessage('Données de prêt non disponibles', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/prets/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tempPretData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de l\'enregistrement du prêt');
            }
            
            // Fermer le modal
            confirmModal.style.display = 'none';
            
            // Réinitialiser le formulaire
            loanForm.reset();
            radioInfo.textContent = '';
            personneInfo.textContent = '';
            
            // Recharger les prêts actifs
            loadActiveLoans();
            
            // Afficher un message de succès
            showMessage('Prêt enregistré avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        } finally {
            tempPretData = null;
        }
    }

    // Exécuter le retour
    async function executeReturn() {
        if (!tempRetourData) {
            showMessage('Données de retour non disponibles', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/prets/${tempRetourData.pret_id}/retour`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    commentaire: tempRetourData.commentaire
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erreur lors de l\'enregistrement du retour');
            }
            
            // Fermer le modal
            confirmModal.style.display = 'none';
            
            // Réinitialiser le formulaire
            returnForm.reset();
            returnInfo.textContent = '';
            
            // Recharger les prêts actifs
            loadActiveLoans();
            
            // Afficher un message de succès
            showMessage('Retour enregistré avec succès', 'success');
            
        } catch (error) {
            console.error('Erreur:', error);
            showMessage(error.message, 'error');
        } finally {
            tempRetourData = null;
        }
    }

    // Afficher un message
    function showMessage(message, type = 'info') {
        alert(message); // À remplacer par un système de notification plus élaboré
    }
});