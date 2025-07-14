const imageExtensions = new Set([
    '.png',
    '.jpeg',
    '.jpg',
    '.webp',
    '.gif',
]);

export function isImageFile(filePath: string): boolean {
    const extension = ('.' + filePath.split('.').pop()).toLowerCase();
    return imageExtensions.has(extension);
}
const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.md': 'markdown',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.sql': 'sql',
    '.rs': 'rust',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.dart': 'dart',
    '.lua': 'lua',
    '.pl': 'perl',
    '.r': 'r',
    '.ex': 'elixir',
    '.exs': 'elixir',
};

export function getLanguageForFile(filePath: string): string {
    const extension = ('.' + filePath.split('.').pop()).toLowerCase();
    return languageMap[extension] || '';
}