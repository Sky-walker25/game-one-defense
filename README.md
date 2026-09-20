# BASTION — Game One Defense

Jeu de défense tactique solo en français, conçu pour le navigateur. Protégez le réacteur, anticipez les vagues et combinez vos défenses.

## Jouer

Le jeu est publié avec GitHub Pages par le workflow **Deploy BASTION** depuis la branche `main`.

- 6 missions dans 3 environnements, de 15 à 25 vagues.
- 6 familles de tours, 4 niveaux et 2 spécialisations finales par famille.
- 10 archétypes ennemis et 3 boss aux capacités annoncées.
- 3 difficultés, 3 pouvoirs, médailles et mode survie après la campagne.
- Construction, améliorations, revente et priorités de ciblage pendant les combats.
- Sauvegarde de la progression et point de reprise au début de chaque vague, sur le navigateur utilisé.
- Pause, vitesses ×1/×2/×3, commandes tactiles et clavier, son synthétique et réglages des effets.

Les sauvegardes sont locales : elles ne se synchronisent pas entre appareils et peuvent être supprimées par le nettoyage des données du navigateur. Si le stockage est bloqué, le jeu affiche une notification et reste jouable en mémoire.

## Développement

Node.js 20 ou supérieur. Aucune dépendance de production ni installation de paquet nécessaire.

```sh
npm run dev       # http://localhost:4173
npm run check     # contrôle syntaxique
npm test          # règles de combat, états, sauvegardes et contenu
npm run balance   # simulations de campagne avec stratégies fixes
npm run build     # sortie statique dans dist/
```

`dist/index.html` fonctionne aussi en ouverture locale : le build produit un script classique autonome, sans requêtes de modules. GitHub Pages reçoit uniquement `dist/`.

## Commandes

| Action | Commande |
|---|---|
| Choisir une tour | `1` à `6`, ou un bouton de l’arsenal |
| Placer / sélectionner | Clic ou toucher le terrain |
| Position au clavier | Flèches puis `Entrée` |
| Lancer une vague / pause | `Espace` |
| Frappe / Stase / Surcadence | `Q` / `W` / `E` |
| Vitesse | `X` |
| Amélioration standard | `U` |
| Annuler la sélection | `Échap` ou clic droit |
| Guide | `?` |

## Architecture

- `src/data.js` : contenu, cartes, configurations, composition des vagues.
- `src/engine.js` : simulation sans DOM, ciblage, combat, effets, économie et checkpoints.
- `src/render.js` : rendu Canvas 2D, terrain mis en cache, unités et effets.
- `src/app.js` : interface, contrôles, boucle à pas fixe de 1/60 s et progression.
- `src/storage.js` : validation des sauvegardes et profil local versionné.
- `src/audio.js` : effets et ambiance via Web Audio, démarrés après interaction.
- `tests/` : tests déterministes avec le test runner intégré à Node.
- `.github/workflows/pages.yml` : tests, build et déploiement Pages.

La simulation utilise le même pas de temps à toutes les vitesses. Le changement d’onglet met le jeu en pause. Les auras de soutien utilisent le meilleur bonus, sans cumul ; les dégâts d’énergie consomment les boucliers deux fois plus vite ; la précision ignore le blindage. Les boss résistent partiellement au contrôle.

## Publication GitHub Pages

Dans les réglages du dépôt, `Settings → Pages → Build and deployment → Source`, sélectionner **GitHub Actions**. Ensuite, chaque commit sur `main` exécute les tests et publie le jeu. Le workflow peut également être déclenché manuellement. Il utilise uniquement `contents: read`, `pages: write` et `id-token: write`.

## Direction artistique

Illustration d’accueil originale produite avec l’outil intégré de génération d’images, puis enregistrée dans `assets/bastion-keyart.webp`. Brief : bastion industriel, tours de défense et réacteur cyan dans un canyon forestier, vue aérienne, lumière de fin de journée, sans texte. Les terrains et unités de jeu sont des éléments natifs du moteur Canvas ; la géométrie des routes correspond à celle de la simulation. Les sons sont synthétisés dans le navigateur. Aucun service de suivi, compte ou appel à une API externe n’est nécessaire au jeu.
