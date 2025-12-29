# GitHub Actions - Docker Build & Push

Ce document explique comment les workflows GitHub Actions construisent et publient les images Docker vers GitHub Container Registry.

## Workflows

Deux workflows sont configurés :

1. **Frontend** (`naval_battle/.github/workflows/docker-build.yml`)
2. **Backend** (`naval_battle_back/.github/workflows/docker-build.yml`)

## Déclencheurs

Les workflows se déclenchent automatiquement sur :
- Push vers les branches `main` ou `master`
- Pull requests vers `main` ou `master`
- Déclenchement manuel via `workflow_dispatch`

## Images Docker

Les images sont publiées dans GitHub Container Registry (ghcr.io) avec les tags suivants :

- `latest` : Dernière version sur la branche par défaut
- `<branch-name>` : Tag basé sur le nom de la branche
- `<branch-name>-<sha>` : Tag avec le SHA du commit
- `<version>` : Tag sémantique si disponible

### Format des noms d'images

- Frontend : `ghcr.io/<owner>/<repo>/naval-battle-frontend`
- Backend : `ghcr.io/<owner>/<repo>/naval-battle-backend`

## Utilisation des images

### Pull des images

```bash
# Frontend
docker pull ghcr.io/<owner>/<repo>/naval-battle-frontend:latest

# Backend
docker pull ghcr.io/<owner>/<repo>/naval-battle-backend:latest
```

### Authentification

Pour pull les images depuis GitHub Container Registry, vous devez vous authentifier :

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin
```

Ou utilisez un Personal Access Token (PAT) avec les permissions `read:packages`.

## Permissions requises

Les workflows utilisent automatiquement `GITHUB_TOKEN` qui est généré automatiquement. Assurez-vous que les permissions suivantes sont activées dans les paramètres du repository :

- **Contents**: read
- **Packages**: write

## Cache Docker

Les workflows utilisent GitHub Actions Cache pour accélérer les builds Docker en mettant en cache les layers.

## Exemple d'utilisation avec docker-compose

Vous pouvez mettre à jour votre `docker-compose.yaml` pour utiliser les images depuis GitHub Container Registry :

```yaml
services:
  backend:
    image: ghcr.io/<owner>/<repo>/naval-battle-backend:latest
    # ... reste de la configuration

  frontend:
    image: ghcr.io/<owner>/<repo>/naval-battle-frontend:latest
    # ... reste de la configuration
```

