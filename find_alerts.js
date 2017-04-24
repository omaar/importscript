global.config = require("./config");

// console.log(global.config);

const mongojs = require("mongojs");
const mongo = mongojs(global.config.mongodb.uri, global.config.mongodb.collections);

const csv = require("csvtojson");
const async = require("async");

// Leemos los clientes
var all_alerts = [];
csv()
.fromFile("./all_clients.csv")
.on("json", (row_client) => {
	var macs = row_client.mac.split("\n").join("").split(", ").join(",").split(",")
	.forEach((alert, index) => {
		var noseries = row_client.noserie.split("\n").join("").split(", ").join(",").split(",");
		var types = row_client.type.split("\n").join("").split(", ").join(",").split(",");

		var current_alert = {
			"_id" : alert.replace(/:/g, ""),
			"mac" : alert,
			"noserie" : noseries[index] || "",
			"active" : 1,
			"simu" : 1,
			"type" : tipoAlerta(types[index]),
			"name" : noseries[index] || "",
			"alta" : dateStringToUnix(row_client.date),
			"tz" : "America/Mexico_City",
			"garantiaini" : dateStringToUnix(row_client.date),
			"garantiafin" : addOneYeartoDate(row_client.date),
			"sptest" : 1,
			"spsimulacro" : 1,
			"spalerta" : 1,
			"stock" : 2
		};

		// console.log("MAC %s: , Serie %s", current_alert.mac, current_alert.noserie);

		all_alerts = all_alerts.concat(current_alert);
	});
})
.on("done", (err) => {
	console.log("Buscando alertas...");
	console.log("Total de alertas %s: ", all_alerts.length);
	console.log("\n");
	var repetidos = [];
	all_alerts = all_alerts.unique("_id", (objc) => {
		repetidos.push(objc);
	});
	all_alerts = all_alerts.unique("noserie", (objc) => {
		repetidos.push(objc);
	});
	all_alerts = all_alerts.unique("mac", (objc) => {
		repetidos.push(objc);
	});
	// repetidos = repetidos.unique("_id", () => {});
	console.log("Total alertas repetidas %s: %s", repetidos.length, JSON.stringify(repetidos));
	console.log("\n");
	mongo.alertas.find(
		{ 
			$or: [
				{ _id: { $in: all_alerts.map((alert) => { return alert._id }) } },
				{ mac: { $in: all_alerts.map((alert) => { return alert.mac }) } },
				{ noserie: { $in: all_alerts.map((alert) => { return alert.noserie }) } }
			]
		},
		{ _id: 1 },
	(err, find_alertas) => {
		if (err) throw new Error(err);

		var ids_match_alerts = find_alertas.map((alert) => { return alert._id; });
		var ids_unmatch_alerts = diffArray(all_alerts.map((alert) => { return alert._id }), ids_match_alerts);

		var match_alerts = all_alerts.filter((alert) => {
			return ids_match_alerts.includes(alert._id);
		});
		var unmatch_alerts = all_alerts.filter((alert) => {
			return ids_unmatch_alerts.includes(alert._id);
		});

		console.log("Total de alertas unicas %s: ", all_alerts.length);
		console.log("\n");
		console.log("Alertas encontradas %s: %s", (match_alerts.length), (match_alerts));
		console.log("\n");
		console.log("Alertas no encontradas %s: %s", (unmatch_alerts.length), (unmatch_alerts));
		console.log("\n");
		console.log("Guardando Alertas no encontradas...");

		async.eachSeries(
			unmatch_alerts,
		(alert, callback) => {
			mongo.alertas.save(
				alert,
			(err, inserted) => {
				if (err) return callback(err);
				console.log(inserted._id);
				callback();
			});
			/*console.log(JSON.stringify(alert._id));
			console.log("\n");
			callback();*/
		},
		(err) => {
			if (err) throw new Error(err);
			/*var key = "noserie";
			console.log("All unmatch_alerts: %s %s", unmatch_alerts.length, JSON.stringify(unmatch_alerts.map(e => e[key])));
			console.log("\n");
			console.log("All unmatch_alerts unique: %s %s", unmatch_alerts.unique(key, () => {}).length, JSON.stringify(unmatch_alerts.unique(key, () => {}).map(e => e[key])))*/
			process.exit();
		});
	});
});

function diffArray(prev, next) {
	return prev
		.filter(el => !next.includes(el))
		.concat(
			next.filter(el => !prev.includes(el))
		)
};

function dateStringToUnix(datestring) {
	var date = datestring.split("/");
	return datestring ? (new Date(`${date[1]}/${date[0]}/${date[2]}`).getTime() / 1000) : (new Date().getTime() / 1000)
}

function addOneYeartoDate(datestring) {
	var date = datestring.split("/");
	// console.log(`${date[1]}/${date[0]}/${(+date[2] + 1)}`);
	return datestring ? (new Date(`${date[1]}/${date[0]}/${(+date[2] + 1)}`).getTime() / 1000) : (new Date().getTime() / 1000)
}

function tipoAlerta(tipo) {
	switch (tipo) {
	case "RESIDENCIAL":
		return 1;
	case "PRO":
		return 2;
	case "INDUSTRIAL":
		return 3;
	case "INDUSTRIAL CONTACTO SECO":
		return 4;
	default:
		return 0;
	}
}

if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
	'use strict';
	var O = Object(this);
	var len = parseInt(O.length) || 0;
	if (len === 0) {
	  return false;
	}
	var n = parseInt(arguments[1]) || 0;
	var k;
	if (n >= 0) {
	  k = n;
	} else {
	  k = len + n;
	  if (k < 0) {k = 0;}
	}
	var currentElement;
	while (k < len) {
	  currentElement = O[k];
	  if (searchElement === currentElement ||
		 (searchElement !== searchElement && currentElement !== currentElement)) {
		return true;
	  }
	  k++;
	}
	return false;
  };
};

Array.prototype.unique = function(key, callback) {
	var a = this.concat();
	for(var i = 0; i < a.length; ++i) {
		for(var j = i + 1; j < a.length; ++j) {
			if(a[i][key] === a[j][key]) {
				callback(a[i]);
				a.splice(j--, 1);
			}
		}
	}
	return a;
};

// [].concat.apply([], this.xAxis.map(serie => serie)).unique()