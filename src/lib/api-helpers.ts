/**
 * API helpers — shared utilities for Next.js route handlers.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z, ZodSchema } from "zod";

// Re-export prisma for use in route handlers
export { prisma };

/**
 * Standard JSON response helper
 */
export function jsonResponse(data: unknown, status = 200) {
    return NextResponse.json(data, { status });
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status = 400) {
    return NextResponse.json({ error: message }, { status });
}

/**
 * Parse and validate request body against a Zod schema
 */
export async function parseBody<T>(
    req: NextRequest,
    schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
    try {
        const body = await req.json();
        const result = schema.safeParse(body);
        if (!result.success) {
            return {
                data: null,
                error: errorResponse(
                    result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
                    422
                ),
            };
        }
        return { data: result.data, error: null };
    } catch {
        return { data: null, error: errorResponse("Invalid JSON body", 400) };
    }
}

/**
 * Extract pagination params from URL search params
 */
export function getPagination(req: NextRequest) {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

/**
 * Wrap an async handler with error catching
 */
export function withErrorHandling(
    handler: (req: NextRequest, context: any) => Promise<NextResponse>
) {
    return async (req: NextRequest, context: any) => {
        try {
            return await handler(req, context);
        } catch (error: unknown) {
            console.error("[API Error]", error);
            const message = error instanceof Error ? error.message : "Internal server error";
            return errorResponse(message, 500);
        }
    };
}
