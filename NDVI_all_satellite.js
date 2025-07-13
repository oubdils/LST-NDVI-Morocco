// Afficher la région d'intérêt en premier
Map.addLayer(table, {}, 'Région d\'intérêt');

// Créer un panneau de contrôle pour les options
var panel = ui.Panel({
  style: {
    position: 'top-right',
    width: '300px'
  }
});

var title = ui.Label({
  value: 'Options d\'analyse NDVI',
  style: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '10px 5px'
  }
});

panel.add(title);

// Années disponibles (de 2004 à 2024)
var years = [];
for (var y = 2004; y <= 2024; y++) {
  years.push(String(y));
}

// Initialiser l'année sélectionnée
var selectedYear = '2017';
var selectedSource = 'Combiné';

// Fonction pour obtenir NDVI Sentinel-2
var getS2NDVI = function(year) {
  // Définir les dates de début et de fin (toujours du 1er janvier au 31 décembre)
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  // Vérifier si Sentinel-2 était disponible pour l'année demandée
  if (parseInt(year) < 2015) {
    print('Sentinel-2 n\'était pas disponible en ' + year + ' (lancé en 2015)');
    return {
      ndvi: null,
      count: 0,
      resolution: 10,
      source: 'Sentinel-2',
      available: false
    };
  }
  
  // Charger une collection d'images Sentinel-2 MSI
  var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                    .filterBounds(table)
                    .filterDate(startDate, endDate)
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
  
  // Fonction pour masquer les nuages et mettre à l'échelle
  var maskCloudsAndScale = function(image) {
    var scl = image.select('SCL');
    var cloudMask = scl.gte(4).and(scl.lte(7)).or(scl.eq(11));
    var opticalBands = image.select(['B.*']).updateMask(cloudMask);
    return opticalBands.divide(10000);
  };
  
  // Appliquer le masquage des nuages et la correction de l'échelle
  var processedCollection = collection.map(maskCloudsAndScale);
  
  // Vérifier si nous avons des images après filtrage
  var count = processedCollection.size();
  print('Nombre d\'images Sentinel-2 disponibles pour ' + year + ':', count);
  
  // Vérifier si des images sont disponibles
  if (count.getInfo() === 0) {
    return {
      ndvi: null,
      count: 0,
      resolution: 10,
      source: 'Sentinel-2',
      available: false
    };
  }
  
  // Calcul du NDVI Sentinel-2
  var img = processedCollection.median();
  var ndvi = img.normalizedDifference(['B8', 'B4']);
  
  return {
    ndvi: ndvi,
    count: count,
    resolution: 10,
    source: 'Sentinel-2',
    available: true
  };
};

// Fonction pour obtenir NDVI Landsat 8
var getL8NDVI = function(year) {
  // Définir les dates de début et de fin
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  // Vérifier si Landsat 8 était disponible pour l'année demandée
  if (parseInt(year) < 2013) {
    print('Landsat 8 n\'était pas disponible en ' + year + ' (lancé en 2013)');
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 8',
      available: false
    };
  }
  
  // Charger une collection d'images Landsat 8
  var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                    .filterBounds(table)
                    .filterDate(startDate, endDate)
                    .filter(ee.Filter.lt('CLOUD_COVER', 20));
  
  // Fonction pour masquer les nuages et mettre à l'échelle
  var maskCloudsAndScale = function(image) {
    // Utiliser QA_PIXEL pour masquer les nuages
    var qa = image.select('QA_PIXEL');
    var cloudMask = qa.bitwiseAnd(1 << 3).eq(0);  // bit 3 = cloud
    
    // Correction de l'échelle pour Landsat 8 Surface Reflectance
    var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
    return opticalBands.updateMask(cloudMask);
  };
  
  // Appliquer le masquage des nuages et la correction de l'échelle
  var processedCollection = collection.map(maskCloudsAndScale);
  
  // Vérifier si nous avons des images après filtrage
  var count = processedCollection.size();
  print('Nombre d\'images Landsat 8 disponibles pour ' + year + ':', count);
  
  // Vérifier si des images sont disponibles
  if (count.getInfo() === 0) {
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 8',
      available: false
    };
  }
  
  // Calcul du NDVI Landsat 8 (B5=NIR, B4=RED)
  var img = processedCollection.median();
  var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']);
  
  return {
    ndvi: ndvi,
    count: count,
    resolution: 30,
    source: 'Landsat 8',
    available: true
  };
};

