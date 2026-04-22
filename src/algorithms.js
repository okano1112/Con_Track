// algorithms.js
// ============================================================
// อัลกอริทึมช่วยแนะนำช่าง / งานทางเลือก
// ============================================================

// 1. หาช่างทดแทน (เมื่อช่างหลักขาดงาน)
export function findSubstituteWorkers(missingWorker, requiredWorkType, allWorkers) {
  const candidates = allWorkers.filter(worker =>
    worker.id !== missingWorker.id &&
    (worker.records || []).some(record => record.work_type === requiredWorkType)
  );

  return candidates.map(worker => {
    const relevantRecords = worker.records.filter(r => r.work_type === requiredWorkType);
    const avgOutput = relevantRecords.reduce((sum, r) => sum + (r.output || 0), 0) / relevantRecords.length;
    const avgQuality = relevantRecords.reduce((sum, r) => sum + (r.quality || 0), 0) / relevantRecords.length;
    const score = (avgOutput * 0.6) + (avgQuality * 0.4);
    return { ...worker, avgOutput, avgQuality, score };
  }).sort((a, b) => b.score - a.score);
}

// 2. แนะนำงานทางเลือก (เมื่อสภาพอากาศไม่อำนวย)
export function suggestAlternativeTasks(worker, weatherCondition) {
  const outdoorTasks = ['เทปูน', 'มุงหลังคา', 'โครงสร้าง คสล.', 'ผูกเหล็ก', 'งานเชื่อม'];
  const indoorTasks = ['ฉาบปูน', 'งานกระเบื้องพื้น', 'งานกระเบื้องผนัง', 'งานทาสี',
    'งานฝ้าเพดาน', 'งานไฟฟ้า', 'งานประปา'];

  let suitableTasks = [];
  if (weatherCondition === 'Rain') {
    suitableTasks = indoorTasks;
  } else if (weatherCondition === 'ExtremeHot') {
    suitableTasks = [...indoorTasks, 'ผูกเหล็ก'];
  } else {
    suitableTasks = [...outdoorTasks, ...indoorTasks];
  }

  const workerSkills = [...new Set((worker.records || []).map(r => r.work_type))];
  return workerSkills.filter(skill => suitableTasks.includes(skill));
}