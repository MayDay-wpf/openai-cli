import { BaseMCPService } from '../base-service';
import {
    MCPRequest,
    MCPResponse,
    MCPTool
} from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Todo {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    dependencies: string[];
}

interface CreateTodosParams {
    todos: Omit<Todo, 'id'>[];
}

interface UpdateTodosParams {
    updates: (Partial<Omit<Todo, 'id'>> & { id: string })[];
}

export class TodosService extends BaseMCPService {
    private static todos: Todo[] = [];

    constructor() {
        super('todos', '1.0.0');
    }

    public static getTodos(): Todo[] {
        return TodosService.todos;
    }

    public static clearTodos(): void {
        TodosService.todos = [];
    }

    public static areAllTodosCompleted(): boolean {
        if (TodosService.todos.length === 0) {
            return true;
        }
        return TodosService.todos.every(todo => todo.status === 'completed' || todo.status === 'cancelled');
    }

    getTools(): MCPTool[] {
        return [
            {
                name: 'create_todos',
                description: "Create or replace the entire list of todo items. This is useful for starting a new plan. Any existing todos will be discarded. For incrementally adding todos, use `add_todos`. The `id` will be generated automatically.",
                inputSchema: {
                    type: 'object',
                    properties: {
                        todos: {
                            type: 'array',
                            description: 'An array of todo items to create.',
                            items: {
                                type: 'object',
                                properties: {
                                    content: { type: 'string', description: 'The task description.' },
                                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
                                    dependencies: { type: 'array', items: { type: 'string' }, default: [] }
                                },
                                required: ['content']
                            }
                        }
                    },
                    required: ['todos']
                }
            },
            {
                name: 'add_todos',
                description: 'Add one or more new todo items to the existing list. The `id` will be generated automatically.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        todos: {
                            type: 'array',
                            description: 'An array of todo items to add.',
                            items: {
                                type: 'object',
                                properties: {
                                    content: { type: 'string', description: 'The task description.' },
                                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
                                    dependencies: { type: 'array', items: { type: 'string' }, default: [] }
                                },
                                required: ['content']
                            }
                        }
                    },
                    required: ['todos']
                }
            },
            {
                name: 'update_todos',
                description: 'Update one or more existing todo items. You can change their status, content, or dependencies.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        updates: {
                            type: 'array',
                            description: 'An array of todo updates. Each update must have an `id`.',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'The ID of the todo to update.' },
                                    content: { type: 'string', description: 'The new task description.' },
                                    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
                                    dependencies: { type: 'array', items: { type: 'string' } }
                                },
                                required: ['id']
                            }
                        }
                    },
                    required: ['updates']
                }
            }
        ];
    }

    async handleRequest(request: MCPRequest): Promise<MCPResponse> {
        try {
            switch (request.method) {
                case 'create_todos':
                    return await this.handleCreateTodos(request);
                case 'add_todos':
                    return await this.handleAddTodos(request);
                case 'update_todos':
                    return await this.handleUpdateTodos(request);
                default:
                    return this.createErrorResponse(request.id, -32601, `Unsupported method: ${request.method}`);
            }
        } catch (error) {
            return this.createErrorResponse(request.id, -32603, 'Internal server error', error instanceof Error ? error.message : String(error));
        }
    }

    private formatTodosForDisplay(todos: Todo[]): string {
        if (todos.length === 0) {
            return 'No todos found.';
        }

        const todoIdToIndexMap = new Map(todos.map((t, i) => [t.id, i + 1]));

        return todos.map((t, i) => {
            const statusIcon = {
                pending: '⚪️',
                in_progress: '🔵',
                completed: '✅',
                cancelled: '❌'
            }[t.status];
            let deps = '';
            if (t.dependencies.length > 0) {
                const depIndices = t.dependencies
                    .map(depId => todoIdToIndexMap.get(depId) || '?')
                    .join(', ');
                deps = ` (depends on: ${depIndices})`;
            }
            return `${statusIcon} ${i + 1}. ${t.content}${deps}`;
        }).join('\n');
    }

    private async handleCreateTodos(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['todos']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: CreateTodosParams = request.params;
        TodosService.todos = params.todos.map((t: any) => ({
            ...t,
            id: uuidv4(),
            status: t.status || 'pending',
            dependencies: t.dependencies || []
        }));

        return this.createSuccessResponse(request.id, TodosService.todos);
    }

    private async handleAddTodos(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['todos']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: CreateTodosParams = request.params;
        const newTodos = params.todos.map((t: any) => ({
            ...t,
            id: uuidv4(),
            status: t.status || 'pending',
            dependencies: t.dependencies || []
        }));
        TodosService.todos.push(...newTodos);

        return this.createSuccessResponse(request.id, TodosService.todos);
    }

    private async handleUpdateTodos(request: MCPRequest): Promise<MCPResponse> {
        const validationError = this.validateParams(request.params, ['updates']);
        if (validationError) {
            return this.createErrorResponse(request.id, -32602, validationError);
        }

        const params: UpdateTodosParams = request.params;

        for (const update of params.updates) {
            const todoIndex = TodosService.todos.findIndex(t => t.id === update.id);
            if (todoIndex !== -1) {
                // Apply updates
                Object.assign(TodosService.todos[todoIndex], update);
            }
        }
        console.log(this.formatTodosForDisplay(TodosService.todos));
        return this.createSuccessResponse(request.id, TodosService.todos);
    }
} 