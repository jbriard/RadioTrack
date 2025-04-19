// Script principal pour l'application

// Fonction pour afficher des notifications
function showNotification(message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Ajouter au DOM
    document.body.appendChild(notification);

    // Afficher avec animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Retirer après 3 secondes
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Fonction pour formater les dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour récupérer les données via API
async function fetchData(endpoint) {
    try {
        const response = await fetch(endpoint);

        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de la récupération des données: ${error.message}`);
        showNotification(`Erreur: ${error.message}`, 'error');
        return null;
    }
}

// Fonction pour envoyer des données via API
async function postData(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Erreur HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Erreur lors de l'envoi des données: ${error.message}`);
        showNotification(`Erreur: ${error.message}`, 'error');
        return null;
    }
}

// Navigation responsive pour mobile
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '&#9776;'; // Icône hamburger
    menuToggle.style.display = 'none';

    // Ajouter le bouton de menu au header
    const header = document.querySelector('.app-header');
    if (header) {
        header.prepend(menuToggle);

        // Événement pour afficher/masquer le menu sur mobile
        menuToggle.addEventListener('click', function() {
            const nav = document.querySelector('.app-header nav');
            if (nav) {
                nav.classList.toggle('show-mobile');
            }

            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('show-mobile');
            }
        });

        // Vérifier la taille de l'écran et ajuster l'affichage
        function checkScreenSize() {
            if (window.innerWidth <= 768) {
                menuToggle.style.display = 'block';
            } else {
                menuToggle.style.display = 'none';

                // Masquer le menu mobile si la fenêtre est redimensionnée
                const nav = document.querySelector('.app-header nav');
                if (nav) {
                    nav.classList.remove('show-mobile');
                }

                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.remove('show-mobile');
                }
            }
        }

        // Vérifier au chargement et lors du redimensionnement
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
    }
});

// Ajout des gestionnaires d'événements pour les actions rapides
document.addEventListener('DOMContentLoaded', function() {
    const actionButtons = document.querySelectorAll('.action-btn');

    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.textContent.trim();

            if (action === 'Ajouter une donnée') {
                showNotification('Fonctionnalité à implémenter: Ajouter une donnée');
                // TODO: Implémenter l'ajout de données
            } else if (action === 'Générer un rapport') {
                showNotification('Fonctionnalité à implémenter: Générer un rapport');
                // TODO: Implémenter la génération de rapport
            }
        });
    });
});
