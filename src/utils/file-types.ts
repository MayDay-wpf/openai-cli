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