// Fonction pour obtenir NDVI Landsat 7
var getL7NDVI = function(year) {
  // Définir les dates de début et de fin
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  // Vérifier si Landsat 7 était disponible pour l'année demandée (opérationnel de 1999 à 2022)
  if (parseInt(year) > 2022) {
    print('Landsat 7 n\'était plus opérationnel en ' + year + ' (fin de mission en 2022)');
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 7',
      available: false
    };
  }
  
  // Charger une collection d'images Landsat 7
  var collection = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
                    .filterBounds(table)
                    .filterDate(startDate, endDate)
                    .filter(ee.Filter.lt('CLOUD_COVER', 20));
  
  // Fonction pour masquer les nuages et mettre à l'échelle
  var maskCloudsAndScale = function(image) {
    // Utiliser QA_PIXEL pour masquer les nuages
    var qa = image.select('QA_PIXEL');
    var cloudMask = qa.bitwiseAnd(1 << 3).eq(0);  // bit 3 = cloud
    
    // Correction de l'échelle pour Landsat 7 Surface Reflectance
    var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
    return opticalBands.updateMask(cloudMask);
  };
  
  // Appliquer le masquage des nuages et la correction de l'échelle
  var processedCollection = collection.map(maskCloudsAndScale);
  
  // Vérifier si nous avons des images après filtrage
  var count = processedCollection.size();
  print('Nombre d\'images Landsat 7 disponibles pour ' + year + ':', count);
  
  // Vérifier si des images sont disponibles
  if (count.getInfo() === 0) {
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 7',
      available: false
    };
  }
  
  // Calcul du NDVI Landsat 7 (B4=NIR, B3=RED)
  var img = processedCollection.median();
  var ndvi = img.normalizedDifference(['SR_B4', 'SR_B3']);
  
  return {
    ndvi: ndvi,
    count: count,
    resolution: 30,
    source: 'Landsat 7',
    available: true
  };
};

// Fonction pour obtenir NDVI Landsat 5
var getL5NDVI = function(year) {
  // Définir les dates de début et de fin
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  // Vérifier si Landsat 5 était disponible pour l'année demandée (opérationnel de 1984 à 2013)
  if (parseInt(year) > 2013) {
    print('Landsat 5 n\'était plus opérationnel en ' + year + ' (fin de mission en 2013)');
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 5',
      available: false
    };
  }
  
  // Charger une collection d'images Landsat 5
  var collection = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
                    .filterBounds(table)
                    .filterDate(startDate, endDate)
                    .filter(ee.Filter.lt('CLOUD_COVER', 20));
  
  // Fonction pour masquer les nuages et mettre à l'échelle
  var maskCloudsAndScale = function(image) {
    // Utiliser QA_PIXEL pour masquer les nuages
    var qa = image.select('QA_PIXEL');
    var cloudMask = qa.bitwiseAnd(1 << 3).eq(0);  // bit 3 = cloud
    
    // Correction de l'échelle pour Landsat 5 Surface Reflectance
    var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
    return opticalBands.updateMask(cloudMask);
  };
  
  // Appliquer le masquage des nuages et la correction de l'échelle
  var processedCollection = collection.map(maskCloudsAndScale);
  
  // Vérifier si nous avons des images après filtrage
  var count = processedCollection.size();
  print('Nombre d\'images Landsat 5 disponibles pour ' + year + ':', count);
  
  // Vérifier si des images sont disponibles
  if (count.getInfo() === 0) {
    return {
      ndvi: null,
      count: 0,
      resolution: 30,
      source: 'Landsat 5',
      available: false
    };
  }
  
  // Calcul du NDVI Landsat 5 (B4=NIR, B3=RED)
  var img = processedCollection.median();
  var ndvi = img.normalizedDifference(['SR_B4', 'SR_B3']);
  
  return {
    ndvi: ndvi,
    count: count,
    resolution: 30,
    source: 'Landsat 5',
    available: true
  };
};

