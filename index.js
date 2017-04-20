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
.fromFile("./clientes_alertandote.csv")
.on("json", (row_client) => {
	// Recibimos cliente por cliente
	var query = {};
	var apdl = null;
	var rz = null;

	if ((row_client.apdl || "").indexOf("/")) {
		var cliente = (row_client.apdl || "").split("/");
		apdl = cliente[0] || null;
		rz = cliente[1] || null;
	} else {
		apdl = row_client.apdl || null;
	}

	var client_alerts = row_client.mac.split("\n").join("").split(", ").join(",").split(",").map((alert) => { return alert.replace(/:/g, ""); });

	var id_client = crypto.createHash("md5").update(`${(row_client.email || "")}${new Date().getTime()}`).digest("hex");

	new_clients.push({
		_id: id_client,
		rfc: null,
		contract: +row_client.contract || null,
		rz: rz,
		apdl: apdl,
		domi_fisc: {
			address: row_client.domi_fisc || "",
			country: "MX",
			state: "",
			zip: ""
		},
		contacts: [{
		    _id: crypto.createHash("md5").update(`${(row_client.phone || "")}${(row_client.email || "")}${new Date().getTime()}`).digest("hex"),
		    ide : id_client,
		    name : apdl,
		    email : row_client.email || "",
		    tel : row_client.phone || "",
		    position : ""
		}],
		date: (() => {
			var date = row_client.date.split("/");
			// console.log(`${date[1]}/${date[0]}/${date[2]}`);
			return row_client.date ? (new Date(`${date[1]}/${date[0]}/${date[2]}`).getTime() / 1000) : (new Date().getTime() / 1000)
		})(),
		alerts: client_alerts
	});
})
.on("done", (err) => {
	console.log("Guardando Clientes....");

	async.each(
		new_clients,
	(client, callback) => {
		mongo.clientes.findOne(
			{ $or: [ { apdl: { $regex: client.apdl || "" } }, { rz: { $regex: client.rz || "" } } ] },
		(err, extist_client) => {
			if (err) return callback(err);
			console.log((extist_client || {}).apdl || "")
			// callback();

			if (extist_client) {
				mongo.alertas.update(
					{ _id: { $in: client.alerts } },
					{ $set: { ide: client._id } },
					{ multi: true },
				(err, updt_clt) => {
					if (err) return callback(err);
					console.log(cl_alerts);
					callback();
				})
			} else {
				var cl_alerts = client.alerts;
				var cl_contacts = client.contacts;
				delete client.alerts;
				client.contacts = client.contacts.map((contact) => { return contact._id });

				mongo.clientes.save(
					client,
				(err, inst_client) => {
					if (err) return callback(err);

					mongo.clientes_contactos.save(
						cl_contacts[0],
					(err, inst_clients_cont) => {
						if (err) return callback(err);

						mongo.alertas.update(
							{ _id: { $in: cl_alerts } },
							{ $set: { ide: client._id } },
							{ multi: true },
						(err, cl_alerts) => {
							if (err) return callback(err);
							console.log(cl_alerts);
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
})