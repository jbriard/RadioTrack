#!/usr/bin/env python
import uvicorn
import os
import argparse

def main():
    parser = argparse.ArgumentParser(description="Lancer l'application FastAPI")
    parser.add_argument(
        "--port", type=int, default=8200, help="Port sur lequel exécuter l'application (défaut: 8000)"
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Hôte sur lequel exécuter l'application (défaut: 127.0.0.1)"
    )
    parser.add_argument(
        "--reload", action="store_true", help="Activer le rechargement automatique du code"
    )

    args = parser.parse_args()

    # Vérifier si les répertoires nécessaires existent
    if not os.path.exists("static"):
        os.makedirs("static")
        os.makedirs("static/css")
        os.makedirs("static/js")
        print("Dossier static créé")

    if not os.path.exists("templates"):
        os.makedirs("templates")
        print("Dossier templates créé")

    if not os.path.exists("routes"):
        os.makedirs("routes")
        print("Dossier routes créé")

    print(f"Démarrage de l'application sur http://{args.host}:{args.port}")
    print("Appuyez sur CTRL+C pour arrêter")

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )

if __name__ == "__main__":
    main()
