const { randomUUID } = require('crypto');
const { CoreRecord, CloudSummary } = require('./db');

// 2PC: prepare on both, commit if both prepared, else abort
async function twoPhaseCommit(row, riskProb) {
  const txn_id = randomUUID();
  const log = [];

  // ---- PHASE 1: PREPARE ----
  let corePrepared = false, cloudPrepared = false;

  try {
    await CoreRecord.create({
      patient_id: row.patient_id, heart_rate: row.heart_rate,
      systolic_bp: row.systolic_bp, respiratory_rate: row.respiratory_rate,
      risk_probability: riskProb, is_flagged: true,
      status: 'PENDING', txn_id
    });
    corePrepared = true;
    log.push('core-db: PREPARED');
  } catch (e) { log.push(`core-db: PREPARE FAILED (${e.message})`); }

  try {
    await CloudSummary.create({
      txn_id, patient_id: row.patient_id,
      risk_probability: riskProb, status: 'PENDING'
    });
    cloudPrepared = true;
    log.push('cloud-db: PREPARED');
  } catch (e) { log.push(`cloud-db: PREPARE FAILED (${e.message})`); }

  // ---- PHASE 2: COMMIT or ABORT ----
  if (corePrepared && cloudPrepared) {
    await CoreRecord.update({ status: 'COMMITTED' }, { where: { txn_id } });
    await CloudSummary.update({ status: 'COMMITTED', batch_id: `batch-${Date.now()}` }, { where: { txn_id } });
    log.push('BOTH COMMITTED');
    return { outcome: 'COMMIT', txn_id, log };
  } else {
    if (corePrepared) await CoreRecord.update({ status: 'ABORTED' }, { where: { txn_id } });
    if (cloudPrepared) await CloudSummary.update({ status: 'ABORTED' }, { where: { txn_id } });
    log.push('ROLLED BACK');
    return { outcome: 'ABORT', txn_id, log };
  }
}

module.exports = { twoPhaseCommit };
