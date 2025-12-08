// Type declarations for Obsidian internals not exposed in the public API

declare module 'obsidian' {
  /**
   * FileSystemAdapter is the concrete implementation of DataAdapter used by Obsidian
   * on desktop platforms. It provides access to the file system.
   */
  interface FileSystemAdapter {
    /**
     * The absolute path to the vault root directory on the file system.
     * This is available on desktop but not on mobile.
     */
    basePath: string;
  }
}

export {};
