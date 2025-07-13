// 1. Définir la zone d'étude
var regionOrientale = ee.FeatureCollection("projects/oubdils/assets/zone_jerda");

// 2. Chargement des données MODIS LST (°C) et NDVI sur 2004–2024
var modisLST = ee.ImageCollection("MODIS/061/MOD11A2")
  .filterDate('2004-01-01', '2024-01-31')
  .filterBounds(regionOrientale)
  .select('LST_Day_1km');

var modisNDVI = ee.ImageCollection("MODIS/061/MOD13A2")
  .filterDate('2004-01-01', '2024-01-31')
  .filterBounds(regionOrientale)
  .select('NDVI');

// 3. Prétraitement : moyenne et conversion
var lstCelsius = modisLST.mean().multiply(0.02).subtract(273.15).rename("LST_C");
var ndvi = modisNDVI.mean().multiply(0.0001).rename("NDVI");

// 4. Clip aux limites
var lstRegion = lstCelsius.clip(regionOrientale);
var ndviRegion = ndvi.clip(regionOrientale);

// 5. Visualisation
Map.centerObject(regionOrientale, 7);
Map.addLayer(regionOrientale, {color: 'black'}, 'Région Orientale');
Map.addLayer(lstRegion, {
  min: -10, max: 45,
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
}, 'LST (°C)');
Map.addLayer(ndviRegion, {
  min: 0, max: 1,
  palette: ['brown', 'yellow', 'green']
}, 'NDVI');

// 6. Échantillonnage
var imageComposite = lstRegion.addBands(ndviRegion);
var echantillon = imageComposite.sample({
  region: regionOrientale,
  scale: 1000,
  numPixels: 500,
  geometries: true
});

// 7. Graphique de corrélation NDVI vs LST
var chart = ui.Chart.feature.byFeature(echantillon, 'LST_C', ['NDVI'])
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Corrélation LST (°C) - NDVI (2004–2024)',
    hAxis: {title: 'LST (°C)'},
    vAxis: {title: 'NDVI'},
    pointSize: 3,
    colors: ['#1d6b99'],
    trendlines: {
      0: { color: 'red', lineWidth: 2, visibleInLegend: true, showR2: true }
    }
  });
print(chart);

// 8. Statistiques zonales
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

print('--- Statistiques LST (°C) ---');
print('Moyenne :', statsLST.get('LST_C_mean'));
print('Écart-type :', statsLST.get('LST_C_stdDev'));
print('Min :', statsLST.get('LST_C_min'));
print('Max :', statsLST.get('LST_C_max'));

print('--- Statistiques NDVI ---');
print('Moyenne :', statsNDVI.get('NDVI_mean'));
print('Écart-type :', statsNDVI.get('NDVI_stdDev'));
print('Min :', statsNDVI.get('NDVI_min'));
print('Max :', statsNDVI.get('NDVI_max'));

// 9. Histogrammes
var histoLST = ui.Chart.image.histogram({
  image: lstRegion,
  region: regionOrientale,
  scale: 1000,
  maxPixels: 1e9
}).setOptions({
  title: 'Histogramme LST (°C)',
  hAxis: {title: 'LST (°C)'},
  vAxis: {title: 'Fréquence'},
  colors: ['#e31a1c']
});
print(histoLST);

var histoNDVI = ui.Chart.image.histogram({
  image: ndviRegion,
  region: regionOrientale,
  scale: 1000,
  maxPixels: 1e9
}).setOptions({
  title: 'Histogramme NDVI',
  hAxis: {title: 'NDVI'},
  vAxis: {title: 'Fréquence'},
  colors: ['#33A02C']
});
print(histoNDVI);

// 10. Exportation
Export.image.toDrive({
  image: lstRegion,
  description: 'LST_Celsius_RegionOrientale_2004_2024',
  scale: 1000,
  region: regionOrientale.geometry(),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9
});

Export.image.toDrive({
  image: ndviRegion,
  description: 'NDVI_RegionOrientale_2004_2024',
  scale: 1000,
  region: regionOrientale.geometry(),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9
});

Export.table.toDrive({
  collection: echantillon,
  description: 'Correlation_LST_NDVI_Orientale_2004_2024',
  fileFormat: 'CSV'
});
