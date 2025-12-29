# Explication des Dockerfiles et Workflows CI/CD

Ce document explique en détail le fonctionnement des Dockerfiles et des workflows GitHub Actions pour les applications Naval Battle.

## 📦 Dockerfiles

### Frontend Dockerfile (`naval_battle/Dockerfile`)

#### Architecture Multi-Stage

Le Dockerfile utilise une architecture **multi-stage** pour optimiser la taille de l'image finale et améliorer la sécurité.

#### Stage 1: Dependencies (`deps`)
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
```

**Objectif** : Installer uniquement les dépendances
- Utilise `node:20-alpine` (image légère basée sur Alpine Linux)
- Copie uniquement les fichiers de dépendances (`package.json`, `package-lock.json`)
- Exécute `npm ci` pour une installation propre et reproductible
- **Avantage** : Ce stage peut être mis en cache si les dépendances ne changent pas

#### Stage 2: Builder
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build
```

**Objectif** : Compiler l'application Next.js
- Récupère les `node_modules` du stage `deps` (évite de réinstaller)
- Copie tout le code source
- Désactive la télémétrie Next.js
- Compile l'application avec `npm run build`
- Génère le build standalone dans `.next/standalone/`

#### Stage 3: Runner (Image finale)
```dockerfile
FROM node:20-alpine AS runner
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

**Objectif** : Créer l'image de production minimale
- **Sécurité** : Crée un utilisateur non-root (`nextjs`) pour exécuter l'application
- Copie uniquement les fichiers nécessaires :
  - `public/` : Assets statiques
  - `.next/standalone/` : Application Next.js standalone (contient `server.js`)
  - `.next/static/` : Fichiers statiques compilés
- Définit les permissions avec `chown`
- Expose le port 3000
- Lance l'application avec `node server.js`

**Résultat** : Image finale de ~150-200 MB (vs ~1 GB si on gardait tout)

---

### Backend Dockerfile (`naval_battle_back/Dockerfile`)

#### Stage 1: Dependencies (`deps`)
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
```

Identique au frontend : installation des dépendances.

#### Stage 2: Prisma Generator (`prisma`)
```dockerfile
FROM node:20-alpine AS prisma
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
```

**Objectif** : Générer le client Prisma
- Copie le schéma Prisma
- Génère le client Prisma dans `generated/prisma/`
- **Pourquoi un stage séparé ?** : Permet de mettre en cache la génération Prisma indépendamment

#### Stage 3: Builder
```dockerfile
FROM node:20-alpine AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/generated ./generated
COPY . .
RUN npm run build
```

**Objectif** : Compiler NestJS
- Récupère les dépendances et le client Prisma généré
- Compile TypeScript vers JavaScript dans `dist/`

#### Stage 4: Runner (Image finale)
```dockerfile
FROM node:20-alpine AS runner
ENV NODE_ENV production
RUN npm install -g prisma@6.16.3
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
USER nestjs
EXPOSE 4000
CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
```

**Objectif** : Image de production avec migrations automatiques
- Installe Prisma CLI globalement (pour les migrations)
- Crée un utilisateur non-root (`nestjs`)
- Copie les fichiers compilés et nécessaires
- **Migrations automatiques** : Exécute `prisma migrate deploy` avant de démarrer
- Lance l'application NestJS

**Différences avec le frontend** :
- Nécessite Prisma CLI pour les migrations
- Copie `node_modules` complet (NestJS a besoin de toutes les dépendances runtime)
- Exécute les migrations au démarrage

---

## 🚀 Workflows GitHub Actions

### Structure commune

Les deux workflows (frontend et backend) suivent la même structure :

#### 1. Déclencheurs (`on:`)

```yaml
on:
  push:
    branches: [main, master]
    paths:
      - 'src/**'
      - 'package.json'
      # ... autres chemins pertinents
  pull_request:
    branches: [main, master]
    paths: # même configuration
  workflow_dispatch:
```

