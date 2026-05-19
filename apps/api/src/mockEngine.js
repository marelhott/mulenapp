import { updateStore } from './store.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function nextEditLabel(snapshot, outputCount, index) {
    const photoEdits = snapshot.versions.filter((version) => version.module === 'photo-director' && version.label !== 'Original');
    const branchLetter = String.fromCharCode(65 + photoEdits.length);
    return outputCount === 1 ? `Edit ${branchLetter}` : `Edit ${branchLetter}.${index + 1}`;
}
function parseLockedAreas(snapshot, lockedText, createdAt) {
    if (!lockedText?.trim())
        return snapshot.lockedAreas;
    const parts = lockedText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (parts.length === 0)
        return snapshot.lockedAreas;
    const existing = new Map(snapshot.lockedAreas.map((area) => [area.label.toLowerCase(), area]));
    const next = [...snapshot.lockedAreas];
    for (const label of parts) {
        if (existing.has(label.toLowerCase()))
            continue;
        const strictness = label.toLowerCase().includes('logo') || label.toLowerCase().includes('text') ? 'high' : 'medium';
        const area = {
            id: createId('lock'),
            projectId: snapshot.project.id,
            label,
            type: label.toLowerCase().includes('logo')
                ? 'logo'
                : label.toLowerCase().includes('text')
                    ? 'text'
                    : label.toLowerCase().includes('product')
                        ? 'product'
                        : 'custom',
            strictness,
            description: `Preserve ${label} during focused edits.`,
            createdAt,
        };
        next.unshift(area);
    }
    return next;
}
function updateJob(snapshot, jobId, patch) {
    return snapshot.jobs.map((job) => (job.id === jobId ? { ...job, ...patch, updatedAt: new Date().toISOString() } : job));
}
export async function processPhotoDirectorJob(jobId) {
    await updateStore((store) => ({
        ...store,
        snapshot: {
            ...store.snapshot,
            jobs: updateJob(store.snapshot, jobId, {
                status: 'running',
                progress: 20,
            }),
        },
    }));
    await sleep(450);
    await updateStore((store) => {
        const snapshot = store.snapshot;
        const job = snapshot.jobs.find((item) => item.id === jobId);
        if (!job)
            return store;
        const input = (job.input ?? {});
        const outputCount = Math.max(1, Math.min(Number(input.outputCount ?? 1), 5));
        const sourceVersion = snapshot.versions.find((version) => version.id === input.sourceVersionId) ??
            snapshot.versions.find((version) => version.id === snapshot.project.activeVersionId) ??
            snapshot.versions[0];
        const sourceAsset = snapshot.assets.find((asset) => asset.id === sourceVersion?.assetId) ?? snapshot.assets[0];
        const createdAt = new Date().toISOString();
        const lockedAreas = parseLockedAreas(snapshot, input.lockedText, createdAt);
        const assets = [];
        const versions = [];
        const steps = [];
        const modelRuns = [];
        const qaList = [];
        const outputVersionIds = [];
        for (let index = 0; index < outputCount; index += 1) {
            const assetId = createId('asset-generated');
            const versionId = createId('version-generated');
            const stepId = createId('step');
            const runId = createId('run');
            const qaId = createId('qa');
            assets.push({
                id: assetId,
                projectId: snapshot.project.id,
                userId: snapshot.project.userId,
                kind: 'generated',
                url: sourceAsset?.url ?? '',
                storagePath: `mock/generated/${versionId}.jpg`,
                mimeType: sourceAsset?.mimeType ?? 'image/jpeg',
                createdAt,
                width: sourceAsset?.width,
                height: sourceAsset?.height,
                metadata: {
                    mockMode: true,
                    aspectRatio: input.aspectRatio ?? 'original',
                    polishMode: input.polishMode ?? 'focused',
                },
            });
            versions.push({
                id: versionId,
                projectId: snapshot.project.id,
                parentVersionId: sourceVersion?.id,
                assetId,
                label: nextEditLabel(snapshot, outputCount, index),
                prompt: input.instruction ?? '',
                module: 'photo-director',
                createdAt,
                editStepId: stepId,
                qualityScore: 80 + Math.max(0, 6 - index),
                modelRuns: [runId],
                metadata: {
                    mockMode: true,
                    aspectRatio: input.aspectRatio ?? 'original',
                    polishMode: input.polishMode ?? 'focused',
                },
            });
            steps.push({
                id: stepId,
                projectId: snapshot.project.id,
                fromVersionId: sourceVersion?.id,
                toVersionIds: [versionId],
                userInstruction: input.instruction ?? '',
                agentSummary: `Mock backend preserved ${input.lockedText || 'the important parts'} and created a new project version.`,
                lockedAreaIds: lockedAreas.map((area) => area.id),
                visualCanonId: snapshot.visualCanon.id,
                createdAt,
                module: 'photo-director',
            });
            modelRuns.push({
                id: runId,
                jobId,
                provider: 'internal-router',
                model: input.polishMode === 'focused' ? 'precise-edit-mock' : 'balanced-edit-mock',
                inputPrompt: input.instruction ?? '',
                inputAssetIds: sourceVersion ? [sourceVersion.assetId] : [],
                outputAssetId: assetId,
                status: 'succeeded',
                latencyMs: 1200 + index * 120,
                costEstimate: 0.01,
                createdAt,
            });
            qaList.push({
                id: qaId,
                versionId,
                projectId: snapshot.project.id,
                identityPreservation: 'high',
                objectPreservation: 'high',
                styleConsistency: input.polishMode === 'bold' ? 'medium' : 'high',
                commercialUsefulness: 'high',
                artifactRisk: 'low',
                labels: [input.polishMode === 'focused' ? 'Jen doladit' : 'Photo Director', index === 0 ? 'Mock preview' : 'Nova vetev'],
                summary: 'Main workflow is active in mock execution mode until provider credentials are connected.',
                createdAt,
            });
            outputVersionIds.push(versionId);
        }
        return {
            ...store,
            snapshot: {
                ...snapshot,
                assets: [...assets, ...snapshot.assets],
                versions: [...versions, ...snapshot.versions],
                editSteps: [...steps, ...snapshot.editSteps],
                lockedAreas,
                jobs: updateJob({
                    ...snapshot,
                    jobs: snapshot.jobs,
                }, jobId, {
                    status: 'succeeded',
                    progress: 100,
                    outputVersionIds,
                }),
                modelRuns: [...modelRuns, ...snapshot.modelRuns],
                qualityEvaluations: [...qaList, ...snapshot.qualityEvaluations],
                project: {
                    ...snapshot.project,
                    activeVersionId: outputVersionIds[0] ?? snapshot.project.activeVersionId,
                    updatedAt: createdAt,
                },
            },
        };
    });
}
export async function processQueuedJobsOnce() {
    const store = await updateStore((current) => current);
    const queuedPhotoJobs = store.snapshot.jobs.filter((job) => job.status === 'queued' && job.module === 'photo-director');
    for (const job of queuedPhotoJobs) {
        await processPhotoDirectorJob(job.id);
    }
}
