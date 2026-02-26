export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, withErrorHandling } from "@/lib/api-helpers";
import * as XLSX from "xlsx";

export const POST = withErrorHandling(async (req: NextRequest) => {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sheetType = formData.get("sheetType") as string;
    const sessionId = formData.get("sessionId") as string;

    if (!file) return jsonResponse({ error: "No file uploaded" }, 400);
    if (!sheetType) return jsonResponse({ error: "Sheet type is required" }, 400);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) return jsonResponse({ error: "Empty spreadsheet" }, 400);

    const headers = Object.keys(rows[0]);
    let imported = 0;
    const errors: string[] = [];

    try {
        if (sheetType === "rooms") {
            for (const row of rows) {
                try {
                    const buildingCode = String(row.building_code || row.Building || row.building || "").trim();
                    const buildingName = String(row.building_name || row["Building Name"] || buildingCode).trim();
                    const roomName = String(row.room || row.Room || row.name || row.Name || "").trim();
                    const capacity = parseInt(row.capacity || row.Capacity || row.seats || "0") || 0;

                    if (!roomName || !buildingCode) { errors.push(`Row ${imported + 1}: missing room/building`); continue; }

                    const building = await prisma.building.upsert({
                        where: { code: buildingCode },
                        create: { code: buildingCode, name: buildingName },
                        update: {},
                    });

                    await prisma.room.create({
                        data: { name: roomName, buildingId: building.id, capacity },
                    });
                    imported++;
                } catch (e: any) {
                    errors.push(`Row ${imported + 1}: ${e.message}`);
                }
            }
        } else if (sheetType === "students") {
            for (const row of rows) {
                try {
                    const externalId = String(row.id || row.ID || row.student_id || row["Student ID"] || "").trim();
                    const name = String(row.name || row.Name || row["Student Name"] || "").trim();
                    if (!externalId || !name) { errors.push(`Row ${imported + 1}: missing id/name`); continue; }

                    await prisma.student.upsert({
                        where: { externalId },
                        create: { externalId, name },
                        update: { name },
                    });
                    imported++;
                } catch (e: any) {
                    errors.push(`Row ${imported + 1}: ${e.message}`);
                }
            }
        } else if (sheetType === "exams") {
            if (!sessionId) return jsonResponse({ error: "Session ID required for exam import" }, 400);

            const session = await prisma.academicSession.findUnique({ where: { id: sessionId }, include: { examTypes: true } });
            if (!session) return jsonResponse({ error: "Session not found" }, 404);

            let examType = session.examTypes[0];
            if (!examType) {
                examType = await prisma.examType.create({
                    data: { name: "Imported", code: "IMP", sessionId },
                });
            }

            for (const row of rows) {
                try {
                    const name = String(row.name || row.Name || row["Exam Name"] || row.course || row.Course || "").trim();
                    const length = parseInt(row.length || row.Length || row.duration || row.Duration || "120") || 120;
                    const maxRooms = parseInt(row.max_rooms || row["Max Rooms"] || "1") || 1;
                    if (!name) { errors.push(`Row ${imported + 1}: missing name`); continue; }

                    await prisma.exam.create({
                        data: { name, examTypeId: examType.id, length, maxRooms },
                    });
                    imported++;
                } catch (e: any) {
                    errors.push(`Row ${imported + 1}: ${e.message}`);
                }
            }
        } else if (sheetType === "enrollments") {
            // Find a default section to use for enrollments
            const defaultSection = await prisma.section.findFirst();
            if (!defaultSection) {
                return jsonResponse({ error: "No sections exist. Import exams and courses first, or use the JSON import." }, 400);
            }

            for (const row of rows) {
                try {
                    const studentExtId = String(row.student_id || row["Student ID"] || row.student || "").trim();
                    const examName = String(row.exam || row.Exam || row["Exam Name"] || row.course || "").trim();
                    if (!studentExtId || !examName) { errors.push(`Row ${imported + 1}: missing student/exam`); continue; }

                    const student = await prisma.student.findUnique({ where: { externalId: studentExtId } });
                    const exam = await prisma.exam.findFirst({ where: { name: examName } });
                    if (!student) { errors.push(`Row ${imported + 1}: student ${studentExtId} not found`); continue; }
                    if (!exam) { errors.push(`Row ${imported + 1}: exam ${examName} not found`); continue; }

                    // Try to find an exam-specific section via owners, fallback to default
                    const examOwner = await prisma.examOwner.findFirst({ where: { examId: exam.id } });
                    const sectionId = examOwner?.sectionId || defaultSection.id;

                    await prisma.studentEnrollment.upsert({
                        where: { studentId_examId: { studentId: student.id, examId: exam.id } },
                        create: { studentId: student.id, examId: exam.id, sectionId },
                        update: {},
                    });
                    imported++;
                } catch (e: any) {
                    errors.push(`Row ${imported + 1}: ${e.message}`);
                }
            }
        } else {
            return jsonResponse({ error: `Unknown sheet type: ${sheetType}` }, 400);
        }
    } catch (e: any) {
        return jsonResponse({ error: e.message }, 500);
    }

    return jsonResponse({
        imported,
        total: rows.length,
        errors: errors.slice(0, 20),
        headers,
    });
});
