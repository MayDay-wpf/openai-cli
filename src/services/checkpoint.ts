import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 定义检查点条目的结构
export interface Checkpoint {
    id: string; // 检查点条目的唯一标识符
    taskId: string; // 对来自单个用户请求的更改进行分组
    timestamp: string; // 创建检查点时的ISO字符串
    originalPath: string; // 原始文件的绝对路径
    checkpointPath?: string; // 检查点目录中备份文件的路径
    type: 'edit' | 'create'; // 'edit'表示已修改的文件，'create'表示新文件
    description: string; // 用户请求的简短描述
}

// 定义清单文件的结构
interface CheckpointManifest {
    checkpoints: Checkpoint[];
}

export class CheckpointService {
    private static instance: CheckpointService;

    // 实例属性
    private checkpointDir: string;
    private manifestPath: string;
    private manifest!: CheckpointManifest;
    private currentTaskId: string | null = null;
    private currentTaskDescription: string | null = null;

    private constructor() {
        const projectRoot = process.cwd();
        this.checkpointDir = path.join(projectRoot, '.openai-cli', 'checkpoints');
        this.manifestPath = path.join(this.checkpointDir, 'manifest.json');
        this.initialize();
    }

    public static getInstance(): CheckpointService {
        if (!CheckpointService.instance) {
            CheckpointService.instance = new CheckpointService();
        }
        return CheckpointService.instance;
    }

    private initialize(): void {
        try {
            if (!fs.existsSync(this.checkpointDir)) {
                fs.mkdirSync(this.checkpointDir, { recursive: true });
            }
            if (!fs.existsSync(this.manifestPath)) {
                this.saveManifest({ checkpoints: [] });
            }
            this.loadManifest();
        } catch (error) {
            console.error('Failed to initialize CheckpointService:', error);
            this.manifest = { checkpoints: [] };
        }
    }

    private loadManifest(): void {
        try {
            const data = fs.readFileSync(this.manifestPath, 'utf-8');
            this.manifest = JSON.parse(data);
        } catch (error) {
            this.manifest = { checkpoints: [] };
        }
    }

    private saveManifest(manifest: CheckpointManifest): void {
        try {
            fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
            this.manifest = manifest;
        } catch (error) {
            console.error('Failed to save checkpoint manifest:', error);
        }
    }

    public setCurrentTask(taskId: string, description: string): void {
        this.currentTaskId = taskId;
        this.currentTaskDescription = description;
    }

    public clearCurrentTask(): void {
        this.currentTaskId = null;
        this.currentTaskDescription = null;
    }

    public async createCheckpoint(originalPath: string): Promise<void> {
        if (!this.currentTaskId) return;

        // 在每次写入操作前，从磁盘重新加载清单，确保数据是最新的
        this.loadManifest();

        const absoluteOriginalPath = path.resolve(originalPath);

        const existing = this.manifest.checkpoints.find(
            c => c.originalPath === absoluteOriginalPath && c.taskId === this.currentTaskId
        );
        if (existing) return;

        if (!fs.existsSync(absoluteOriginalPath)) {
            return this.recordCreate(originalPath);
        }

        try {
            const checkpointId = uuidv4();
            const backupFileName = `${path.basename(originalPath)}.${checkpointId}.bak`;
            const checkpointPath = path.join(this.checkpointDir, backupFileName);

            fs.copyFileSync(absoluteOriginalPath, checkpointPath);

            const newCheckpoint: Checkpoint = {
                id: checkpointId,
                taskId: this.currentTaskId,
                timestamp: new Date().toISOString(),
                originalPath: absoluteOriginalPath,
                checkpointPath: checkpointPath,
                type: 'edit',
                description: this.currentTaskDescription || 'N/A',
            };

            const newManifest = { ...this.manifest };
            newManifest.checkpoints.push(newCheckpoint);
            this.saveManifest(newManifest);
        } catch (error) {
            console.error(`Failed to create checkpoint for ${originalPath}:`, error);
        }
    }

    public async recordCreate(originalPath: string): Promise<void> {
        if (!this.currentTaskId) return;

        // 在每次写入操作前，从磁盘重新加载清单，确保数据是最新的
        this.loadManifest();

        const absoluteOriginalPath = path.resolve(originalPath);

        const existing = this.manifest.checkpoints.find(
            c => c.originalPath === absoluteOriginalPath && c.taskId === this.currentTaskId
        );
        if (existing) return;

        try {
            const checkpointId = uuidv4();
            const newCheckpoint: Checkpoint = {
                id: checkpointId,
                taskId: this.currentTaskId,
                timestamp: new Date().toISOString(),
                originalPath: absoluteOriginalPath,
                type: 'create',
                description: this.currentTaskDescription || 'N/A',
            };

            const newManifest = { ...this.manifest };
            newManifest.checkpoints.push(newCheckpoint);
            this.saveManifest(newManifest);
        } catch (error) {
            console.error(`Failed to record creation for ${originalPath}:`, error);
        }
    }

    public getCheckpoints(): Checkpoint[] {
        this.loadManifest();
        return this.manifest.checkpoints;
    }

    public getCheckpointsByTask(): Map<string, Checkpoint[]> {
        const tasks = new Map<string, Checkpoint[]>();
        const checkpoints = this.getCheckpoints();
        for (const cp of checkpoints) {
            if (!tasks.has(cp.taskId)) {
                tasks.set(cp.taskId, []);
            }
            tasks.get(cp.taskId)!.push(cp);
        }
        return tasks;
    }

    public async restoreByTask(taskId: string): Promise<boolean> {
        this.loadManifest();
        const checkpointsForTask = this.manifest.checkpoints.filter(c => c.taskId === taskId);
        if (checkpointsForTask.length === 0) {
            console.log(`No checkpoints found for task ID: ${taskId}`);
            return false;
        }

        let success = true;
        for (const checkpoint of checkpointsForTask.reverse()) {
            try {
                if (checkpoint.type === 'edit' && checkpoint.checkpointPath) {
                    if (fs.existsSync(checkpoint.checkpointPath)) {
                        fs.copyFileSync(checkpoint.checkpointPath, checkpoint.originalPath);
                        console.log(`Restored: ${checkpoint.originalPath}`);
                    }
                } else if (checkpoint.type === 'create') {
                    if (fs.existsSync(checkpoint.originalPath)) {
                        fs.unlinkSync(checkpoint.originalPath);
                        console.log(`Deleted: ${checkpoint.originalPath}`);
                    }
                }
            } catch (error) {
                console.error(`Failed to restore ${checkpoint.originalPath} for task ${taskId}:`, error);
                success = false;
            }
        }

        if (success) {
            // Remove restored checkpoints from manifest
            const newManifest = {
                ...this.manifest,
                checkpoints: this.manifest.checkpoints.filter(c => c.taskId !== taskId),
            };
            this.saveManifest(newManifest);
        }

        return success;
    }

    public async clearAllCheckpoints(): Promise<void> {
        try {
            if (fs.existsSync(this.checkpointDir)) {
                fs.rmSync(this.checkpointDir, { recursive: true, force: true });
            }
            this.initialize(); // Re-create empty dir and manifest
        } catch (error) {
            console.error('Failed to clear all checkpoints:', error);
        }
    }
} 