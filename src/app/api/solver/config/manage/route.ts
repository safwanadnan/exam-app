export const dynamic = 'force-dynamic';
import { NextRequest } from "next/server";
import { prisma, jsonResponse, parseBody, withErrorHandling } from "@/lib/api-helpers";
import { solverConfigSchema } from "@/lib/validations";


export const POST = withErrorHandling(async (req: NextRequest) => {
    const parsed = await parseBody(req, solverConfigSchema);
    if (parsed.error) return parsed.error;

    const { sessionId, ...rest } = parsed.data;
    const config = await prisma.solverConfig.create({
        data: {
            ...rest,
            session: { connect: { id: sessionId } }
        }
    });
    return jsonResponse(config, 201);
});

export const PUT = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);

    const parsed = await parseBody(req, solverConfigSchema.partial());
    if (parsed.error) return parsed.error;

    // Filter out sessionId if it's there, as Prisma often prevents direct FK update 
    // when a relation field is defined, and changing session for a config is rarely desired.
    const { sessionId, ...data } = parsed.data;

    const config = await prisma.solverConfig.update({
        where: { id },
        data
    });
    return jsonResponse(config);
});

export const DELETE = withErrorHandling(async (req: NextRequest) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);

    await prisma.solverConfig.delete({ where: { id } });
    return jsonResponse({ success: true });
});
