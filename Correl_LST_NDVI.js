# LST-NDVI-Morocco
/**
 * Analyse des corrélations entre température de surface (LST) et indice de végétation (NDVI)
 * pour la région orientale du Maroc - Janvier 2024
 * 
 * Méthodologie:
 * 1. Définition de la zone d'étude (région orientale)
 * 2. Acquisition des données thermiques (MOD11A2) et végétatives (MOD13A2)
 * 3. Prétraitement des images (filtrage, correction et normalisation)
 * 4. Visualisation cartographique des variables biophysiques
 * 5. Échantillonnage spatial des données
 * 6. Analyse statistique des corrélations LST-NDVI
 */

// 1. DÉFINITION DE LA ZONE D'ÉTUDE
var regionOrientale = ee.FeatureCollection("projects/oubdils/assets/region_oriental");

// 2. ACQUISITION DES DONNÉES SATELLITAIRES
// 2.1 Acquisition des données thermiques MODIS LST (MOD11A2)
var modisLST = ee.ImageCollection("MODIS/061/MOD11A2")
                 .filterDate('2024-01-01', '2024-01-31')  // Période d'étude: Janvier 2024
                 .filterBounds(regionOrientale)
                 .select('LST_Day_1km');

// 2.2 Acquisition des données de végétation MODIS NDVI (MOD13A2)
var modisNDVI = ee.ImageCollection("MODIS/061/MOD13A2")
                  .filterDate('2024-01-01', '2024-01-31')  // Période d'étude: Janvier 2024
                  .filterBounds(regionOrientale)
                  .select('NDVI');

// 3. PRÉTRAITEMENT DES DONNÉES
// 3.1 Calcul des moyennes mensuelles et application des facteurs d'échelle
var lstMoyenne = modisLST.mean().multiply(0.02);  // Conversion en Kelvin (facteur d'échelle 0.02)
var ndviMoyenne = modisNDVI.mean().multiply(0.0001);  // Normalisation NDVI [-1,1] (facteur d'échelle 0.0001)

// 3.2 Délimitation à la zone d'étude
var lstRegion = lstMoyenne.clip(regionOrientale);
var ndviRegion = ndviMoyenne.clip(regionOrientale);

// 4. VISUALISATION CARTOGRAPHIQUE
// 4.1 Paramètres de visualisation pour LST
var parametresLST = {
  min: 250,      // Température minimale (K)
  max: 320,      // Température maximale (K)
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']  // Gradient froid->chaud
};

// 4.2 Paramètres de visualisation pour NDVI
var parametresNDVI = {
  min: 0,        // NDVI minimal (absence de végétation)
  max: 1,        // NDVI maximal (végétation dense)
  palette: ['brown', 'yellow', 'green']  // Gradient sol nu->végétation
};

// 4.3 Centrage de la carte et ajout des couches
Map.centerObject(regionOrientale, 7);
Map.addLayer(regionOrientale, {color: 'black'}, 'Région Orientale du Maroc');
Map.addLayer(lstRegion, parametresLST, 'Température de surface (LST)');
Map.addLayer(ndviRegion, parametresNDVI, 'Indice de végétation (NDVI)');

// 5. ÉCHANTILLONNAGE SPATIAL
// 5.1 Fusion des variables biophysiques
var imageComposite = lstRegion.addBands(ndviRegion);

// 5.2 Création d'un échantillon représentatif
var echantillonSpatial = imageComposite.sample({
  region: regionOrientale,
  scale: 1000,     // Résolution spatiale MODIS (1km)
  numPixels: 500,  // Taille de l'échantillon (limité pour éviter les erreurs de mémoire)
  geometries: true // Conservation des informations géométriques
});

// 5.3 Mise en forme des données pour l'analyse statistique
var tableauCorrelation = echantillonSpatial.map(function(point) {
  return point.set({
    LST: point.get('LST_Day_1km'),  // Température de surface
    NDVI: point.get('NDVI')         // Indice de végétation
  });
});

// 6. ANALYSE STATISTIQUE
// 6.1 Affichage des métadonnées
print('Région orientale:', regionOrientale.first());
print('Statistiques LST:', lstRegion);
print('Statistiques NDVI:', ndviRegion);
print('Échantillon LST-NDVI:', tableauCorrelation);

