// A simple server-side utility for checking permissions.

/**
 * Checks if a set of permissions contains a specific permission.
 * This is a helper to avoid repeating the `.has()` logic.
 * @param {Set<string>} permissionsSet - The user's effective permissions.
 * @param {string} requiredPermission - The permission to check for.
 * @returns {boolean} - True if the user has the permission.
 */
export function hasPermission(permissionsSet: Set<string>, requiredPermission: string): boolean {
    return permissionsSet.has(requiredPermission);
}

/**
 * Checks if a set of permissions contains at least one of the provided permissions.
 * @param {Set<string>} permissionsSet - The user's effective permissions.
 * @param {string[]} requiredPermissions - An array of permissions to check against.
 * @returns {boolean} - True if the user has at least one of the permissions.
 */
export function hasAnyPermission(permissionsSet: Set<string>, requiredPermissions: string[]): boolean {
    return requiredPermissions.some(p => permissionsSet.has(p));
}
