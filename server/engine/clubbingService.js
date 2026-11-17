/**
 * PR Clubbing Service
 * Implements Policy Section 2: Clubbing into Requirements
 */

function parseDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

function daysDiff(d1, d2) {
  const t1 = parseDate(d1).getTime();
  const t2 = parseDate(d2).getTime();
  return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
}

/**
 * Club an array of requisition lines into aggregated Requirements
 * @param {Array} prLines - array of line objects
 * @param {Object} policyClauses - policy thresholds (creation window, need-by window)
 */
function clubPRLines(prLines, policyClauses = {}) {
  const creationWindowDays = policyClauses.clubbing_window_days_creation ?? 14;
  const needByWindowDays = policyClauses.clubbing_window_days_need_by ?? 7;

  const requirements = [];
  let reqCounter = 1;

  // Separate new items from standard items
  const standardGroups = {}; // key: `${item_code}__${plant}`

  for (const line of prLines) {
    if (line.is_new) {
      // New items are never clubbed (Clause 1.2)
      const reqId = `REQ-${String(reqCounter++).padStart(4, '0')}`;
      requirements.push({
        req_id: reqId,
        item_code: line.item_code || 'NEW_ITEM',
        item_name: line.item_name || line.raw_description || 'New Item',
        plant: line.plant || 'CHK1',
        total_quantity: Number(line.quantity) || 1,
        need_by_date: parseDate(line.need_by_date),
        earliest_creation_date: parseDate(line.creation_date),
        is_emergency: (line.urgency || '').toLowerCase() === 'emergency',
        is_capex: Boolean(line.is_capex),
        is_new_item: true,
        estimated_unit_price: Number(line.estimated_unit_price) || 0,
        lines: [line]
      });
      continue;
    }

    const groupKey = `${line.item_code}__${line.plant}`;
    if (!standardGroups[groupKey]) {
      standardGroups[groupKey] = [];
    }
    standardGroups[groupKey].push(line);
  }

  // Club standard items
  for (const [key, lines] of Object.entries(standardGroups)) {
    // Sort lines by creation_date ascending
    lines.sort((a, b) => parseDate(a.creation_date) - parseDate(b.creation_date));

    let currentCluster = null;

    for (const line of lines) {
      const lineCreate = parseDate(line.creation_date);
      const lineNeed = parseDate(line.need_by_date);

      if (!currentCluster) {
        currentCluster = {
          earliest_creation: lineCreate,
          min_need: lineNeed,
          max_need: lineNeed,
          lines: [line]
        };
        continue;
      }

      // Check creation date window from cluster start (<= 14 days)
      const cDiff = (lineCreate.getTime() - currentCluster.earliest_creation.getTime()) / (1000 * 60 * 60 * 24);

      // Check need-by span if this line were added (<= 7 days)
      const potentialMinNeed = new Date(Math.min(currentCluster.min_need.getTime(), lineNeed.getTime()));
      const potentialMaxNeed = new Date(Math.max(currentCluster.max_need.getTime(), lineNeed.getTime()));
      const nSpan = (potentialMaxNeed.getTime() - potentialMinNeed.getTime()) / (1000 * 60 * 60 * 24);

      if (cDiff <= creationWindowDays && nSpan <= needByWindowDays) {
        // Fits in cluster
        currentCluster.lines.push(line);
        currentCluster.min_need = potentialMinNeed;
        currentCluster.max_need = potentialMaxNeed;
      } else {
        // Finalize previous cluster
        finalizeCluster(currentCluster);
        // Start new cluster
        currentCluster = {
          earliest_creation: lineCreate,
          min_need: lineNeed,
          max_need: lineNeed,
          lines: [line]
        };
      }
    }

    if (currentCluster) {
      finalizeCluster(currentCluster);
    }
  }

  function finalizeCluster(cluster) {
    const firstLine = cluster.lines[0];
    const totalQty = cluster.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    const hasEmergency = cluster.lines.some(l => (l.urgency || '').toLowerCase() === 'emergency');
    const hasCapex = cluster.lines.some(l => Boolean(l.is_capex));
    const earliestNeed = new Date(Math.min(...cluster.lines.map(l => parseDate(l.need_by_date).getTime())));

    const reqId = `REQ-${String(reqCounter++).padStart(4, '0')}`;
    requirements.push({
      req_id: reqId,
      item_code: firstLine.item_code,
      item_name: firstLine.item_name,
      plant: firstLine.plant,
      total_quantity: totalQty,
      need_by_date: earliestNeed,
      earliest_creation_date: cluster.earliest_creation,
      is_emergency: hasEmergency,
      is_capex: hasCapex,
      is_new_item: false,
      estimated_unit_price: Number(firstLine.estimated_unit_price) || 0,
      lines: cluster.lines
    });
  }

  return requirements;
}

module.exports = {
  clubPRLines,
  daysDiff
};

