import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/section-groups/clear-all
 * Body: { sessionId: string }
 *
 * Disables all synchronization requirements (same instructor and cross-instructor)
 * for all section groups in a session.
 */
export async function POST(request: Request) {
    try {
        const { sessionId } = await request.json();

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        // 1. Update all groups in the session
        await prisma.sectionGroup.updateMany({
            where: { course: { sessionId } },
            data: {
                sameDayRequired: false,
                sameInstructorSyncRequired: false
            }
        });

        // 2. Clear all SAME_PERIOD constraints for this session's courses
        await prisma.distributionConstraint.deleteMany({
            where: {
                type: "SAME_PERIOD",
                examA: {
                    owners: {
                        some: {
                            section: {
                                course: { sessionId }
                            }
                        }
                    }
                }
            }
        });

        return NextResponse.json({ 
            success: true, 
            message: "All synchronization rules have been disabled for this session." 
        });
    } catch (error) {
        console.error("Failed to clear all section groups:", error);
        return NextResponse.json({ error: "Clear all failed" }, { status: 500 });
    }
}
