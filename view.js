// get list of unlocked regions from komoot internal API
var regions =kmtBoot.getProps().packages.models.map((p) => {
	if (p.attributes.region === undefined) {return 9999;}
	console.log("Region ID: %d ", p.attributes.region.id);
	return p.attributes.region.id
});
for (var i = 0; i <= 30; i++) {
   delete regions[i];}

/*for (var i = 2000; i <= 2117; i++) {
   regions.push(i);} // DE, AT, CH


for (var i = 3000; i <= 3013; i++) {
   regions.push(i);} // CZ*
for (var i = 3080; i <= 3085; i++) {
   regions.push(i);} // DK
for (var i = 3853; i <= 3876; i++) {
   regions.push(i);} // PL
for (var i = 3988; i <= 3989; i++) {
   regions.push(i);} // SL
for (var i = 4001; i <= 4047; i++) {
   regions.push(i);} // GB,IR

for (var i = 2502; i <= 2542; i++) {
   regions.push(i);} // BE,NE,LU



for (var i = 3788; i <= 3800; i++) {
   regions.push(i);} // süd IT*/
for (var i = 3376; i <= 3462; i++) {
   regions.push(i);} // FR
for (var i = 4258; i <= 4276; i++) {
   regions.push(i);} // PT
for (var i = 3122; i <= 3171; i++) {
   regions.push(i);} // ES




// regions.push(4032,2105,2106,2107,2047,2048,2049,2050,2051,2052,2053,2054,2055);  
//1000-2000 eizelregionen DE
//2000 - 2117 Deutschland Österreich u Schweiz
// 2502-2542 BE NE LUX, Norditalien, Balaren, Kanaren
//4001 - 4047 GB und IR
//3000-3500 CZ ES DK FR - mit einzelregion
// 3000-3013 fast ganz CZ
// 3080-3085 DK
// 3122-3171 ES
// 3378-3446 FR
// 3788 - 3800 süd IT
//3853 - 3876 PL
// 3988,3989 SL
// 4258 - 4276 PT

function loadScripts(srcs, callback={}){
	if(srcs.length == 0){
		callback();
		return;
	}
	let script = document.createElement('script');
	script.src = srcs.shift();
	document.getElementsByTagName('head')[0].appendChild(script);
	script.onload = () => {loadScripts(srcs, callback)};
}

// Load Maplibre style
let style = document.createElement('link');
style.rel = "stylesheet";
style.href = "https://unpkg.com/maplibre-gl/dist/maplibre-gl.css";
document.getElementsByTagName('head')[0].appendChild(style);

// load scripts: Maplibre
loadScripts(["https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"], () => {
	let mapelem = document.createElement('div');
	mapelem.id = 'mapid';
	mapelem.style.height = document.getElementsByClassName("c-inline-map__container")[0].getBoundingClientRect().height + "px"
	document.getElementsByClassName("c-inline-map__container")[0].parentNode.parentNode.appendChild(mapelem);

	let map = new maplibregl.Map({
		container: 'mapid',
		style: 'https://tiles-api.maps.komoot.net/v1/style.json?optimize=true',
		attributionControl: false,
	});

	// Colors as used by komoot for region bundle (red) and single region (blue)
	let regionColor = [ "case", [ "boolean", [ "get", "region" ] ], [ "rgba", 16, 134, 232, 1 ], [ "rgba", 245, 82, 94, 1 ] ];

	map.once("load", () => {
		for(let key in map.style?.sourceCaches){ // Remove komoot's wrong osm attribution
			if(map.style.sourceCaches[key]?._source?.attribution){
				map.style.sourceCaches[key]._source.attribution = "";
			}
		}

		map.addControl(new maplibregl.AttributionControl({
			customAttribution: ['<a href="https://github.com/maplibre/maplibre-gl-js">Maplibre</a>',
				'&copy; <a href="https://www.komoot.com/">komoot</a>',
				'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors']
		}))
		map.addControl(new maplibregl.NavigationControl());
		map.addControl(new maplibregl.GeolocateControl());

		map.setLayoutProperty("komoot-region", 'visibility', 'visible'); // Enable the region layer
		map.addLayer({
			id: 'custom-region-text',
			source: 'komoot_region',
			type: 'symbol',
			minzoom: 6,
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Bold'],
			},
			paint: {
				'text-color': regionColor,
			}
		});
		map.addLayer({
			id: 'custom-region-polygon',
			source: 'komoot_region',
			type: 'fill',
			paint: {
				'fill-color': regionColor,
				'fill-opacity': 0.3,
			}
		},"custom-region-text"); // Draw polygons *under* text layer

		// Prepare for initial zoom
		let allbounds = new maplibregl.LngLatBounds();

		// iterate over unlocked regions and draw the result
		regions.forEach(async (id) => {
			if (id == 9999) {return}

			// load regions and add them as geojson features
			fetch("?region="+id, {headers: {'onlyprops': 'true'}})
				.then(res => res.json())
				.then(json => {
					let counter = 0;
					json.regions[0].geometry.forEach(p => {
						counter++;
						let region = [];
						p.forEach((i) => {
							region.push([i.lng, i.lat]);
							allbounds.extend([i.lng, i.lat]);
						});

						map.getSource('komoot_region').updateData({
							add: [{
								type: "Feature",
								id: id+"p"+counter,
								geometry: {
									type: "Polygon",
									coordinates: [region],
								},
								properties: {
									region: json.regions[0].groupId==1,
									name:  json.regions[0].name,//id
								},
							}]
						});
					});
					map.fitBounds(allbounds, {padding: 20}); // Zoom in
				});
		});
	});

	map.on('click', 'custom-region-polygon', (e) => {
		const coordinates = e.features[0].geometry.coordinates[0];
		const bounds = coordinates.reduce((bounds, coord) => {
			return bounds.extend(coord);
		}, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

		map.fitBounds(bounds, {
			padding: 20
		});
	});

	// Change the cursor to a pointer when the mouse is over the region layer.
	map.on('mouseenter', 'custom-region-polygon', () => { map.getCanvas().style.cursor = 'pointer'; });
	map.on('mouseleave', 'custom-region-polygon', () => { map.getCanvas().style.cursor = ''; });

});


availableRegions = kmtBoot.getProps().freeProducts.length;
if(availableRegions>0){
	let elem = document.createElement('span');
	elem.innerHTML = "You have <b>"+availableRegions+"</b> free region"+(availableRegions!=1?"s":"")+" available!";
	document.getElementsByClassName("c-inline-map__container")[0].parentNode.parentNode.parentNode.appendChild(elem);
}

console.log("You have %d free region(s) available!", kmtBoot.getProps().freeProducts.length);
