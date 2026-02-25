/**
 * POST /api/import — Bulk data import
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";

// Simplified schema for the bulk import payload
const importSchema = z.object({
    session: z.object({
        name: z.string(),
        year: z.number().int(),
        term: z.string(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
    }),
    buildings: z.array(z.object({
        code: z.string(),
        name: z.string(),
        rooms: z.array(z.object({
            name: z.string(),
            capacity: z.number().int(),
            altCapacity: z.number().int().optional(),
        }))
    })).optional(),
    examTypes: z.array(z.object({
        name: z.string(),
        code: z.string(),
        periods: z.array(z.object({
            date: z.string().datetime(),
            startTime: z.string(),
            endTime: z.string(),
            length: z.number().int(),
            day: z.number().int(),
            timeIndex: z.number().int(),
            penalty: z.number().int().default(0),
        })),
        exams: z.array(z.object({
            name: z.string().optional(),
            length: z.number().int(),
            size: z.number().int(),
            maxRooms: z.number().int().default(4),
            altSeating: z.boolean().default(false),
        })).optional()
    })).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, importSchema);
    if (parsed.error) return parsed.error;

    const data = parsed.data;

    // Use a transaction for bulk import
    const result = await prisma.$transaction(async (tx: any) => {
        // 1. Create Session
        const session = await tx.academicSession.create({
            data: {
                ...data.session,
                startDate: new Date(data.session.startDate),
                endDate: new Date(data.session.endDate),
            }
        });

        const stats = { buildings: 0, rooms: 0, examTypes: 0, periods: 0, exams: 0 };

        // 2. Create Buildings & Rooms
        if (data.buildings) {
            for (const b of data.buildings) {
                await tx.building.create({
                    data: {
                        code: b.code,
                        name: b.name,
                        rooms: {
                            create: b.rooms.map(r => ({
                                name: r.name,
                                capacity: r.capacity,
                                altCapacity: r.altCapacity,
                            }))
                        }
                    }
                });
                stats.buildings++;
                stats.rooms += b.rooms.length;
            }
        }

        // 3. Create Exam Types, Periods & Exams
        if (data.examTypes) {
            for (const et of data.examTypes) {
                const examType = await tx.examType.create({
                    data: {
                        name: et.name,
                        code: et.code,
                        sessionId: session.id,
                        periods: {
                            create: et.periods.map(p => ({
                                ...p,
                                date: new Date(p.date)
                            }))
                        },
                        exams: et.exams ? {
                            create: et.exams.map(e => ({
                                ...e
                            }))
                        } : undefined
                    }
                });
                stats.examTypes++;
                stats.periods += et.periods.length;
                stats.exams += et.exams?.length || 0;
            }
        }

        return { sessionId: session.id, stats };
    }, {
        timeout: 30000 // Allow up to 30s for complex imports
    });

    return jsonResponse({ success: true, message: "Import completed successfully", result }, 201);
});
