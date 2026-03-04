async function main() {
    // 1. Kick off solver
    console.log("Starting solver...");
    const res = await fetch('http://localhost:3000/api/solver/start', { method: 'POST' });
    const runData = await res.json();
    console.log("Solver started:", runData);

    // 2. Wait for it to complete
    let status = "RUNNING";
    while (status === "RUNNING" || status === "PENDING") {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch('http://localhost:3000/api/solver/runs');
        const statusData = await statusRes.json();
        const run = statusData.runs.find(r => r.id === runData.runId);
        status = run ? run.status : "UNKNOWN";
        console.log(`Solver status: ${status}`);
    }

    if (status !== "COMPLETED") {
        console.error("Solver did not complete successfully.");
        process.exit(1);
    }

    // 3. Fetch assignments
    const assignmentsRes = await fetch(`http://localhost:3000/api/export?runId=${runData.runId}`);
    const assignmentsData = await assignmentsRes.json();
    const assignments = assignmentsData.assignments || [];

    if (assignments.length === 0) {
        console.error("No assignments generated!");
        process.exit(1);
    }

    console.log(`Generated ${assignments.length} assignments.`);

    // 4. Test the new Interactive Details API
    const testAssignmentId = assignments[0].id;
    console.log(`Testing details API for assignment ${testAssignmentId}...`);
    const detailsRes = await fetch(`http://localhost:3000/api/schedule/details?assignmentId=${testAssignmentId}`);
    const detailsData = await detailsRes.json();

    console.log("\n--- API Response Target ---");
    console.log(JSON.stringify(detailsData, null, 2));

    if (detailsData.details && Array.isArray(detailsData.clashes)) {
        console.log("\n✅ Success! API structure is exactly as expected.");
    } else {
        console.error("\n❌ API structure is malformed!");
        process.exit(1);
    }
}

main().catch(console.error);
