// src/algorithms.js

// 1. ฟังก์ชันหาช่างทดแทน (เมื่อช่างหลักขาดงาน)
export function findSubstituteWorkers(missingWorker, requiredWorkType, allWorkers) {
  // กรองช่างคนอื่นที่เคยทำงานประเภทนี้ 
  const candidates = allWorkers.filter(worker => 
    worker.id !== missingWorker.id && 
    (worker.records || []).some(record => record.work_type === requiredWorkType)
  );

  return candidates.map(worker => {
    const relevantRecords = worker.records.filter(r => r.work_type === requiredWorkType);
    const avgOutput = relevantRecords.reduce((sum, r) => sum + (r.output || 0), 0) / relevantRecords.length;
    const avgQuality = relevantRecords.reduce((sum, r) => sum + (r.quality || 0), 0) / relevantRecords.length;
    
    // ถ่วงน้ำหนัก ผลผลิต 60% คุณภาพ 40%
    const score = (avgOutput * 0.6) + (avgQuality * 0.4); 
    
    return { ...worker, avgOutput, avgQuality, score };
  }).sort((a, b) => b.score - a.score); // เรียงจากคะแนนสูงสุดลงมา
}

// 2. ฟังก์ชันแนะนำงานทางเลือก (เมื่อสภาพอากาศไม่อำนวย)
export function suggestAlternativeTasks(worker, weatherCondition) {
  // กฎการก่อสร้าง: งานกลางแจ้ง vs งานในร่ม
  const outdoorTasks = ['เทปูน', 'มุงหลังคา', 'โครงสร้าง คสล.', 'ผูกเหล็ก', 'งานเชื่อม'];
  const indoorTasks = ['ฉาบปูน', 'งานกระเบื้องพื้น', 'งานกระเบื้องผนัง', 'งานทาสี', 'งานฝ้าเพดาน', 'งานไฟฟ้า', 'งานประปา'];

  let suitableTasks = [];

  if (weatherCondition === 'Rain') {
    suitableTasks = indoorTasks; // ฝนตก บังคับทำในร่ม
  } else if (weatherCondition === 'ExtremeHot') {
    suitableTasks = [...indoorTasks, 'ผูกเหล็ก']; // ร้อนจัด ทำในร่ม หรือผูกเหล็กในร่มรอประกอบ
  } else {
    suitableTasks = [...outdoorTasks, ...indoorTasks]; // อากาศปกติ ทำได้หมด
  }

  // หาว่าช่างคนนี้เคยทำงานอะไรในกลุ่มที่เหมาะสมบ้าง
  const workerSkills = [...new Set((worker.records || []).map(r => r.work_type))];
  
  return workerSkills.filter(skill => suitableTasks.includes(skill));
}