// 6.2 Création du diagramme de dispersion avec régression
var graphiqueCorrelation = ui.Chart.feature.byFeature(tableauCorrelation, 'LST', ['NDVI'])
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Corrélation entre température de surface et indice de végétation',
    subtitle: 'Région orientale du Maroc - Janvier 2024',
    hAxis: { 
      title: 'Température de surface (K)',
      gridlines: {color: '#CCCCCC', count: 10}
    },
    vAxis: { 
      title: 'Indice de végétation normalisé (NDVI)',
      gridlines: {color: '#CCCCCC', count: 10}
    },
    pointSize: 3,
    colors: ['#1d6b99'],
    trendlines: { 
      0: { 
        color: 'red', 
        lineWidth: 2,
        visibleInLegend: true,
        showR2: true,
        tooltip: false
      } 
    },
    legend: {position: 'top'}
  });

// 6.3 Affichage du graphique de corrélation
print(graphiqueCorrelation);

// 7. ANALYSES STATISTIQUES SUPPLÉMENTAIRES
// 7.1 Calcul des statistiques zonales pour la région
var statsLST = lstRegion.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }),
  geometry: regionOrientale.geometry(),
  scale: 1000,
  maxPixels: 1e9
});

var statsNDVI = ndviRegion.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }),
  geometry: regionOrientale.geometry(),
  scale: 1000,
  maxPixels: 1e9
});

// 7.2 Affichage des statistiques zonales
print('Statistiques LST pour la région orientale:');
print('  - LST moyenne (K):', statsLST.get('LST_Day_1km_mean'));
print('  - Écart-type LST:', statsLST.get('LST_Day_1km_stdDev'));
print('  - LST minimum (K):', statsLST.get('LST_Day_1km_min'));
print('  - LST maximum (K):', statsLST.get('LST_Day_1km_max'));

print('Statistiques NDVI pour la région orientale:');
print('  - NDVI moyen:', statsNDVI.get('NDVI_mean'));
print('  - Écart-type NDVI:', statsNDVI.get('NDVI_stdDev'));
print('  - NDVI minimum:', statsNDVI.get('NDVI_min'));
print('  - NDVI maximum:', statsNDVI.get('NDVI_max'));

// 7.3 Histogrammes de distribution
var histogrammeLST = ui.Chart.image.histogram({
  image: lstRegion,
  region: regionOrientale,
  scale: 1000,
  maxPixels: 1e9
}).setOptions({
  title: 'Distribution des températures de surface (LST)',
  hAxis: {title: 'Température (K)'},
  vAxis: {title: 'Fréquence'},
  legend: {position: 'none'},
  lineWidth: 1,
  colors: ['#FF5733']
});

var histogrammeNDVI = ui.Chart.image.histogram({
  image: ndviRegion,
  region: regionOrientale,
  scale: 1000,
  maxPixels: 1e9
}).setOptions({
  title: 'Distribution des valeurs NDVI',
  hAxis: {title: 'NDVI'},
  vAxis: {title: 'Fréquence'},
  legend: {position: 'none'},
  lineWidth: 1,
  colors: ['#33A02C']
});

// 7.4 Affichage des histogrammes
print(histogrammeLST);
print(histogrammeNDVI);

// 8. EXPORTATION DES RÉSULTATS (OPTIONNEL)
// 8.1 Exportation de l'image LST
Export.image.toDrive({
  image: lstRegion,
  description: 'LST_region_orientale_janvier_2024',
  scale: 1000,
  region: regionOrientale.geometry().bounds(),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9
});

// 8.2 Exportation de l'image NDVI
Export.image.toDrive({
  image: ndviRegion,
  description: 'NDVI_region_orientale_janvier_2024',
  scale: 1000,
  region: regionOrientale.geometry().bounds(),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9
});

// 8.3 Exportation du tableau de corrélation
Export.table.toDrive({
  collection: tableauCorrelation,
  description: 'Correlation_LST_NDVI_region_orientale_janvier_2024',
  fileFormat: 'CSV'
});
