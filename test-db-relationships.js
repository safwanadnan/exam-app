const Database = require('better-sqlite3');
const db = new Database('./dev.db');

const run = db.prepare("SELECT id FROM SolverRun ORDER BY createdAt DESC LIMIT 1").get();
console.log("Latest Run:", run);

const assignments = db.prepare("SELECT id, periodId FROM ExamAssignment WHERE runId = ?").all(run.id);
console.log(`Assignments for run ${run.id}:`, assignments.length);

const periods = db.prepare("SELECT id FROM ExamPeriod").all();
console.log(`Total periods:`, periods.length);

const periodIds = new Set(periods.map(p => p.id));
let matched = 0;
for (const a of assignments) {
    if (periodIds.has(a.periodId)) matched++;
}
console.log(`Assignments with matching periodId: ${matched}/${assignments.length}`);