**Explication** :
- **`push`** : Se déclenche sur push vers `main`/`master`
- **`paths`** : Ne se déclenche QUE si les fichiers modifiés sont dans ces chemins (optimisation)
- **`pull_request`** : Se déclenche sur les PR (mais ne push pas l'image)
- **`workflow_dispatch`** : Permet un déclenchement manuel depuis l'interface GitHub

#### 2. Variables d'environnement

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/naval-battle-{frontend|backend}
```

- **`REGISTRY`** : GitHub Container Registry (`ghcr.io`)
- **`IMAGE_NAME`** : Nom de l'image basé sur le repository GitHub
  - Exemple : `ghcr.io/username/repo/naval-battle-frontend`

#### 3. Permissions

```yaml
permissions:
  contents: read    # Lire le code
  packages: write   # Écrire dans GitHub Container Registry
```

Nécessaire pour publier dans GitHub Container Registry.

#### 4. Étapes du workflow

##### Étape 1: Checkout
```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```
Récupère le code source du repository.

##### Étape 2: Docker Buildx
```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
```
Configure Docker Buildx (nécessaire pour les builds avancés et le cache).

##### Étape 3: Authentification
```yaml
- name: Log in to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```
S'authentifie auprès de GitHub Container Registry avec le token automatique.

##### Étape 4: Métadonnées (Tags)
```yaml
- name: Extract metadata (tags, labels) for Docker
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
    tags: |
      type=ref,event=branch        # Tag avec le nom de la branche
      type=ref,event=pr             # Tag pour les PR
      type=semver,pattern={{version}}  # Tag sémantique (v1.0.0)
      type=sha,prefix={{branch}}-   # Tag avec SHA (main-abc123)
      type=raw,value=latest,enable={{is_default_branch}}  # Tag "latest" sur main
```

**Génère automatiquement des tags** :
- `main` : Si sur la branche main
- `pr-123` : Pour les pull requests
- `v1.0.0` : Si un tag Git sémantique existe
- `main-abc123` : SHA du commit
- `latest` : Uniquement sur la branche par défaut

##### Étape 5: Build et Push
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./Dockerfile
    push: ${{ github.event_name != 'pull_request' }}
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Paramètres importants** :
- **`context: .`** : Répertoire de build (racine du projet)
- **`file: ./Dockerfile`** : Chemin vers le Dockerfile
- **`push: ${{ github.event_name != 'pull_request' }}`** :
  - ✅ Push l'image sur `push` vers main
  - ❌ Ne push PAS sur les pull requests (juste build pour tester)
- **`cache-from/cache-to: type=gha`** :
  - Utilise GitHub Actions Cache pour mettre en cache les layers Docker
  - **Avantage** : Builds beaucoup plus rapides (2-3 min au lieu de 10-15 min)

---

## 📝 Fichiers .dockerignore

### Frontend (`.dockerignore`)
```
node_modules    # Évite de copier node_modules (sera réinstallé)
.next          # Build local (sera régénéré)
.git           # Évite de copier l'historique Git
.env*.local    # Fichiers d'environnement locaux
```

### Backend (`.dockerignore`)
```
node_modules
dist           # Build local
test           # Fichiers de test
*.spec.ts      # Tests unitaires
*.e2e-spec.ts  # Tests e2e
```

**Objectif** : Réduire la taille du contexte Docker et éviter de copier des fichiers inutiles.

---

## 🔄 Flux complet

### Sur un push vers `main` :

1. **GitHub Actions détecte le push**
2. **Checkout du code**
3. **Setup Docker Buildx**
4. **Authentification** auprès de `ghcr.io`
5. **Génération des tags** (latest, main, main-abc123, etc.)
6. **Build de l'image Docker** :
   - Utilise le cache GitHub Actions si disponible
   - Exécute les stages du Dockerfile
   - Crée l'image optimisée
7. **Push vers GitHub Container Registry** avec tous les tags
8. **Image disponible** : `ghcr.io/owner/repo/naval-battle-{frontend|backend}:latest`

### Sur une Pull Request :

Même processus, mais **l'image n'est PAS poussée** (`push: false`). Le build sert uniquement à vérifier que le Dockerfile fonctionne.

---

## 💡 Avantages de cette configuration

### Sécurité
- ✅ Utilisateurs non-root dans les conteneurs
- ✅ Images minimales (moins de surface d'attaque)
- ✅ Pas de secrets dans les images

### Performance
- ✅ Cache Docker via GitHub Actions
- ✅ Builds multi-stage (images plus petites)
- ✅ Déclenchement conditionnel (seulement si fichiers pertinents modifiés)

### Maintenabilité
- ✅ Tags automatiques et cohérents
- ✅ Builds reproductibles
- ✅ Documentation claire

---

## 🎯 Utilisation des images

Une fois les images publiées, vous pouvez les utiliser :

```bash
# Pull l'image
docker pull ghcr.io/owner/repo/naval-battle-frontend:latest

# Ou dans docker-compose.yaml
services:
  frontend:
    image: ghcr.io/owner/repo/naval-battle-frontend:latest
```

**Note** : Pour pull depuis un autre environnement, vous devez vous authentifier :
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u username --password-stdin
```

