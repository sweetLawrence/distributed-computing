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
  status: { type: Sequelize.STRING, defaultValue: 'PENDING' },
  txn_id: { type: Sequelize.STRING, allowNull: false }
}, { tableName: 'core_records', indexes: [{ fields: ['patient_id'] }, { fields: ['txn_id'] }] });

const CloudSummary = cloudDb.define('CloudSummary', {
  txn_id: { type: Sequelize.STRING, allowNull: false },
  patient_id: { type: Sequelize.INTEGER, allowNull: false },
  risk_probability: Sequelize.FLOAT,
  status: { type: Sequelize.STRING, defaultValue: 'PENDING' },
  batch_id: Sequelize.STRING
}, { tableName: 'cloud_summaries', indexes: [{ fields: ['patient_id'] }, { fields: ['txn_id'] }] });

async function retry(fn, label, maxAttempts = 60, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      console.log(`[core] ${label} attempt ${i}/${maxAttempts} failed: ${e.message}`);
      if (i === maxAttempts) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function init() {
  await retry(() => coreDb.authenticate(), 'core-db connect');
  await retry(() => cloudDb.authenticate(), 'cloud-db connect');
  await retry(() => CoreRecord.sync(), 'core_records sync');
  await retry(() => CloudSummary.sync(), 'cloud_summaries sync');
  console.log('[core] DBs synced');
}

module.exports = { coreDb, cloudDb, CoreRecord, CloudSummary, init };