// Fonction pour créer une mosaïque combinée de différents satellites
var getCombinedNDVI = function(year) {
  print('Génération du NDVI combiné pour ' + year);
  
  // Choix des satellites à utiliser selon l'année
  var satelliteOptions = [];
  
  if (parseInt(year) >= 2015) {
    // 2015-présent: S2, L8, L7 (jusqu'à 2022)
    satelliteOptions = ['S2', 'L8', 'L7'];
  } else if (parseInt(year) >= 2013 && parseInt(year) < 2015) {
    // 2013-2014: L8, L7, L5 (jusqu'à 2013)
    satelliteOptions = ['L8', 'L7', 'L5'];
  } else if (parseInt(year) >= 2004 && parseInt(year) < 2013) {
    // 2004-2012: L7, L5
    satelliteOptions = ['L7', 'L5'];
  } else {
    print('Année ' + year + ' hors de la plage des satellites disponibles');
    return {
      ndvi: null,
      resolution: 30,
      source: 'Aucun satellite disponible',
      available: false
    };
  }
  
  print('Satellites à utiliser pour ' + year + ':', satelliteOptions);
  
  // Obtenir les NDVI de différentes sources selon l'année
  var results = {};
  var ndviLayers = [];
  var ndviMasks = [];
  
  // Obtenir les résultats de chaque satellite
  if (satelliteOptions.includes('S2')) {
    results.s2 = getS2NDVI(year);
    if (results.s2.available) {
      ndviLayers.push({ndvi: results.s2.ndvi, priority: 1}); // S2 a la priorité la plus élevée
      ndviMasks.push(results.s2.ndvi.mask());
    }
  }
  
  if (satelliteOptions.includes('L8')) {
    results.l8 = getL8NDVI(year);
    if (results.l8.available) {
      ndviLayers.push({ndvi: results.l8.ndvi, priority: 2}); // L8 a la deuxième priorité
      ndviMasks.push(results.l8.ndvi.mask());
    }
  }
  
  if (satelliteOptions.includes('L7')) {
    results.l7 = getL7NDVI(year);
    if (results.l7.available) {
      ndviLayers.push({ndvi: results.l7.ndvi, priority: 3}); // L7 a la troisième priorité
      ndviMasks.push(results.l7.ndvi.mask());
    }
  }
  
  if (satelliteOptions.includes('L5')) {
    results.l5 = getL5NDVI(year);
    if (results.l5.available) {
      ndviLayers.push({ndvi: results.l5.ndvi, priority: 4}); // L5 a la quatrième priorité
      ndviMasks.push(results.l5.ndvi.mask());
    }
  }
  
  // Si aucun satellite n'a de données, retourner null
  if (ndviLayers.length === 0) {
    return {
      ndvi: null,
      resolution: 30,
      source: 'Aucune donnée disponible',
      available: false
    };
  }
  
  // Trier les couches par priorité
  ndviLayers.sort(function(a, b) {
    return a.priority - b.priority;
  });
  
  // Commencer avec la couche de priorité la plus élevée
  var combinedNDVI = ndviLayers[0].ndvi;
  var currentMask = combinedNDVI.mask();
  
  // Fusionner avec les couches de priorité inférieure pour les zones manquantes
  for (var i = 1; i < ndviLayers.length; i++) {
    var layerMask = currentMask.not();
    var maskedLayer = ndviLayers[i].ndvi.updateMask(layerMask);
    combinedNDVI = combinedNDVI.unmask(maskedLayer);
    currentMask = combinedNDVI.mask();
  }
  
  var sourcesUtilisees = [];
  if (results.s2 && results.s2.available) sourcesUtilisees.push('Sentinel-2');
  if (results.l8 && results.l8.available) sourcesUtilisees.push('Landsat 8');
  if (results.l7 && results.l7.available) sourcesUtilisees.push('Landsat 7');
  if (results.l5 && results.l5.available) sourcesUtilisees.push('Landsat 5');
  
  return {
    ndvi: combinedNDVI,
    resolution: 30,  // Résolution commune pour la mosaïque
    source: sourcesUtilisees.join(' + '),
    available: true
  };
};

// Palette de couleurs du rouge au vert foncé en passant par le jaune
var palette = ['FF0000', 'FF3300', 'FF6600', 'FF9900', 'FFCC00', 'FFFF00', 
               'CCFF00', '99FF00', '66FF00', '33FF00', '00FF00', '00CC00', 
               '009900', '006600', '003300'];

// Variables pour stocker les couches
var layers = {};

