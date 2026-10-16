const { query } = require('../db');
exports.log = (actor, action, entity, entityId, oldValue, newValue) =>
  query('INSERT INTO audit_log(actor,action,entity,entity_id,old_value,new_value) VALUES ($1,$2,$3,$4,$5,$6)',
    [actor, action, entity, String(entityId ?? ''), oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]);
