const { coreDb } = require('./db');

// Two txns both update the same patient_id's risk_probability.
// MODE=unsafe: no lock (read-modify-write race)
// MODE=safe:   SELECT ... FOR UPDATE before write
async function incrementRisk(patientId, mode) {
  const t = await coreDb.transaction();
  try {
    if (mode === 'safe') {
      const [rows] = await coreDb.query(
        `SELECT id, risk_probability FROM core_records WHERE patient_id = :pid ORDER BY id LIMIT 1 FOR UPDATE`,
        { replacements: { pid: patientId }, transaction: t }
      );
      if (!rows.length) { await t.rollback(); return { outcome: 'no-row' }; }
      const cur = parseFloat(rows[0].risk_probability || 0);
      await new Promise(r => setTimeout(r, 300)); // widen the race window
      await coreDb.query(
        `UPDATE core_records SET risk_probability = :v WHERE id = :id`,
        { replacements: { v: cur + 0.01, id: rows[0].id }, transaction: t }
      );
    } else {
      const [rows] = await coreDb.query(
        `SELECT id, risk_probability FROM core_records WHERE patient_id = :pid ORDER BY id LIMIT 1`,
        { replacements: { pid: patientId }, transaction: t }
      );
      if (!rows.length) { await t.rollback(); return { outcome: 'no-row' }; }
      const cur = parseFloat(rows[0].risk_probability || 0);
      await new Promise(r => setTimeout(r, 300));
      await coreDb.query(
        `UPDATE core_records SET risk_probability = :v WHERE id = :id`,
        { replacements: { v: cur + 0.01, id: rows[0].id }, transaction: t }
      );
    }
    await t.commit();
    return { outcome: 'committed' };
  } catch (e) {
    try { await t.rollback(); } catch {}
    return { outcome: 'error', error: e.message };
  }
}

// Manufacture a deadlock: two txns each lock a different patient_id then
// try to lock the other's.
// Txn A: lock patient_a -> sleep -> try lock patient_b
// Txn B: lock patient_b -> sleep -> try lock patient_a
async function deadlockDemo(idA, idB) {
  const [a] = await coreDb.query(
    `SELECT id, patient_id FROM core_records WHERE patient_id = :pid ORDER BY id LIMIT 1`,
    { replacements: { pid: idA } }
  );
  const [b] = await coreDb.query(
    `SELECT id, patient_id FROM core_records WHERE patient_id = :pid ORDER BY id LIMIT 1`,
    { replacements: { pid: idB } }
  );
  if (!a.length || !b.length) return { outcome: 'need-two-existing-patients' };

  const rowA = a[0].id, rowB = b[0].id;

  async function txn(lockFirst, lockSecond, label) {
    const t = await coreDb.transaction();
    const events = [];
    try {
      await coreDb.query(`SELECT * FROM core_records WHERE id = :id FOR UPDATE`, { replacements: { id: lockFirst }, transaction: t });
      events.push(`${label}: locked ${lockFirst}`);
      await new Promise(r => setTimeout(r, 500));
      await coreDb.query(`SELECT * FROM core_records WHERE id = :id FOR UPDATE`, { replacements: { id: lockSecond }, transaction: t });
      events.push(`${label}: locked ${lockSecond}`);
      await t.commit();
      return { label, outcome: 'committed', events };
    } catch (e) {
      try { await t.rollback(); } catch {}
      return { label, outcome: 'aborted', error: e.message, events };
    }
  }

  const [ra, rb] = await Promise.all([
    txn(rowA, rowB, 'A'),
    txn(rowB, rowA, 'B')
  ]);
  return { rowA, rowB, results: [ra, rb] };
}

module.exports = { incrementRisk, deadlockDemo };
