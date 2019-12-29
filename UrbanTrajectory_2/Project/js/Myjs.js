//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });


var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen !",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"
//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data,cb){
	var self = this;
	var request,_resp;
	importScripts("js/rtree.js");
	if(!self.rt){
		self.rt=RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp=JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function (e) {
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds=layer.getBounds();
		rt.data([[bounds.getSouthWest().lng,bounds.getSouthWest().lat],[bounds.getNorthEast().lng,bounds.getNorthEast().lat]]).
		then(function(d){var result = d.map(function(a) {return a.properties;});
		console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		DrawRS(result);
		WordCloud(result);
		SankeyDiagram(result);
		ScatterMatrix(result);
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j=0; j<trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();			  
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length-1; y=y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}
// Function for word cloud
function WordCloud(trips){
	const rs={}
	trips.forEach(trip=>{
		trip.streetnames.forEach(st=>{
			!(st in rs)?rs[st]={street:st,value:1}:rs[st].value+=1;
		})
	})

	const sizeScale = d3.scaleLinear().domain(d3.extent(Object.values(rs),x=>x.value)).range([1,50])

	var layout = d3.layout.cloud()
		.size([125, 125])
		.words(Object.values(rs))
		.padding(5)
		.rotate(function() { return Math.floor(Math.random() * 2) * 90; })
		.font("Impact")
		.fontSize(function(d) { return sizeScale(d.value); })
		.on("end", draw);

	layout.start();

	function draw(words) {
	  d3.select("#rightside").append("svg")
		  .attr("width", 500)
		  .attr("height", 150)
		  .attr('viewBox',`0 0 ${layout.size()[0]} ${layout.size()[1]}`)
		.append("g")
		  .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")")
		.selectAll("text")
		  .data(words)
		.enter().append("text")
		  .style("font-size", function(d) { return sizeScale(d.value) + "px"; })
		  .style("fill", function(d) { return d3.schemeDark2[Math.floor(sizeScale(d.value)/10)]; })
		  .style('opacity',.8)
		  .style("font-family", "Impact")
		  .attr("text-anchor", "middle")
		  .attr("transform", function(d) {
			return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
		  })
		  .text(function(d) { return d.street; });
	}
}

// Function for Sankey Diagram
 function SankeyDiagram(trips){
	const seObj={}
	const stSet = new Set();
	trips.forEach(d=>{
		const s=d.streetnames[0]
		const e=d.streetnames[d.streetnames.length-1]

		if(!(s+'+'+e in seObj)){
			seObj[s+'+'+e]=1
		}else{
			seObj[s+'+'+e]+=1
		}
		stSet.add(s)
		stSet.add(e)
	})

	const graph={'nodes':[],'links':[]};
	// const stArr=Array.from(stSet)
	const setInd=new Set();
	
	Object.keys(seObj).forEach(d=>{
		if(seObj[d]>1){
			const [s,e]=d.split('+');
			if(s!=e){
				graph.links.push({'source':s,'target':e,'value':seObj[d]})
				setInd.add(s)
				setInd.add(e)
			}	
		}
	})

	const stArr=Array.from(setInd)
	stArr.forEach((s,i)=>{
		graph.nodes.push({'node':i,'name':s})
	})

	graph.links.forEach(d=>{
		d.source=stArr.indexOf(d.source);
		d.target=stArr.indexOf(d.target);
	})
		
	var units = "Widgets";
		// set the dimensions and margins of the graph
	var margin = {top: 10, right: 10, bottom: 10, left: 10},
	width = 455 - margin.left - margin.right,
	height = 300 - margin.top - margin.bottom;

	// format variables
	var formatNumber = d3.format(",.0f"),    // zero decimal places
	format = function(d) { return formatNumber(d) + " " + units; },
	color = d3.scaleOrdinal(d3.schemeCategory10);

	// append the svg object to the body of the page
	var svg = d3.select("#rightside").append("svg")
	.attr("width", 450)
	.attr("height", 300)
	.append("g")
	.attr("transform", 
		"translate(" + margin.left + "," + margin.top + ")");

	// Set the sankey diagram properties
	var sankey = d3.sankey()
	.nodeWidth(36)
	.nodePadding(40)
	.size([width, height]);

	var path = sankey.link();
	
	sankey
		.nodes(graph.nodes)
		.links(graph.links)
		.layout(32);

	// add in the links
		var link = svg.append("g").selectAll(".link")
			.data(graph.links)
		.enter().append("path")
			.attr("class", "link")
			.attr("d", path)
			.style("stroke-width", function(d) { return Math.max(1, d.dy); })
			.sort(function(a, b) { return b.dy - a.dy; });
	
	// add the link titles
		link.append("title")
			.text(function(d) {
				return d.source.name + " → " + 
					d.target.name + "\n" + format(d.value); });
	
	// add in the nodes
		var node = svg.append("g").selectAll(".node")
			.data(graph.nodes)
		.enter().append("g")
			.attr("class", "node")
			.attr("transform", function(d) { 
				return "translate(" + d.x + "," + d.y + ")"; })
			.call(d3.drag()
			.subject(function(d) {
				return d;
			})
			.on("start", function() {
				this.parentNode.appendChild(this);
			})
			.on("drag", dragmove));
	
	// add the rectangles for the nodes
		node.append("rect")
			.attr("height", function(d) { return d.dy; })
			.attr("width", sankey.nodeWidth())
			.style("fill", function(d) { 
				return d.color = color(d.name.replace(/ .*/, "")); })
			.style("stroke", function(d) { 
				return d3.rgb(d.color).darker(2); })
		.append("title")
			.text(function(d) { 
				return d.name + "\n" + format(d.value); });
	
	// add in the title for the nodes
		node.append("text")
			.attr("x", -6)
			.attr("y", function(d) { return d.dy / 2; })
			.attr("dy", ".35em")
			.attr("text-anchor", "end")
			.attr("transform", null)
			.text(function(d) { return d.name; })
		.filter(function(d) { return d.x < width / 2; })
			.attr("x", 6 + sankey.nodeWidth())
			.attr("text-anchor", "start");
	
	// the function for moving the nodes
		function dragmove(d) {
		d3.select(this)
			.attr("transform", 
				"translate(" 
					+ d.x + "," 
					+ (d.y = Math.max(
						0, Math.min(height - d.dy, d3.event.y))
					) + ")");
		sankey.relayout();
		link.attr("d", path);
		}
}

// Function for Scatter Matrix
function ScatterMatrix(data){

	padding =15;
	width =250;
	columns = ["avspeed", "distance", "duration"];
	
	size = (width - (columns.length + 1) * padding) / columns.length + padding
	
	x = columns.map(c => d3.scaleLinear()
    	.domain(d3.extent(data, d => d[c]))
		.rangeRound([padding / 2, size - padding / 2]))
		
	y = x.map(x => x.copy().range([size - padding / 2, padding / 2]))

	z = d3.scaleOrdinal()
    .domain(data.map(d => d.tripid))
	.range(d3.schemeCategory10)
			 
	xAxis =function() {
		const axis = d3.axisBottom()
			.ticks(6)
			.tickSize(size * columns.length);
		return g => g.selectAll("g").data(x).join("g")
			.attr("transform", (d, i) => `translate(${i * size},0)`)
			.each(function(d) { return d3.select(this).call(axis.scale(d)); })
			.call(g => g.select(".domain").remove())
			.call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));
	  }
		
	yAxis =function() {
		const axis = d3.axisLeft()
			.ticks(6)
			.tickSize(-size * columns.length);
		return g => g.selectAll("g").data(y).join("g")
			.attr("transform", (d, i) => `translate(0,${i * size})`)
			.each(function(d) { return d3.select(this).call(axis.scale(d)); })
			.call(g => g.select(".domain").remove())
			.call(g => g.selectAll(".tick line").attr("stroke", "#ddd"));
	  }
	
	const svg = d3.select("#rightside").append("svg")
	
		.attr("viewBox", `${-padding} 0 ${width} ${width}`)
		.style("max-width", "auto%")
		.style("height", "33%");

	svg.append("g")
		.call(xAxis);
	
	svg.append("g")
		.call(yAxis);
	
	const cell = svg.append("g")
		.selectAll("g")
		.data(d3.cross(d3.range(columns.length), d3.range(columns.length)))
		.join("g")
		.attr("transform", ([i, j]) => `translate(${i * size},${j * size})`);
	
	cell.append("rect")
		.attr("fill", "none")
		.attr("stroke", "#aaa")
		.attr("x", padding / 2 + 0.5)
		.attr("y", padding / 2 + 0.5)
		.attr("width", size - padding)
		.attr("height", size - padding);
	
	cell.each(function([i, j]) {
		d3.select(this).selectAll("circle")
		.data(data)
		.join("circle")
			.attr("cx", d => x[i](d[columns[i]]))
			.attr("cy", d => y[j](d[columns[j]]));
	});
	
	const circle = cell.selectAll("circle")
		.attr("r", 3.5)
		.attr("fill-opacity", 0.7)
		.attr("fill", d => z(d.tripid));

	cell.call(brush, circle);
	
	svg.append("g")
		.style("font", "bold 10px sans-serif")
		.selectAll("text")
		.data(columns)
		.join("text")
		.attr("transform", (d, i) => `translate(${i * size},${i * size})`)
		.attr("x", padding)
		.attr("y", padding)
		.attr("dy", ".71em")
		.text(d => d);	

	
	function brush(cell, circle) {
		const brush = d3.brush()
			.extent([[padding / 2, padding / 2], [size - padding / 2, size - padding / 2]])
			.on("start", brushstarted)
			.on("brush", brushed)
			.on("end", brushended);
		  
			cell.call(brush);
		  
			let brushCell;
		  
			// Clear the previously-active brush, if any.
		function brushstarted() {
		  console.log("brushstarted", brushCell === this);
		  if (brushCell !== this) {
			d3.select(brushCell).call(brush.move, null);
			brushCell = this;
		  }
		}
		  
			// Highlight the selected circles.
		function brushed([i, j]) {
		  if (d3.event.selection === null) return;
		  const [[x0, y0], [x1, y1]] = d3.event.selection; 
		  circle.classed("hidden", d => {
			return x0 > x[i](d[columns[i]])
				|| x1 < x[i](d[columns[i]])
				|| y0 > y[j](d[columns[j]])
				|| y1 < y[j](d[columns[j]]);
		  });
		}
		  
			// If the brush is empty, select all circles.
		function brushended() {
		  if (d3.event.selection !== null) return;
		  circle.classed("hidden", false);
		}
	  }
}