// Fonction pour mettre à jour la visualisation
var updateVisualization = function() {
  // Effacer les couches précédentes
  for (var key in layers) {
    if (layers.hasOwnProperty(key)) {
      Map.layers().remove(layers[key]);
    }
  }
  layers = {};
  
  // Réinitialiser la console
  print('Analyse NDVI pour l\'année ' + selectedYear);
  
  var result;
  
  // Obtenir les données NDVI selon la source sélectionnée
  if (selectedSource === 'Sentinel-2') {
    result = getS2NDVI(selectedYear);
  } else if (selectedSource === 'Landsat 8') {
    result = getL8NDVI(selectedYear);
  } else if (selectedSource === 'Landsat 7') {
    result = getL7NDVI(selectedYear);
  } else if (selectedSource === 'Landsat 5') {
    result = getL5NDVI(selectedYear);
  } else if (selectedSource === 'Combiné') {
    result = getCombinedNDVI(selectedYear);
  }
  
  // Vérifier si des données sont disponibles
  if (!result.available || result.ndvi === null) {
    print('Aucune donnée disponible pour ' + selectedSource + ' en ' + selectedYear);
    return;
  }
  
  // IMPORTANT: Clipper le NDVI à la région d'intérêt définie par 'table'
  var ndviClipped = result.ndvi.clip(table);
  
  // Afficher uniquement le NDVI de la région d'intérêt
  layers[selectedSource] = Map.addLayer(
    ndviClipped, 
    {min: -0.2, max: 0.8, palette: palette}, 
    'NDVI ' + selectedYear + ' (' + result.source + ')'
  );
  
  // Calculer et afficher les statistiques
  var stats = ndviClipped.reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    }).combine({
      reducer2: ee.Reducer.minMax(),
      sharedInputs: true
    }),
    geometry: table.geometry(),
    scale: result.resolution,
    maxPixels: 1e9
  });
  
  print('Statistiques NDVI ' + selectedYear + ' (' + result.source + '):', stats);
  
  // Définir les paramètres d'exportation pour la région d'intérêt
  var exportParams = {
    image: ndviClipped.toFloat(),
    description: 'NDVI_' + selectedYear + '_' + result.source.replace(/ \+ /g, '_').replace(/ /g, '_'),
    scale: result.resolution,
    region: table.geometry().bounds(),
    fileFormat: 'GeoTIFF',
    maxPixels: 1e9
  };
  
  // Préparer l'export (à déclencher manuellement)
  Export.image.toDrive(exportParams);
};

// Créer un sélecteur d'année
var yearSelector = ui.Select({
  items: years,
  value: selectedYear,
  onChange: function(value) {
    selectedYear = value;
    updateVisualization();
  },
  style: {width: '100%'}
});

// Créer un sélecteur de source satellite
var sourceSelector = ui.Select({
  items: ['Sentinel-2', 'Landsat 8', 'Landsat 7', 'Landsat 5', 'Combiné'],
  value: selectedSource,
  onChange: function(value) {
    selectedSource = value;
    updateVisualization();
  },
  style: {width: '100%'}
});

panel.add(ui.Label('Sélectionner une année:'));
panel.add(yearSelector);
panel.add(ui.Label('Sélectionner une source de données:'));
panel.add(sourceSelector);

// Ajouter un bouton pour actualiser la visualisation
var updateButton = ui.Button({
  label: 'Actualiser la visualisation',
  onClick: updateVisualization,
  style: {margin: '10px 0'}
});

panel.add(updateButton);

// Ajouter des informations sur les satellites disponibles
var infoPanel = ui.Label({
  value: 'Satellites disponibles selon l\'année:\n' +
         '2004-2012: Landsat 5, Landsat 7\n' +
         '2013-2014: Landsat 5 (2013), Landsat 7, Landsat 8\n' +
         '2015-2022: Sentinel-2, Landsat 7, Landsat 8\n' +
         '2023-2024: Sentinel-2, Landsat 8',
  style: {
    fontSize: '12px',
    margin: '10px 0',
    whiteSpace: 'pre'
  }
});

panel.add(infoPanel);

// Ajouter le panneau à la carte
Map.add(panel);

// Ajouter une légende
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

var legendTitle = ui.Label({
  value: 'Légende NDVI',
  style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0'
  }
});

legend.add(legendTitle);

var makeRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });
  
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });
  
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

legend.add(makeRow('#FF0000', 'Faible NDVI (-0.2)'));
legend.add(makeRow('#FFFF00', 'NDVI moyen (0.3)'));
legend.add(makeRow('#003300', 'NDVI élevé (0.8)'));

Map.add(legend);

// Centrer la carte sur la région d'intérêt
Map.centerObject(table, 10);

// Initialiser la visualisation
updateVisualization();
