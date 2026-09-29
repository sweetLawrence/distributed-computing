const { Sequelize } = require('sequelize');

const coreDb = new Sequelize(
  process.env.CORE_DB_NAME, process.env.CORE_DB_USER, process.env.CORE_DB_PASS,
  { host: process.env.CORE_DB_HOST, port: parseInt(process.env.CORE_DB_PORT), dialect: 'postgres', logging: false }
);

const cloudDb = new Sequelize(
  process.env.CLOUD_DB_NAME, process.env.CLOUD_DB_USER, process.env.CLOUD_DB_PASS,
  { host: process.env.CLOUD_DB_HOST, port: parseInt(process.env.CLOUD_DB_PORT), dialect: 'postgres', logging: false }
);

const CoreRecord = coreDb.define('CoreRecord', {
  patient_id: { type: Sequelize.INTEGER, allowNull: false },
  heart_rate: Sequelize.INTEGER,
  systolic_bp: Sequelize.INTEGER,
  respiratory_rate: Sequelize.INTEGER,
  risk_probability: Sequelize.FLOAT,
  is_flagged: Sequelize.BOOLEAN,
  status: { type: Sequelize.STRING, defaultValue: 'PENDING' },  // PENDING | COMMITTED | ABORTED
  txn_id: { type: Sequelize.STRING, allowNull: false }
}, { tableName: 'core_records', indexes: [{ fields: ['patient_id'] }, { fields: ['txn_id'] }] });

const CloudSummary = cloudDb.define('CloudSummary', {
  txn_id: { type: Sequelize.STRING, allowNull: false },
  patient_id: { type: Sequelize.INTEGER, allowNull: false },
  risk_probability: Sequelize.FLOAT,
  status: { type: Sequelize.STRING, defaultValue: 'PENDING' },
  batch_id: Sequelize.STRING
}, { tableName: 'cloud_summaries', indexes: [{ fields: ['patient_id'] }, { fields: ['txn_id'] }] });

async function init() {
  await coreDb.authenticate();
  await cloudDb.authenticate();
  await CoreRecord.sync({ alter: true });
  await CloudSummary.sync({ alter: true });
  console.log('[core] DBs synced');
}

module.exports = { coreDb, cloudDb, CoreRecord, CloudSummary, init };
