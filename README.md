# Node-RED Thermostat Dial

Un thermostat circulaire interactif de style Nest pour Node-RED Dashboard avec hystérésis et mode Away.

## Caractéristiques

- 🎯 Interface circulaire intuitive style Nest
- 🔥 Support mode chauffage et refroidissement
- 🧳 Mode Away avec offset de température configurable
- 📊 Hystérésis configurable pour éviter les oscillations
- 🍃 Indicateur d'économie d'énergie (feuille verte)
- 📱 Compatible tactile et souris
- 🎨 Animations fluides et visuels attractifs

## Installation

### Méthode 1 : Via l'interface Node-RED (recommandé)

1. Ouvrir Node-RED
2. Aller dans Menu → Manage palette → Install
3. Rechercher `node-red-contrib-thermostat-dial`
4. Cliquer sur Install

### Méthode 2 : Via npm

```bash
cd ~/.node-red
npm install node-red-contrib-thermostat-dial
```

### Méthode 3 : Installation locale (développement)

1. Copier les fichiers dans votre dossier Node-RED :
```bash
cd ~/.node-red
mkdir -p nodes
cp /chemin/vers/thermostat-dial.* nodes/
```

2. Modifier le fichier `settings.js` pour inclure le dossier nodes :
```javascript
nodesDir: './nodes'
```

3. Redémarrer Node-RED

## Utilisation

### Configuration du nœud

1. Glisser le nœud "thermostat dial" depuis la palette vers le flow
2. Double-cliquer pour configurer :
   - **Name** : Nom du thermostat
   - **Group** : Groupe UI dashboard
   - **Width / Height** : Dimensions (recommandé : 6x6)
   - **Min / Max Temp** : Plage de températures (°C)
   - **Mode** : Chauffage ou Refroidissement
   - **Hystérésis** : Seuil pour éviter les oscillations (°C)
   - **Away Offset** : Décalage en mode Away (°C)

### Format des messages

#### Message d'entrée (payload)

```javascript
{
  "ambient_temperature": 20.5,     // Température ambiante actuelle (requis)
  "target_temperature": 21.0,      // Température cible (requis)
  "mode": "heat",                   // "heat" ou "cool" (optionnel)
  "hysteresis": 0.1,                // Hystérésis en °C (optionnel)
  "awayOffset": -3,                 // Offset Away en °C (optionnel)
  "has_leaf": true,                 // Afficher l'icône feuille (optionnel)
  "away": false                     // Mode Away actif (optionnel)
}
```

#### Message de sortie (payload)

Le nœud émet un message à chaque changement utilisateur :

```javascript
{
  "ambient_temperature": 20.5,
  "target_temperature": 21.5,      // Nouvelle valeur définie par l'utilisateur
  "hvac_state": true,               // État calculé (true = actif, false = inactif)
  "mode": "heat",
  "hysteresis": 0.1,
  "awayOffset": -3,
  "has_leaf": false,
  "away": false
}
```

### Exemple de flow

```json
[
  {
    "id": "thermostat1",
    "type": "thermostat-dial",
    "name": "Thermostat Salon",
    "group": "ui_group1",
    "minTemp": 15,
    "maxTemp": 25,
    "mode": "heat",
    "hysteresis": 0.5,
    "awayOffset": -3
  },
  {
    "id": "inject1",
    "type": "inject",
    "payload": "{\"ambient_temperature\":20,\"target_temperature\":21}",
    "payloadType": "json",
    "wires": [["thermostat1"]]
  },
  {
    "id": "debug1",
    "type": "debug",
    "wires": [["thermostat1"]]
  }
]
```

## Fonctionnement

### Hystérésis

L'hystérésis empêche les cycles courts du système HVAC :

- **Mode chauffage** : 
  - Active si `température_cible > température_ambiante + hystérésis`
  - Désactive si `température_cible < température_ambiante - hystérésis`
  
- **Mode refroidissement** :
  - Active si `température_cible < température_ambiante - hystérésis`
  - Désactive si `température_cible > température_ambiante + hystérésis`

### Mode Away

Le mode Away applique un offset à la température cible pour économiser l'énergie :

- Cliquer sur l'icône 🧳 (valise) en bas du thermostat pour activer/désactiver
- La température effective devient : `température_cible + awayOffset`
- Un indicateur vert apparaît sur le cadran pour montrer la température effective
- L'offset apparaît à côté de la température centrale (ex: "-3°")

### Indicateur feuille verte

La feuille verte 🍃 s'affiche quand `has_leaf` est `true`, indiquant un mode économie d'énergie.

## Interface utilisateur

- **Centre** : Température cible (grande)
- **Cadran** : Température ambiante actuelle
- **Couleur du cercle** :
  - Gris foncé : Inactif
  - Orange : Chauffage actif
  - Orange foncé : Chauffage actif en mode Away
  - Bleu : Refroidissement actif
  - Bleu foncé : Refroidissement actif en mode Away
- **Interaction** : Glisser verticalement ou horizontalement pour ajuster la température

## Configuration avancée

### Intégration avec Home Assistant

```javascript
// Flow pour synchroniser avec Home Assistant
[
  {
    "id": "ha_climate",
    "type": "ha-entity",
    "entity_id": "climate.thermostat_salon",
    "wires": [["format_to_dial"]]
  },
  {
    "id": "format_to_dial",
    "type": "function",
    "func": "msg.payload = {\n  ambient_temperature: msg.payload.attributes.current_temperature,\n  target_temperature: msg.payload.attributes.temperature\n};\nreturn msg;",
    "wires": [["thermostat1"]]
  },
  {
    "id": "thermostat1",
    "type": "thermostat-dial",
    "wires": [["format_to_ha"]]
  },
  {
    "id": "format_to_ha",
    "type": "function",
    "func": "msg.payload = {\n  service: 'climate.set_temperature',\n  data: {\n    entity_id: 'climate.thermostat_salon',\n    temperature: msg.payload.target_temperature\n  }\n};\nreturn msg;",
    "wires": [["ha_service"]]
  }
]
```

## Dépannage

### Le thermostat ne s'affiche pas
- Vérifier que Node-RED Dashboard est installé
- Vérifier qu'un groupe UI est sélectionné
- Redémarrer Node-RED

### Les changements ne sont pas pris en compte
- Vérifier la console JavaScript (F12) pour les erreurs
- Vérifier que les messages entrants ont le bon format
- Vérifier la connexion entre les nœuds

### L'hystérésis ne fonctionne pas comme attendu
- Vérifier que la valeur d'hystérésis est adaptée (recommandé : 0.1 à 1.0°C)
- Vérifier que les températures ambiante et cible sont bien mises à jour

## Licence

MIT

## Auteur

Créé pour Node-RED Dashboard

## Contributions

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Changelog

### v1.0.0
- Version initiale
- Support hystérésis
- Mode Away
- Modes chauffage/refroidissement
- Indicateur feuille verte
- Interface tactile
