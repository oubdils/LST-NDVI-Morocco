// === 1. Paramètres ===
var region = ROI;
var startYear = 1984;
var endYear = 2024;

// === 2. Chargement des collections Landsat ===
var landsat5 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2");
var landsat7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
var landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2");

var landsat = landsat5.merge(landsat7).merge(landsat9)
  .filterBounds(region)
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

// === 3. Ajouter NDVI ===
var addNDVI = function(image) {
  var scaled = image.select('SR_B[1-7]').multiply(0.0000275).add(-0.2);
  var imageWithScaled = image.addBands(scaled, null, true);

  var ndvi = scaled.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  return imageWithScaled.addBands(ndvi).copyProperties(image, ['system:time_start']);
};

var landsatWithNDVI = landsat.map(addNDVI);

// === 4. Liste des années ===
var years = ee.List.sequence(startYear, endYear);

// === 5. Statistiques NDVI annuelles ===
var yearlyStats = years.map(function(year) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = ee.Date.fromYMD(year, 12, 31);

  var ndviYear = landsatWithNDVI.filterDate(start, end).select('NDVI');

  var stats = ndviYear.reduce(ee.Reducer.min()
    .combine({reducer2: ee.Reducer.mean(), sharedInputs: true})
    .combine({reducer2: ee.Reducer.max(), sharedInputs: true}))
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 30,
      maxPixels: 1e13
    });

  return ee.Algorithms.If(stats.get('NDVI_min'),
    ee.Feature(null, {
      'year': year,
      'min': stats.get('NDVI_min'),
      'mean': stats.get('NDVI_mean'),
      'max': stats.get('NDVI_max')
    }),
    null
  );
});

// === 6. Créer la FeatureCollection filtrée ===
var ndviFeatures = ee.FeatureCollection(yearlyStats).filter(ee.Filter.notNull(['min']));

// === 7. Graphique NDVI annuel ===
var chart = ui.Chart.feature.byFeature({
  features: ndviFeatures,
  xProperty: 'year',
  yProperties: ['min', 'mean', 'max']
}).setChartType('LineChart').setOptions({
  title: 'NDVI Annuel (Min, mean, Max) | 1984–2024',
  hAxis: {title: 'year'},
  vAxis: {title: 'NDVI'},
  lineWidth: 2,
  pointSize: 4,
  series: {
    0: {color: 'red', lineDashStyle: [4, 4], label: 'NDVI min'},
    1: {color: 'blue', label: 'NDVI moyen'},
    2: {color: 'green', label: 'NDVI max'}
  },
  legend: {position: 'bottom'}
});
print(chart);

// === 8. Visualisation image NDVI ===
var firstImage = landsatWithNDVI.first();
Map.centerObject(region, 8);
Map.addLayer(firstImage.select('NDVI'), {min: 0, max: 1, palette: ['white', 'green']}, 'NDVI sample');
Map.addLayer(region, {color: 'red'}, 'Zone d’étude');

// === 9. NDVI médian de 2020 (exemple de carte) ===
var composite2020 = landsatWithNDVI
  .filterDate('2020-01-01', '2020-12-31')
  .median()
  .select('NDVI')
  .clip(region);

Map.addLayer(composite2020, {
  min: 0,
  max: 1,
  palette: ['red', 'orange', 'green']
}, 'NDVI 2020 (clipped)');
