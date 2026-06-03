/**
 * ExamSameTimePeer - Utility for finding exam groups linked by hard SAME_PERIOD constraints.
 *
 * When sections of the same course must share the same exam period, all
 * linked exams must be treated as a single atomic unit during construction
 * and local search. This utility resolves the full transitive closure of
 * linked exams via Union-Find so the solver can move them together.
 */
import { DistributionType } from "../types";
import type { Exam } from "./Exam";
import type { ExamModel } from "./ExamModel";

/**
 * Given an exam, return all exams that must be in the same period as it
 * (transitively) due to hard SAME_PERIOD distribution constraints.
 * The returned array always includes the original exam itself.
 */
export function getSameTimePeers(exam: Exam, model: ExamModel): Exam[] {
    // BFS through hard SAME_PERIOD edges
    const group = new Set<string>();
    const queue: string[] = [exam.id];
    group.add(exam.id);

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const current = model.getExam(currentId);
        if (!current) continue;

        for (const dc of current.distributionConstraints) {
            if (!dc.hard || dc.type !== DistributionType.SAME_PERIOD) continue;
            const peerId = dc.examAId === currentId ? dc.examBId : dc.examAId;
            if (!group.has(peerId)) {
                group.add(peerId);
                queue.push(peerId);
            }
        }
    }

    return Array.from(group)
        .map((id) => model.getExam(id))
        .filter((e): e is Exam => e !== undefined);
}

/**
 * Build a map from examId → group (array of all exams in the same-time group).
 * This is computed once and can be reused throughout the solve.
 */
export function buildSameTimeGroups(model: ExamModel): Map<string, Exam[]> {
    const result = new Map<string, Exam[]>();
    const visited = new Set<string>();

    for (const exam of model.exams) {
        if (visited.has(exam.id)) continue;

        const group = getSameTimePeers(exam, model);
        for (const e of group) {
            visited.add(e.id);
            result.set(e.id, group);
        }
    }

    return result;
}
