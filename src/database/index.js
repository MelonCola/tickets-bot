const { Sequelize } = require("sequelize");
const fs = require("fs");
const { path } = require("../utils/fs");
const types = require("./dialects");

module.exports = async (client) => {
	const { DB_TYPE, JAWSDB_URL } = process.env;

	const type = (DB_TYPE || "sqlite").toLowerCase();

	const supported = Object.keys(types);
	if (!supported.includes(type)) {
		client.log.error(new Error(`DB_TYPE (${type}) is not a valid type`));
		return process.exit();
	}

	try {
		types[type].packages.forEach((pkg) => require(pkg));
	} catch {
		const required = types[type].packages.map((i) => `"${i}"`).join(" and ");
		client.log.error(new Error(`Please install the package(s) for your selected database type: ${required}`));
		return process.exit();
	}

	let sequelize;

	if (type === "sqlite") {
		client.log.info("Using SQLite storage");
		sequelize = new Sequelize({
			dialect: types[type].dialect,
			logging: (text) => client.log.debug(text),
			storage: path("./user/database.sqlite"),
		});
		client.config.defaults.log_messages = false;
		client.log.warn("Message logging is disabled due to insufficient database");
	} else {
		client.log.info(`Connecting to ${types[type].name} database...`);
		sequelize = new Sequelize(JAWSDB_URL, {
			dialect: types[type].dialect,
			logging: (text) => client.log.debug(text),
			pool: {
				max: 5,
				min: 0,
			},
		});
	}

	try {
		await sequelize.authenticate();
		client.log.success("Connected to database successfully");
	} catch (error) {
		client.log.warn("Failed to connect to database");
		client.log.error(error);
		return process.exit();
	}

	const models = fs.readdirSync(path("./src/database/models")).filter((filename) => filename.endsWith(".model.js"));

	for (const model of models) {
		require(`./models/${model}`)(client, sequelize);
	}

	await sequelize.sync({ alter: false });

	return sequelize;
};
