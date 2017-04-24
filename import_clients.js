global.config = require("./config");

// console.log(global.config);

const mongojs = require("mongojs");
const mongo = mongojs(global.config.mongodb.uri, global.config.mongodb.collections);

const csv = require("csvtojson");
const async = require("async");
const crypto = require("crypto");

// Leemos los clientes
var new_clients = [];
csv()
.fromFile("./all_clients.csv")
.on("json", (row_client) => {
	// Recibimos cliente por cliente
	var query = {};
	var apdl = null;
	var rz = null;

	if ((row_client.apdl || "").includes("/")) {
		var cliente = (row_client.apdl || "").split("/ ");
		apdl = cliente[0] || null;
		rz = cliente[1] || null;
	} else {
		if (row_client.apdl.includes(".")) {
			rz = row_client.apdl;
		} else {
			apdl = row_client.apdl;
		}
	}

	// console.log("APDL %s , RZ %s", apdl, rz);

	var client_alerts = row_client.mac.split("\n").join("").split(", ").join(",").split(",").map((alert) => { return alert.replace(/:/g, ""); });

	var id_client = crypto.createHash("md5").update(`${client_alerts}${apdl}${rz}${(row_client.email || "")}${new Date().getTime()}`).digest("hex");

	new_clients.push({
		_id: id_client,
		rfc: null,
		contract: +row_client.contract || null,
		rz: rz,
		apdl: apdl,
		email: row_client.email || "",
		domi_fisc: {
			address: row_client.domi_fisc || "",
			country: "MX",
			state: "",
			zip: ""
		},
		contacts: [{
		    _id: crypto.createHash("md5").update(`${row_client.date}${apdl}${rz}${(row_client.phone || "")}${(row_client.email || "")}${new Date().getTime()}`).digest("hex"),
		    ide : id_client,
		    name : apdl,
		    email : row_client.email || "",
		    tel : row_client.phone || "",
		    position : ""
		}],
		date: dateStringToUnix(row_client.date),
		alerts: client_alerts
	});
})
.on("done", (err) => {
	console.log("Guardando Clientes....");
	var i = 0;
	async.eachSeries(
		new_clients,
	(client, callback) => {
		var apdl = client.apdl || /null/;
		var email = client.email || /null/;
		var rz = client.rz || /null/;

		mongo.clientes.findOne(
			{
				$or: [
					{
						apdl: { $regex: apdl, $options: "is" }
					},
					{
						rz: { $regex: rz, $options: "is" }
					},
					{
						email: { $regex: email, $options: "is" }
					}
				]
			},
		(err, extist_client) => {
			if (err) return callback(err);

			if (extist_client) {
				async.eachSeries(
					client.alerts,
				(alert, ecallback) => {
					mongo.alertas.update(
						{ _id: alert },
						{ $set: { ide: extist_client._id, stock: 3 } },
						{ multi: true },
					(err, cl_alerts) => {
						if (err) return ecallback(err);
						ecallback();
					});
				},
				(err) => {
					if (err) return callback(err);
					i++;
					console.log("%s.- %s Cliente Actualizado: (%s / %s); Alertas %s: ", i, extist_client._id, ((client || {}).apdl || "None..."), extist_client.apdl, JSON.stringify(client.alerts));
					callback();
				});
			} else {
				var cl_alerts = client.alerts;
				var cl_contacts = client.contacts;
				delete client.alerts;
				client.contacts = client.contacts.map((contact) => { return contact._id });

				mongo.clientes.insert(
					client,
				(err, inst_client) => {
					if (err) return callback(err);

					mongo.clientes_contactos.insert(
						cl_contacts[0],
					(err, inst_clients_cont) => {
						if (err) return callback(err);

						async.eachSeries(
							cl_alerts,
						(alert, ecallback) => {
							mongo.alertas.update(
								{ _id: alert },
								{ $set: { ide: client._id, stock: 3 } },
								{ multi: true },
							(err, cl_alerts) => {
								if (err) return ecallback(err);
								ecallback();
							});
						},
						(err) => {
							if (err) return callback(err);
							i++;
							console.log("%s.- %s Cliente Creado: %s; Alertas %s: ", i, client._id, ((client || {}).apdl || ""), JSON.stringify(cl_alerts));
							callback();
						});
					})
				});
			}
		});
	},
	(err) => {
		if (err) throw new Error(err);
		console.log("Clientes guardados y actualizados!");
		process.exit();
	});
});

if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
	'use strict';
	if (typeof start !== 'number') {
	  start = 0;
	}
	
	if (start + search.length > this.length) {
	  return false;
	} else {
	  return this.indexOf(search, start) !== -1;
	}
  };
};

function dateStringToUnix(datestring) {
	var date = datestring.split("/");
	return datestring ? (new Date(`${date[1]}/${date[0]}/${date[2]}`).getTime() / 1000) : (new Date().getTime() / 1000)
}